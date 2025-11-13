"""
Celery tasks for the api app.
"""
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from .models import Product
import pandas as pd
import os
from django.db import transaction


@shared_task
def bulk_delete_products(product_ids):
    """
    Celery task to delete multiple products in the background.
    
    Args:
        product_ids: List of product IDs to delete
    
    Returns:
        dict: Results with deleted count and any errors
    """
    deleted_count = 0
    errors = []
    
    try:
        with transaction.atomic():
            for product_id in product_ids:
                try:
                    product = Product.objects.get(id=product_id)
                    product.delete()
                    deleted_count += 1
                except Product.DoesNotExist:
                    errors.append(f"Product with id '{product_id}' not found")
                except Exception as e:
                    errors.append(f"Error deleting product {product_id}: {str(e)}")
        
        return {
            "deleted": deleted_count,
            "total": len(product_ids),
            "errors": errors if errors else None
        }
    except Exception as e:
        raise ValueError(f"Bulk delete failed: {str(e)}")


@shared_task
def add_numbers(x, y):
    """
    Celery task that adds two numbers in the background.
    
    Args:
        x: First number
        y: Second number
    
    Returns:
        Sum of x and y
    """
    result = x + y
    print(f"Adding {x} + {y} = {result}")
    return result


@shared_task
def process_product_file(file_path):
    """
    Process uploaded CSV file and import products in chunks.
    Reads CSV in chunks, validates columns and SKU values, and processes in batches.
    If any write fails, the entire upload fails (transaction rollback).
    
    Args:
        file_path: Path to the uploaded CSV file
    
    Returns:
        dict: Processing results with success count, error count, and errors
    """
    print('Task queued')
    success_count = 0
    chunksize = 100  # Read and process CSV in chunks of 100 rows
    
    try:
        # Validate CSV columns first
        column_validation = _validate_csv_columns(file_path)
        if not column_validation['valid']:
            if os.path.exists(file_path):
                os.remove(file_path)
            # Raise exception so Celery marks task as FAILURE
            raise ValueError(column_validation['error'])
        
        # Process CSV in chunks using transaction
        # If any write fails, the entire transaction will rollback
        with transaction.atomic():
            row_number = 0
            
            # Read CSV file in chunks and process each chunk as a batch
            for chunk_df in pd.read_csv(file_path, encoding='utf-8', chunksize=chunksize):
                # Replace NaN values with empty strings
                chunk_df = chunk_df.fillna('')
                
                # Convert chunk to list of dictionaries
                chunk_data = chunk_df.to_dict('records')
                
                # Prepare batch for this chunk
                batch = []
                
                # Validate and prepare each row in chunk
                for product_data in chunk_data:
                    row_number += 1
                    
                    # Validate SKU (must not be empty)
                    validation_error = _validate_product_data(product_data, row_number)
                    if validation_error:
                        # Fail entire upload if validation fails
                        if os.path.exists(file_path):
                            os.remove(file_path)
                        raise ValueError(validation_error)
                    
                    # Prepare product data
                    sku = str(product_data.get('sku', '')).strip()
                    name = str(product_data.get('name', '')).strip() if product_data.get('name') is not None else ''
                    description = str(product_data.get('description', '')).strip() if product_data.get('description') is not None else ''
                    status = str(product_data.get('status', 'active')).strip().lower() if product_data.get('status') is not None else 'active'
                    
                    # Validate status
                    if status not in ['active', 'inactive']:
                        status = 'active'
                    
                    # Add to batch
                    batch.append({
                        'sku': sku,
                        'name': name,
                        'description': description,
                        'status': status
                    })
                
                # Process the entire chunk as a batch
                if batch:
                    batch_success, batch_errors = _process_batch(batch)
                    success_count += batch_success
                    if batch_errors:
                        # If any batch write fails, raise exception to rollback transaction
                        raise ValueError(f"Batch write failed: {batch_errors[0]}")
        
        # Clean up file after successful processing
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return {
            'success': True,
            'success_count': success_count,
            'error_count': 0,
            'total_processed': success_count,
        }
    
    except Exception as e:
        # Clean up file on error
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        
        # Re-raise the exception so Celery marks the task as FAILURE
        raise


def _validate_csv_columns(file_path):
    """
    Validate that required columns exist in the CSV file.
    Returns dict with 'valid' (bool) and 'error' (str) keys.
    """
    try:
        # Read just the first row to check columns
        df = pd.read_csv(file_path, encoding='utf-8', nrows=0)
        columns = [col.strip().lower() for col in df.columns]
        
        required_columns = ['sku', 'name', 'description']
        missing_columns = []
        
        for req_col in required_columns:
            if req_col not in columns:
                missing_columns.append(req_col)
        
        if missing_columns:
            return {
                'valid': False,
                'error': f"Missing required columns: {', '.join(missing_columns)}. Found columns: {', '.join(columns)}"
            }
        
        return {'valid': True, 'error': None}
    except Exception as e:
        return {
            'valid': False,
            'error': f"Error reading CSV file: {str(e)}"
        }




def _validate_product_data(product_data, row_number):
    """
    Validate product data.
    Only SKU is required (must not be empty).
    Name and description can be empty strings.
    Returns error message if validation fails, None otherwise.
    """
    sku = str(product_data.get('sku', '')).strip()
    
    # Only SKU is required - it must not be empty
    if not sku:
        return f"Row {row_number}: SKU is required and cannot be empty"
    
    return None


def _process_batch(batch):
    """
    Process a batch of products using bulk_create and bulk_update.
    This function is called within a transaction, so if it raises an exception,
    the entire transaction will rollback.
    Returns (success_count, errors).
    Raises exception if any write fails.
    """
    success_count = 0
    errors = []
    
    # Get existing SKUs
    existing_skus = set(Product.objects.filter(
        sku__in=[item['sku'] for item in batch]
    ).values_list('sku', flat=True))
    
    # Separate into updates and creates
    to_create = []
    to_update = []
    
    for item in batch:
        if item['sku'] in existing_skus:
            to_update.append(item)
        else:
            to_create.append(item)
    
    # Bulk create new products
    if to_create:
        products_to_create = [
            Product(
                sku=item['sku'],
                name=item['name'],
                description=item['description'],
                status=item['status']
            )
            for item in to_create
        ]
        try:
            Product.objects.bulk_create(products_to_create, ignore_conflicts=False)
            success_count += len(products_to_create)
        except Exception as e:
            raise ValueError(f"Failed to create products: {str(e)}")
    
    # Bulk update existing products
    if to_update:
        products_to_update = []
        for item in to_update:
            try:
                product = Product.objects.get(sku=item['sku'])
                product.name = item['name']
                product.description = item['description']
                product.status = item['status']
                products_to_update.append(product)
            except Product.DoesNotExist:
                raise ValueError(f"SKU {item['sku']} not found for update")
            except Exception as e:
                raise ValueError(f"Error updating product {item['sku']}: {str(e)}")
        
        if products_to_update:
            try:
                Product.objects.bulk_update(
                    products_to_update,
                    ['name', 'description', 'status']
                )
                success_count += len(products_to_update)
            except Exception as e:
                raise ValueError(f"Failed to update products: {str(e)}")
    
    return success_count, errors

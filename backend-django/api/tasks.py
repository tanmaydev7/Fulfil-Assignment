"""
Celery tasks for the api app.
"""
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from .models import Product, Webhook
import pandas as pd
import os
import gc
from django.db import transaction


@shared_task
def bulk_delete_products(product_ids):
    """
    Celery task to delete multiple products in the background.
    Optimized for memory efficiency by processing in batches.
    
    Args:
        product_ids: List of product IDs to delete
    
    Returns:
        dict: Results with deleted count and any errors
    """
    deleted_count = 0
    errors = []
    BATCH_SIZE = 10  # Process in batches to avoid memory issues
    
    try:
        # Process in batches to avoid loading all products into memory
        for i in range(0, len(product_ids), BATCH_SIZE):
            batch_ids = product_ids[i:i + BATCH_SIZE]
            
            with transaction.atomic():
                # Check which IDs exist before deleting
                existing_ids = set(Product.objects.filter(id__in=batch_ids).values_list('id', flat=True))
                
                # Use bulk delete for efficiency
                deleted_batch = Product.objects.filter(id__in=batch_ids).delete()[0]
                deleted_count += deleted_batch
                
                # Check for any IDs that weren't found
                for product_id in batch_ids:
                    if product_id not in existing_ids:
                        errors.append(f"Product with id '{product_id}' not found")
                
                # Clear from memory
                del existing_ids
            
            # Force garbage collection after each batch
            gc.collect()
        
        result = {
            "deleted": deleted_count,
            "total": len(product_ids),
            "errors": errors if errors else None
        }
        
        # Trigger webhook for product.bulk_deleted after async deletion completes
        # Use only count, not full list of IDs to reduce memory
        trigger_webhooks_task.apply_async(args=['product.bulk_deleted', {
            "deleted": deleted_count,
            "total": len(product_ids),
            "ids": []  # Don't include full ID list in payload to save memory
        }])
        
        return result
    except Exception as e:
        raise ValueError(f"Bulk delete failed: {str(e)}")


@shared_task
def trigger_webhooks_task(event_type, payload):
    """
    Celery task to trigger webhooks for a given event type.
    This task fetches webhooks from the database and triggers them asynchronously.
    Optimized for memory efficiency.
    
    Args:
        event_type: The event type (e.g., 'product.created', 'product.updated')
        payload: The payload data to send to webhooks
    
    Returns:
        dict: Number of webhooks triggered
    """
    try:
        from .models import Webhook
        
        # Get all enabled webhooks and filter in Python to avoid JSONField query issues
        # Use values_list to avoid loading full objects into memory
        all_webhooks = Webhook.objects.filter(enabled=True).values_list('id', 'event_types')
        
        # Filter webhooks that subscribe to this event type
        webhook_ids = [
            webhook_id for webhook_id, event_types in all_webhooks
            if event_type in (event_types or [])
        ]
        
        # Clear from memory
        del all_webhooks
        
        # Trigger each webhook asynchronously
        for webhook_id in webhook_ids:
            send_webhook.delay(webhook_id, event_type, payload)
        
        # Clear the list from memory
        webhook_count = len(webhook_ids)
        del webhook_ids
        gc.collect()
        
        return {
            "success": True,
            "webhooks_triggered": webhook_count,
            "event_type": event_type
        }
    except Exception as e:
        # Don't fail the main operation if webhook triggering fails
        print(f"Error triggering webhooks: {e}")
        return {
            "success": False,
            "error": str(e),
            "webhooks_triggered": 0
        }


@shared_task
def send_webhook(webhook_id, event_type, payload):
    """
    Celery task to send webhook request asynchronously.
    
    Args:
        webhook_id: ID of the webhook configuration
        event_type: Type of event that triggered the webhook
        payload: Data payload to send
    
    Returns:
        dict: Response details with status code, response time, and any errors
    """
    import requests
    import time
    from django.utils import timezone
    
    try:
        webhook = Webhook.objects.get(id=webhook_id, enabled=True)
    except Webhook.DoesNotExist:
        return {
            "success": False,
            "error": f"Webhook {webhook_id} not found or disabled"
        }
    
    # Prepare request data
    request_headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event_type,
        'User-Agent': 'Django-Webhook-Client/1.0',
    }
    
    # Add custom headers
    if webhook.headers:
        request_headers.update(webhook.headers)
    
    # Add signature if secret is provided
    if webhook.secret:
        import hmac
        import hashlib
        import json
        payload_str = json.dumps(payload, sort_keys=True)
        signature = hmac.new(
            webhook.secret.encode('utf-8'),
            payload_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        request_headers['X-Webhook-Signature'] = f'sha256={signature}'
    
    # Prepare full payload
    full_payload = {
        'event': event_type,
        'timestamp': timezone.now().isoformat(),
        'data': payload
    }
    
    # Send request with retries
    response_code = None
    response_time = None
    error_message = None
    
    for attempt in range(webhook.retry_count):
        try:
            start_time = time.time()
            response = requests.post(
                webhook.url,
                json=full_payload,
                headers=request_headers,
                timeout=webhook.timeout
            )
            response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            response_code = response.status_code
            
            # Update webhook with last trigger info
            webhook.last_triggered_at = timezone.now()
            webhook.last_response_code = response_code
            webhook.last_response_time = response_time
            webhook.save(update_fields=['last_triggered_at', 'last_response_code', 'last_response_time'])
            
            if response.status_code < 400:
                return {
                    "success": True,
                    "status_code": response_code,
                    "response_time_ms": response_time,
                    "attempt": attempt + 1
                }
            else:
                error_message = f"HTTP {response.status_code}: {response.text[:200]}"
                
        except requests.exceptions.Timeout:
            error_message = f"Request timeout after {webhook.timeout}s"
        except requests.exceptions.ConnectionError:
            error_message = "Connection error - unable to reach webhook URL"
        except Exception as e:
            error_message = f"Unexpected error: {str(e)}"
        
        # If not last attempt, wait before retry
        if attempt < webhook.retry_count - 1:
            time.sleep(2 ** attempt)  # Exponential backoff
    
    # All retries failed
    webhook.last_triggered_at = timezone.now()
    webhook.last_response_code = response_code or 0
    webhook.last_response_time = response_time
    webhook.save(update_fields=['last_triggered_at', 'last_response_code', 'last_response_time'])
    
    return {
        "success": False,
        "status_code": response_code,
        "response_time_ms": response_time,
        "error": error_message,
        "attempts": webhook.retry_count
    }


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
    success_count = 0
    chunksize = 10  # Read and process CSV in chunks of 100 rows
    
    try:
        # Validate CSV columns first
        column_validation = _validate_csv_columns(file_path)
        if not column_validation['valid']:
            if os.path.exists(file_path):
                os.remove(file_path)
            # Raise exception so Celery marks task as FAILURE
            raise ValueError(column_validation['error'])
        
        # Process CSV in chunks with smaller transactions to reduce memory usage
        row_number = 0
        batch_errors = []
        
        # Read CSV file in chunks and process each chunk as a batch
        for chunk_df in pd.read_csv(file_path, encoding='utf-8', chunksize=chunksize):
            # Replace NaN values with empty strings
            chunk_df = chunk_df.fillna('')
            
            # Prepare batch for this chunk
            batch = []
            
            # Validate and prepare each row in chunk
            for _, row in chunk_df.iterrows():
                row_number += 1
                product_data = row.to_dict()
                
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
            
            # Process each chunk in its own transaction to reduce memory usage
            if batch:
                with transaction.atomic():
                    batch_success, batch_errors = _process_batch(batch)
                    success_count += batch_success
                    if batch_errors:
                        # If any batch write fails, raise exception
                        if os.path.exists(file_path):
                            os.remove(file_path)
                        raise ValueError(f"Batch write failed: {batch_errors[0]}")
            
            # Clear chunk from memory and force garbage collection
            del chunk_df, batch
            gc.collect()
        
        # Clean up file after successful processing
        if os.path.exists(file_path):
            os.remove(file_path)
        
        result = {
            'success': True,
            'success_count': success_count,
            'error_count': 0,
            'total_processed': success_count,
        }
        
        # Trigger webhook for product.uploaded after successful upload
        trigger_webhooks_task.apply_async(args=['product.uploaded', {
            "success_count": success_count,
            "total_processed": success_count,
            "upload_type": "csv"
        }])
        
        return result
    
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
    Optimized for memory efficiency.
    Returns (success_count, errors).
    Raises exception if any write fails.
    """
    success_count = 0
    errors = []
    
    # Get existing SKUs - use iterator to avoid loading all into memory
    batch_skus = [item['sku'] for item in batch]
    existing_skus = set(
        Product.objects.filter(sku__in=batch_skus)
        .values_list('sku', flat=True)
        .iterator(chunk_size=100)
    )
    
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
            Product.objects.bulk_create(products_to_create, ignore_conflicts=False, batch_size=100)
            success_count += len(products_to_create)
            # Clear from memory
            del products_to_create
        except Exception as e:
            raise ValueError(f"Failed to create products: {str(e)}")
    
    # Bulk update existing products - use bulk_update with queryset
    if to_update:
        # Get all products to update in one query
        update_skus = [item['sku'] for item in to_update]
        products_to_update = list(
            Product.objects.filter(sku__in=update_skus)
            .only('id', 'sku', 'name', 'description', 'status')
        )
        
        # Create a mapping for quick lookup
        sku_to_data = {item['sku']: item for item in to_update}
        
        # Update products in memory
        for product in products_to_update:
            if product.sku in sku_to_data:
                data = sku_to_data[product.sku]
                product.name = data['name']
                product.description = data['description']
                product.status = data['status']
        
        if products_to_update:
            try:
                Product.objects.bulk_update(
                    products_to_update,
                    ['name', 'description', 'status'],
                    batch_size=100
                )
                success_count += len(products_to_update)
                # Clear from memory
                del products_to_update, sku_to_data
            except Exception as e:
                raise ValueError(f"Failed to update products: {str(e)}")
    
    # Clear batch data from memory
    del batch, existing_skus, to_create, to_update
    gc.collect()
    
    return success_count, errors

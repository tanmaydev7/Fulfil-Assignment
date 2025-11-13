from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import os
from celery.result import AsyncResult
from basic_auth_app.celery import app as celery_app
from django_celery_results.models import TaskResult
from .models import Product
from .tasks import add_numbers
from .serializers import AddNumbersSerializer, ProductSerializer
from .utils import (
    generate_successful_response, 
    generate_error_response,
    handle_chunked_upload,
    handle_complete_upload
)


class AddNumbersView(APIView):
    """
    API view that triggers a background job to add two numbers.
    """
    
    def post(self, request):
        """
        Accepts two numbers and triggers a background Celery task to add them.
        
        Request body:
        {
            "x": 10,
            "y": 20
        }
        
        Returns:
        {
            "message": {
                "task_id": "task-uuid",
                "status": "PENDING",
                "message": "Task has been queued successfully"
            }
        }
        """

        try:
            serializer = AddNumbersSerializer(data=request.data)
        
            if serializer.is_valid():
                x = serializer.validated_data['x']
                y = serializer.validated_data['y']
                
                # Trigger the background task
                task = add_numbers.apply_async([
                    x,
                    y
                ])
                
                return generate_successful_response(
                    {
                        "task_id": task.id,
                        "status": "PENDING",
                        "message": f"Task to add {x} + {y} has been queued successfully"
                    },
                    status=status.HTTP_202_ACCEPTED
                )
            
            return generate_error_response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        except Exception as e:

            print(e)

            return generate_error_response(
                str(e),
                status=status.HTTP_400_BAD_REQUEST
            )


class ProductUploadView(APIView):
    """
    API view that handles chunked file upload for product import.
    Supports both chunked and complete file uploads.
    """
    
    def post(self, request):
        """
        Handles chunked file upload for product CSV files.
        Only CSV files are supported.
        
        For chunked upload:
        - file: The file chunk data (required)
        - upload_id: Unique identifier for this upload session (optional, generated on first chunk)
        - end: 1 if this is the last chunk, 0 otherwise (required for chunked upload)
        
        For complete file upload (non-chunked):
        - file: Complete CSV file (no 'end' parameter)
        
        Returns:
        First chunk:
        {
            "message": {
                "upload_id": "generated-uuid",
                "message": "Chunk received successfully",
                "upload_complete": false
            }
        }
        
        Intermediate chunks:
        {
            "message": {
                "upload_id": "same-uuid",
                "message": "Chunk received successfully",
                "upload_complete": false
            }
        }
        
        Last chunk (end=1):
        {
            "message": {
                "task_id": "task-uuid",
                "status": "PENDING",
                "message": "File uploaded completely and processing started",
                "upload_complete": true,
                "upload_id": "same-uuid"
            }
        }
        """
        try:
            file = request.FILES.get('file')
            upload_id = request.data.get('upload_id')  # Optional, generated on first chunk
            end = request.data.get('end', 0)  # 1 if last chunk, 0 otherwise
            
            if not file:
                return generate_error_response(
                    "File is required",
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file chunk size (max 5MB)
            MAX_CHUNK_SIZE = 5 * 1024 * 1024  # 5MB in bytes
            if file.size > MAX_CHUNK_SIZE:
                return generate_error_response(
                    f"File chunk size ({file.size / (1024 * 1024):.2f} MB) exceeds maximum allowed size of 5 MB",
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Ensure media directory exists
            media_root = settings.MEDIA_ROOT
            uploads_dir = os.path.join(media_root, 'uploads')
            os.makedirs(uploads_dir, exist_ok=True)
            
            # Check if this is a chunked upload (end parameter present) or complete upload
            if 'end' in request.data:
                # Handle chunked upload
                return handle_chunked_upload(
                    file, upload_id, end, uploads_dir
                )
            else:
                # Handle complete file upload
                return handle_complete_upload(file, uploads_dir)
        
        except Exception as e:
            print(f"Upload error: {e}")
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TaskStatusView(APIView):
    """
    API view to check the status of a Celery task.
    """
    
    def get(self, request, task_id):
        """
        Get the status of a Celery task.
        
        Returns:
        {
            "message": {
                "task_id": "task-uuid",
                "state": "PENDING|STARTED|SUCCESS|FAILURE",
                "result": {...},
                "error": "..."
            }
        }
        """
        try:
            # Use AsyncResult to get real-time task status
            task_result = AsyncResult(task_id, app=celery_app)
            
            result_data = {
                "task_id": task_id,
                "state": task_result.state,
            }
            
            # If task is ready, get the result
            if task_result.ready():
                if task_result.successful():
                    result_data["result"] = task_result.result
                else:
                    # Task failed - extract error message
                    error_message = "Task failed"
                    if task_result.info:
                        # If info is an exception, get its message
                        if isinstance(task_result.info, Exception):
                            error_message = str(task_result.info)
                        else:
                            error_message = str(task_result.info)
                    
                    result_data["error"] = error_message
                    
                    # Try to get more details from database if available
                    try:
                        db_result = TaskResult.objects.filter(task_id=task_id).first()
                        if db_result:
                            # Prefer traceback if available (more detailed)
                            if db_result.traceback:
                                # Extract just the error message from traceback (last line usually has the error)
                                traceback_lines = db_result.traceback.split('\n')
                                if traceback_lines:
                                    # Get the last meaningful line (usually the exception message)
                                    for line in reversed(traceback_lines):
                                        if line.strip() and not line.strip().startswith('File'):
                                            error_message = line.strip()
                                            break
                                result_data["error"] = error_message
                            elif db_result.result:
                                try:
                                    import json
                                    error_info = json.loads(db_result.result) if isinstance(db_result.result, str) else db_result.result
                                    if isinstance(error_info, dict) and "error" in error_info:
                                        result_data["error"] = error_info.get("error", error_message)
                                except:
                                    pass
                    except:
                        pass
            else:
                # Task is still pending or in progress
                # Try to get additional info from database if available
                try:
                    db_result = TaskResult.objects.filter(task_id=task_id).first()
                    if db_result:
                        result_data["state"] = db_result.status
                        if db_result.result:
                            try:
                                import json
                                result_data["result"] = json.loads(db_result.result) if isinstance(db_result.result, str) else db_result.result
                            except:
                                result_data["result"] = db_result.result
                except:
                    pass
            
            return generate_successful_response(result_data)
        
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProductListView(APIView):
    """
    API view to get paginated list of products.
    """
    
    def get(self, request):
        """
        Get paginated list of products.
        
        Query parameters:
        - limit: Number of products to return (default: 100, max: 1000)
        - offset: Number of products to skip (default: 0)
        
        Returns:
        {
            "message": {
                "count": 1000,
                "limit": 100,
                "offset": 0,
                "results": [...]
            }
        }
        """
        try:
            # Get and validate limit
            limit = int(request.query_params.get('limit', 100))
            
            if limit > 1000:
                return generate_error_response(
                    "Limit can't be greater than 1000",
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get and validate offset
            offset = request.query_params.get('offset', 0)
            try:
                offset = int(offset)
                if offset < 0:
                    offset = 0
            except (ValueError, TypeError):
                offset = 0
            
            # Get total count (optimized single query)
            total_count = Product.objects.count()
            
            # Get paginated products ordered by updated_at descending (newest first)
            products = Product.objects.all().order_by('-updated_at')[offset:offset + limit]
            
            # Serialize products
            serializer = ProductSerializer(products, many=True)
            
            return generate_successful_response({
                'count': total_count,
                'limit': limit,
                'offset': offset,
                'results': serializer.data
            })
        
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProductEditView(APIView):
    """
    API view to create, update, and delete products.
    POST: Create a new product
    PATCH: Update an existing product
    DELETE: Delete a product by ID
    """
    
    def post(self, request):
        """
        Create a new product.
        
        Request body:
        {
            "sku": "PROD-001",
            "name": "Product Name",
            "description": "Product description"
        }
        
        Returns:
        {
            "message": {
                "sku": "PROD-001",
                "name": "Product Name",
                "description": "Product description",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
        }
        """
        try:
            # Create a copy of request data and ensure status is set to active
            product_data = request.data.copy()
            product_data['status'] = 'active'
            
            serializer = ProductSerializer(data=product_data)
            
            if serializer.is_valid():
                # Save product with active status
                product = serializer.save()
                return generate_successful_response(
                    ProductSerializer(product).data,
                    status=status.HTTP_201_CREATED
                )
            else:
                return generate_error_response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request):
        """
        Update products - supports both single and batch updates.
        
        Single update request body:
        {
            "id": 1,  # Product ID to identify the product (required)
            "sku": "PROD-001",  # Optional: can be updated
            "name": "Updated Product Name",
            "description": "Updated description",
            "status": "active" or "inactive"
        }
        
        Batch update request body:
        {
            "update_operations": [
                {
                    "id": 1,
                    "sku": "PROD-001",
                    "name": "Updated Product Name",
                    "description": "Updated description",
                    "status": "active"
                },
                {
                    "id": 2,
                    "sku": "PROD-002",
                    "name": "Another Product",
                    "status": "inactive"
                }
            ]
        }
        
        Note: 
        - For single update: "id" is required in the payload to identify the product.
        - For batch update: "update_operations" array is required.
        - SKU can be updated but must remain unique.
        - All other fields are optional.
        
        Returns:
        Single update:
        {
            "message": {
                "id": 1,
                "sku": "PROD-001",
                "name": "Updated Product Name",
                "description": "Updated description",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
        }
        
        Batch update:
        {
            "message": {
                "updated": 2,
                "results": [
                    {...product1...},
                    {...product2...}
                ]
            }
        }
        """
        try:
            from django.db import transaction
            
            # Check if this is a batch update
            update_operations = request.data.get('update_operations')
            
            if update_operations:
                # Batch update
                if not isinstance(update_operations, list):
                    return generate_error_response(
                        "update_operations must be an array",
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if len(update_operations) == 0:
                    return generate_error_response(
                        "update_operations array cannot be empty",
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                updated_products = []
                errors = []
                
                with transaction.atomic():
                    for idx, operation in enumerate(update_operations):
                        product_id = operation.get('id')
                        
                        if not product_id:
                            errors.append(f"Operation {idx + 1}: id is required")
                            continue
                        
                        try:
                            product = Product.objects.get(id=product_id)
                        except Product.DoesNotExist:
                            errors.append(f"Operation {idx + 1}: Product with id '{product_id}' not found")
                            continue
                        
                        # Prepare update data (exclude id)
                        update_data = {k: v for k, v in operation.items() if k != 'id'}
                        
                        serializer = ProductSerializer(product, data=update_data, partial=True)
                        
                        if serializer.is_valid():
                            updated_product = serializer.save()
                            updated_products.append(ProductSerializer(updated_product).data)
                        else:
                            errors.append(f"Operation {idx + 1}: {serializer.errors}")
                    
                    if errors:
                        return generate_error_response(
                            {"errors": errors, "updated": len(updated_products)},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                return generate_successful_response({
                    "updated": len(updated_products),
                    "results": updated_products
                })
            
            else:
                # Single update (backward compatibility)
                product_id = request.data.get('id')
                
                if not product_id:
                    return generate_error_response(
                        "id is required in request body to identify the product",
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get the product
                try:
                    product = Product.objects.get(id=product_id)
                except Product.DoesNotExist:
                    return generate_error_response(
                        f"Product with id '{product_id}' not found",
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                # Update product with partial data (id is read-only, so exclude it from update)
                update_data = request.data.copy()
                # Remove id from update data as it's the primary key and shouldn't be changed
                update_data.pop('id', None)
                
                serializer = ProductSerializer(product, data=update_data, partial=True)
                
                if serializer.is_valid():
                    updated_product = serializer.save()
                    return generate_successful_response(
                        ProductSerializer(updated_product).data,
                        status=status.HTTP_200_OK
                    )
                else:
                    return generate_error_response(
                        serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request):
        """
        Delete a product by ID.
        
        Request body:
        {
            "id": 1  # Product ID to delete (required)
        }
        
        Returns:
        {
            "message": {
                "id": 1,
                "message": "Product deleted successfully"
            }
        }
        """
        try:
            # Get ID from request data
            product_id = request.data.get('id')
            
            if not product_id:
                return generate_error_response(
                    "id is required in request body to identify the product to delete",
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the product
            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                return generate_error_response(
                    f"Product with id '{product_id}' not found",
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Delete the product
            product.delete()
            
            return generate_successful_response(
                {
                    "id": product_id,
                    "message": "Product deleted successfully"
                },
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


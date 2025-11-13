from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import os
from celery.result import AsyncResult
from basic_auth_app.celery import app as celery_app
from django_celery_results.models import TaskResult
from .tasks import add_numbers
from .serializers import AddNumbersSerializer
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


from rest_framework.response import Response
from rest_framework import status
from .models import Webhook
from .tasks import send_webhook
from django.http import HttpResponseRedirect
import os
import uuid
import pandas as pd
from .tasks import process_product_file


def generate_successful_response(data, status:int = status.HTTP_200_OK):
    # default status code = 200 represents success
    return Response({"message": data}, status = status)

def generate_error_response(message, status:int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    # default status code = 500 represents server error or unknown error
    #if there is no server error or unknown error, pass status_code that is valid for such error
    print("Error occurred: ", message)
    return Response({"message": message}, status = status)

def redirect(redirect_to: str ='/'):
    return HttpResponseRedirect(redirect_to)


def handle_chunked_upload(file, upload_id, end, uploads_dir):
    """
    Handle chunked file upload using append mode.
    
    Args:
        file: The file chunk to append
        upload_id: Upload ID (generated on first chunk if not provided)
        end: 1 if this is the last chunk, 0 otherwise
        uploads_dir: Directory to save uploads
    
    Returns:
        Response with upload_id (first chunk) or task_id (last chunk) or status (intermediate chunks)
    """
    try:
        is_last_chunk = int(end) == 1 if end else 0
        
        # Generate upload_id if not provided (first chunk)
        if not upload_id:
            upload_id = str(uuid.uuid4())
        
        # Validate file extension on first chunk (when file is being created)
        final_file_path = os.path.join(uploads_dir, f'{upload_id}.csv')
        is_first_chunk = not os.path.exists(final_file_path)
        
        
        # Append chunk to file using 'ab' mode
        with open(final_file_path, 'ab') as f:
            for chunk in file.chunks():
                f.write(chunk)
        
        # If this is the last chunk, validate and process
        if is_last_chunk:
            # Validate CSV file
            if not validate_csv_file(final_file_path):
                # Clean up invalid file
                if os.path.exists(final_file_path):
                    os.remove(final_file_path)
                return generate_error_response(
                    "Invalid CSV file format. Only CSV files are supported.",
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Trigger background processing
            task = process_product_file.apply_async([final_file_path])
            
            return generate_successful_response(
                {
                    "task_id": task.id,
                    "status": "PENDING",
                    "message": "File uploaded completely and processing started",
                    "upload_complete": True,
                    "upload_id": upload_id
                },
                status=status.HTTP_202_ACCEPTED
            )
        else:
            # More chunks expected - return upload_id for client to use in next requests
            return generate_successful_response(
                {
                    "upload_id": upload_id,
                    "message": "Chunk received successfully",
                    "upload_complete": False
                },
                status=status.HTTP_200_OK
            )
    
    except (ValueError, TypeError) as e:
        return generate_error_response(
            f"Invalid chunk parameters: {str(e)}",
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return generate_error_response(
            f"Error processing chunk: {str(e)}",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def handle_complete_upload(file, uploads_dir):
    """Handle complete file upload (non-chunked)."""
    
    # Generate unique filename
    upload_id = str(uuid.uuid4())
    final_file_path = os.path.join(uploads_dir, f'{upload_id}.csv')
    
    # Save file
    with open(final_file_path, 'wb') as f:
        for chunk in file.chunks():
            f.write(chunk)
    
    # Validate CSV file
    if not validate_csv_file(final_file_path):
        return generate_error_response(
            "Invalid CSV file format. Please ensure the file is a valid CSV file.",
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Trigger background processing
    task = process_product_file.apply_async([final_file_path])
    
    return generate_successful_response(
        {
            "task_id": task.id,
            "status": "PENDING",
            "message": "File uploaded and processing started",
            "upload_complete": True
        },
        status=status.HTTP_202_ACCEPTED
    )


def validate_csv_file(file_path):
    """Validate that the file is a valid CSV file."""
    try:
        # Try to read the CSV file to validate it
        pd.read_csv(file_path, nrows=1)  # Read just first row to validate
        return True
    except Exception as e:
        print(f"CSV validation error: {e}")
        return False


def trigger_webhooks(event_type, payload):
    """
    Trigger webhooks for a given event type.
    
    Args:
        event_type: The event type (e.g., 'product.created', 'product.updated')
        payload: The payload data to send to webhooks
    
    Returns:
        Number of webhooks triggered
    """
    try:
        # Get all enabled webhooks
        all_webhooks = Webhook.objects.filter(enabled=True)
        
        # Filter webhooks that subscribe to this event type
        # JSONField contains check - event_type must be in the event_types array
        webhooks = [
            webhook for webhook in all_webhooks
            if event_type in (webhook.event_types or [])
        ]
        
        # Trigger each webhook asynchronously
        for webhook in webhooks:
            send_webhook.delay(webhook.id, event_type, payload)
        
        return len(webhooks)
    except Exception as e:
        # Don't fail the main operation if webhook triggering fails
        print(f"Error triggering webhooks: {e}")
        return 0



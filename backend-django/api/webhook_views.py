from rest_framework.views import APIView
from rest_framework import status
from django.utils import timezone
import requests
import time
import hmac
import hashlib
import json
from .models import Webhook
from .serializers import WebhookSerializer
from .utils import generate_successful_response, generate_error_response


class WebhookListView(APIView):
    """
    API view to list and create webhooks.
    """
    
    def get(self, request):
        """
        Get list of all webhooks.
        
        Returns:
        {
            "message": [
                {...webhook1...},
                {...webhook2...}
            ]
        }
        """
        try:
            webhooks = Webhook.objects.all()
            serializer = WebhookSerializer(webhooks, many=True)
            return generate_successful_response(serializer.data)
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """
        Create a new webhook.
        
        Request body:
        {
            "url": "https://example.com/webhook",
            "name": "My Webhook",
            "event_types": ["product.created", "product.updated"],
            "enabled": true,
            "secret": "optional-secret-key",
            "headers": {"Authorization": "Bearer token"},
            "timeout": 30,
            "retry_count": 3
        }
        
        Returns:
        {
            "message": {...webhook...}
        }
        """
        try:
            serializer = WebhookSerializer(data=request.data)
            if serializer.is_valid():
                webhook = serializer.save()
                return generate_successful_response(
                    WebhookSerializer(webhook).data,
                    status=status.HTTP_201_CREATED
                )
            return generate_error_response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WebhookDetailView(APIView):
    """
    API view to get, update, and delete a specific webhook.
    """
    
    def get(self, request, webhook_id):
        """
        Get a specific webhook by ID.
        
        Returns:
        {
            "message": {...webhook...}
        }
        """
        try:
            webhook = Webhook.objects.get(id=webhook_id)
            serializer = WebhookSerializer(webhook)
            return generate_successful_response(serializer.data)
        except Webhook.DoesNotExist:
            return generate_error_response(
                f"Webhook with id '{webhook_id}' not found",
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request, webhook_id):
        """
        Update a webhook.
        
        Request body (partial update):
        {
            "enabled": false,
            "event_types": ["product.created"],
            ...
        }
        
        Returns:
        {
            "message": {...updated webhook...}
        }
        """
        try:
            webhook = Webhook.objects.get(id=webhook_id)
            serializer = WebhookSerializer(webhook, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return generate_successful_response(serializer.data)
            return generate_error_response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        except Webhook.DoesNotExist:
            return generate_error_response(
                f"Webhook with id '{webhook_id}' not found",
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, webhook_id):
        """
        Delete a webhook.
        
        Returns:
        {
            "message": {
                "id": webhook_id,
                "message": "Webhook deleted successfully"
            }
        }
        """
        try:
            webhook = Webhook.objects.get(id=webhook_id)
            webhook_id_val = webhook.id
            webhook.delete()
            return generate_successful_response({
                "id": webhook_id_val,
                "message": "Webhook deleted successfully"
            })
        except Webhook.DoesNotExist:
            return generate_error_response(
                f"Webhook with id '{webhook_id}' not found",
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return generate_error_response(
                str(e),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WebhookTestView(APIView):
    """
    API view to test a webhook by sending a test request.
    """
    
    def post(self, request, webhook_id):
        """
        Test a webhook by sending a test payload.
        
        Request body (optional):
        {
            "payload": {...custom test payload...}
        }
        
        Returns:
        {
            "message": {
                "success": true,
                "status_code": 200,
                "response_time_ms": 45.2,
                "response_body": "..."
            }
        }
        """
        try:
            webhook = Webhook.objects.get(id=webhook_id)
        except Webhook.DoesNotExist:
            return generate_error_response(
                f"Webhook with id '{webhook_id}' not found",
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Use custom payload if provided, otherwise use default test payload
        test_payload = request.data.get('payload', {
            'test': True,
            'message': 'This is a test webhook trigger',
            'timestamp': timezone.now().isoformat()
        })
        
        # Trigger webhook synchronously for testing
        # Prepare request data (same logic as in send_webhook task)
        request_headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'test',
            'User-Agent': 'Django-Webhook-Client/1.0',
        }
        
        # Add custom headers
        if webhook.headers:
            request_headers.update(webhook.headers)
        
        # Add signature if secret is provided
        if webhook.secret:
            payload_str = json.dumps(test_payload, sort_keys=True)
            signature = hmac.new(
                webhook.secret.encode('utf-8'),
                payload_str.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            request_headers['X-Webhook-Signature'] = f'sha256={signature}'
        
        # Prepare full payload
        full_payload = {
            'event': 'test',
            'timestamp': timezone.now().isoformat(),
            'data': test_payload
        }
        
        # Send request synchronously (single attempt for testing)
        response_code = None
        response_time = None
        error_message = None
        
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
                result = {
                    "success": True,
                    "status_code": response_code,
                    "response_time_ms": response_time,
                }
            else:
                error_message = f"HTTP {response.status_code}: {response.text[:200]}"
                result = {
                    "success": False,
                    "status_code": response_code,
                    "response_time_ms": response_time,
                    "error": error_message
                }
        except requests.exceptions.Timeout:
            error_message = f"Request timeout after {webhook.timeout}s"
            result = {
                "success": False,
                "error": error_message
            }
        except requests.exceptions.ConnectionError:
            error_message = "Connection error - unable to reach webhook URL"
            result = {
                "success": False,
                "error": error_message
            }
        except Exception as e:
            error_message = f"Unexpected error: {str(e)}"
            result = {
                "success": False,
                "error": error_message
            }
        
        if result.get('success'):
            return generate_successful_response({
                "success": True,
                "status_code": result.get('status_code'),
                "response_time_ms": result.get('response_time_ms'),
                "message": "Webhook test successful"
            })
        else:
            return generate_error_response(
                {
                    "success": False,
                    "status_code": result.get('status_code'),
                    "response_time_ms": result.get('response_time_ms'),
                    "error": result.get('error', 'Unknown error')
                },
                status=status.HTTP_400_BAD_REQUEST
            )


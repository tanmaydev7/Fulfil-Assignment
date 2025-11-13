from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .tasks import add_numbers
from .serializers import AddNumbersSerializer
from .utils import generate_successful_response, generate_error_response


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


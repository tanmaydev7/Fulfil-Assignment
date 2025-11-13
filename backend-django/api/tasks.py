"""
Celery tasks for the api app.
"""
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


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


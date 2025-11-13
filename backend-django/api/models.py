from django.db import models
from decimal import Decimal
import random

# Create your models here.


class Product(models.Model):
    """
    Product model with sku as primary key.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]
    
    sku = models.TextField(primary_key=True, help_text="Stock Keeping Unit - unique identifier")
    name = models.TextField(help_text="Product name")
    description = models.TextField(help_text="Product description")
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='active',
        help_text="Product status: active or inactive"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'products'
        ordering = ['sku']
    
    def __str__(self):
        return f"{self.sku} - {self.name}"

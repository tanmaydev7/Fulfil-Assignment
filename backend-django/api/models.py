from django.db import models
from decimal import Decimal
import random

# Create your models here.


class Product(models.Model):
    """
    Product model with id as primary key and sku as unique identifier.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]
    
    id = models.AutoField(primary_key=True, help_text="Primary key identifier")
    sku = models.TextField(unique=True, help_text="Stock Keeping Unit - unique identifier")
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
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.sku} - {self.name}"


class Webhook(models.Model):
    """
    Webhook model for configuring webhook endpoints.
    """
    EVENT_TYPES = [
        ('product.created', 'Product Created'),
        ('product.updated', 'Product Updated'),
        ('product.deleted', 'Product Deleted'),
        ('product.bulk_updated', 'Product Bulk Updated'),
        ('product.bulk_deleted', 'Product Bulk Deleted'),
    ]
    
    id = models.AutoField(primary_key=True, help_text="Primary key identifier")
    url = models.URLField(max_length=500, help_text="Webhook URL endpoint")
    name = models.CharField(max_length=200, help_text="Webhook name/description")
    event_types = models.JSONField(
        default=list,
        help_text="List of event types to trigger this webhook (e.g., ['product.created', 'product.updated'])"
    )
    enabled = models.BooleanField(default=True, help_text="Whether the webhook is enabled")
    secret = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Optional secret key for webhook signature verification"
    )
    headers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom headers to include in webhook requests (JSON object)"
    )
    timeout = models.IntegerField(
        default=30,
        help_text="Request timeout in seconds"
    )
    retry_count = models.IntegerField(
        default=3,
        help_text="Number of retry attempts on failure"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True, help_text="Last time webhook was triggered")
    last_response_code = models.IntegerField(null=True, blank=True, help_text="Last HTTP response code received")
    last_response_time = models.FloatField(null=True, blank=True, help_text="Last response time in milliseconds")
    
    class Meta:
        db_table = 'webhooks'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.url}"

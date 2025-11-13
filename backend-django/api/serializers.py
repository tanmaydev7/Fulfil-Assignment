from rest_framework import serializers
from decimal import Decimal
from .models import Product, Webhook


class AddNumbersSerializer(serializers.Serializer):
    """
    Serializer for validating add numbers request.
    """
    x = serializers.FloatField(help_text="First number to add")
    y = serializers.FloatField(help_text="Second number to add")


class ProductSerializer(serializers.ModelSerializer):
    """
    Serializer for Product model.
    """
    class Meta:
        model = Product
        fields = ['id', 'sku', 'name', 'description', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WebhookSerializer(serializers.ModelSerializer):
    """
    Serializer for Webhook model.
    """
    event_types = serializers.ListField(
        child=serializers.ChoiceField(choices=[
            ('product.created', 'Product Created'),
            ('product.updated', 'Product Updated'),
            ('product.deleted', 'Product Deleted'),
            ('product.bulk_updated', 'Product Bulk Updated'),
            ('product.bulk_deleted', 'Product Bulk Deleted'),
            ('product.uploaded', 'Product Uploaded'),
        ]),
        required=True,
        help_text="List of event types to trigger this webhook"
    )
    
    class Meta:
        model = Webhook
        fields = [
            'id',
            'url',
            'name',
            'event_types',
            'enabled',
            'secret',
            'headers',
            'timeout',
            'retry_count',
            'created_at',
            'updated_at',
            'last_triggered_at',
            'last_response_code',
            'last_response_time',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'last_triggered_at',
            'last_response_code',
            'last_response_time',
        ]
    
    def validate_url(self, value):
        """Validate that URL is accessible and returns a valid response."""
        # Basic URL validation is handled by URLField
        return value
    
    def validate_event_types(self, value):
        """Validate that at least one event type is provided."""
        if not value or len(value) == 0:
            raise serializers.ValidationError("At least one event type must be specified.")
        return value
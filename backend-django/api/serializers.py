from rest_framework import serializers
from decimal import Decimal
from .models import Product


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
        fields = ['sku', 'name', 'description', 'status', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
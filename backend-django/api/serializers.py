from rest_framework import serializers
from decimal import Decimal


class AddNumbersSerializer(serializers.Serializer):
    """
    Serializer for validating add numbers request.
    """
    x = serializers.FloatField(help_text="First number to add")
    y = serializers.FloatField(help_text="Second number to add")
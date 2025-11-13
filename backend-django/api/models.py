from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
import random

# Create your models here.


class Product(models.Model):
    """Product model for price optimization system"""
    
    # Product identification
    product_id = models.AutoField(primary_key=True)
    name = models.CharField(
        max_length=255, 
        unique=True,
        db_index=True,
        verbose_name="Product Name"
    )
    description = models.TextField(blank=True, null=True, verbose_name="Product Description")
    
    # Pricing information
    cost_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Cost Price"
    )
    selling_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Selling Price"
    )
    
    # Product categorization
    category = models.CharField(max_length=100, verbose_name="Product Category")
    
    # Inventory and sales tracking
    stock_available = models.PositiveIntegerField(
        default=0,
        verbose_name="Stock Available"
    )
    units_sold = models.PositiveIntegerField(
        default=0,
        verbose_name="Units Sold"
    )
    
    # Customer feedback and demand forecasting
    customer_rating = models.DecimalField(
        max_digits=3, 
        decimal_places=2, 
        validators=[
            MinValueValidator(Decimal('1.00')), 
            MaxValueValidator(Decimal('5.00'))
        ],
        verbose_name="Customer Rating (1-5)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'products'
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} (ID: {self.product_id})"
    
    def generate_random_rating(self):
        """Generate a random customer rating between 1.00 and 5.00"""
        return Decimal(str(round(random.uniform(1.0, 5.0), 2)))
    
    @property
    def demand_forecast(self):
        """
        Calculate demand forecast using the formula:
        Demand Forecast = units_sold × (1 + α × (customer_rating - 3))
        
        Where:
        - units_sold = observed sales so far
        - customer_rating = 1–5 scale
        - α = sensitivity factor (0.2 → every star above/below 3 changes demand by 20%)
        """
        alpha = Decimal('0.2')  # sensitivity factor
        rating_deviation = self.customer_rating - Decimal('3.00')
        demand_multiplier = Decimal('1.00') + (alpha * rating_deviation)
        
        return int(self.units_sold * demand_multiplier)
    
    @property
    def optimized_price(self):
        """
        Calculate optimized price using the formula:
        Optimized Price = cost_price + (selling_price - cost_price) × (1 + β × (customer_rating - 3))
        
        Where:
        - Base margin = selling_price - cost_price
        - customer_rating = 1–5 scale
        - β = sensitivity factor (0.1 → every star above/below 3 changes margin by 10%)
        """
        beta = Decimal('0.1')  # sensitivity factor
        base_margin = self.selling_price - self.cost_price
        rating_deviation = self.customer_rating - Decimal('3.00')
        margin_multiplier = Decimal('1.00') + (beta * rating_deviation)
        
        return self.cost_price + (base_margin * margin_multiplier)
    
    def save(self, *args, **kwargs):
        """Override save method to assign random customer rating if not set"""
        if not self.customer_rating:
            self.customer_rating = self.generate_random_rating()
        super().save(*args, **kwargs)

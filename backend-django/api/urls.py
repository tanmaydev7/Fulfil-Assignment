from django.urls import path
from . import views
urlpatterns = [
    path('secret/', views.SecretView.as_view()),
    path('product/upload/', views.ProductCreateView.as_view(), name='product-create'),
    path('products/', views.ProductListView.as_view(), name='product-list'),
]
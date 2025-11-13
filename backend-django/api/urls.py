from django.urls import path
from . import views

urlpatterns = [
    path('add/', views.AddNumbersView.as_view(), name='add-numbers'),
    path('products/upload/', views.ProductUploadView.as_view(), name='product-upload'),
    path('products/', views.ProductListView.as_view(), name='product-list'),
    path('tasks/<str:task_id>/status/', views.TaskStatusView.as_view(), name='task-status'),
]
from django.urls import path
from . import views
from . import webhook_views

urlpatterns = [
    path('add/', views.AddNumbersView.as_view(), name='add-numbers'),
    path('products/', views.ProductListView.as_view(), name='product-list'),
    path('products/upload/', views.ProductUploadView.as_view(), name='product-upload'),
    path('products/edit/', views.ProductEditView.as_view(), name='product-edit'),
    path('tasks/<str:task_id>/status/', views.TaskStatusView.as_view(), name='task-status'),
    path('webhooks/', webhook_views.WebhookListView.as_view(), name='webhook-list'),
    path('webhooks/<int:webhook_id>/', webhook_views.WebhookDetailView.as_view(), name='webhook-detail'),
    path('webhooks/<int:webhook_id>/test/', webhook_views.WebhookTestView.as_view(), name='webhook-test'),
]
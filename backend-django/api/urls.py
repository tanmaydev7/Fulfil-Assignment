from django.urls import path
from . import views

urlpatterns = [
    path('add/', views.AddNumbersView.as_view(), name='add-numbers'),
]
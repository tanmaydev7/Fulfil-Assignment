#!/bin/bash
# Script to start Celery worker
# Make sure you're in the backend-django directory

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Start Celery worker
celery -A basic_auth_app worker --loglevel=info


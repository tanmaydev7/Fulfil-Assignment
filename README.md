# Acme Inc.'s Product Management System

A full-stack web application for managing products with advanced features including bulk operations, CSV uploads, webhook notifications, and real-time updates. Built with Django REST Framework backend and React frontend.

## 🚀 Features

### Product Management
- **CRUD Operations**: Create, read, update, and delete products
- **Inline Editing**: Edit products directly in the table with batch save functionality
- **Bulk Operations**: 
  - Bulk update multiple products at once
  - Bulk delete with conditional processing (synchronous for <100 items, asynchronous for larger batches)
  - Delete all products with confirmation
- **Advanced Filtering**: Filter products by SKU, name, description, and status with debounced search
- **Pagination**: Efficient pagination with customizable page sizes
- **CSV Upload**: Upload and process CSV files with chunked upload support for large files
- **Real-time Status**: Track upload and deletion progress with task status polling

### Webhook System
- **Webhook Configuration**: Create, edit, and manage webhook endpoints via UI
- **Event Types**: Support for multiple event types:
  - `product.created` - When a new product is created
  - `product.updated` - When a product is updated
  - `product.deleted` - When a product is deleted
  - `product.bulk_updated` - When multiple products are updated
  - `product.bulk_deleted` - When multiple products are deleted
  - `product.uploaded` - When products are uploaded via CSV
- **Webhook Testing**: Test webhooks directly from the UI with visual feedback
- **Security**: Optional HMAC-SHA256 signature verification
- **Custom Headers**: Configure custom HTTP headers for webhook requests
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Status Tracking**: Monitor last triggered time, response codes, and response times

### User Interface
- **Modern Design**: Clean, responsive UI built with Tailwind CSS and shadcn/ui components
- **Sidebar Navigation**: Easy navigation between Products and Webhooks pages
- **Data Tables**: Advanced table with row selection, sorting, and inline editing
- **Visual Feedback**: Loading states, error messages, and success confirmations
- **Responsive Layout**: Works seamlessly on desktop and mobile devices

## 🛠️ Tech Stack

### Backend
- **Django 4.2.3**: Web framework
- **Django REST Framework 3.14.0**: REST API framework
- **Celery 5.3.4**: Asynchronous task queue
- **PostgreSQL**: Database (via psycopg2)
- **Pandas 2.1.4**: CSV processing
- **Requests 2.31.0**: HTTP client for webhooks

### Frontend
- **React 19.1.1**: UI library
- **TypeScript 5.9.3**: Type safety
- **Rspack**: Fast bundler
- **React Router 7.9.5**: Client-side routing
- **Mantine React Table**: Advanced data table component
- **Tailwind CSS 4.1.17**: Utility-first CSS framework
- **shadcn/ui**: High-quality component library
- **Axios**: HTTP client
- **use-debounce**: Input debouncing

## 📁 Project Structure

```
.
├── backend-django/          # Django backend application
│   ├── api/                 # Main API app
│   │   ├── models.py       # Product and Webhook models
│   │   ├── views.py        # Product API views
│   │   ├── webhook_views.py # Webhook API views
│   │   ├── serializers.py  # DRF serializers
│   │   ├── tasks.py        # Celery background tasks
│   │   ├── utils.py        # Utility functions
│   │   └── urls.py         # URL routing
│   ├── basic_auth_app/     # Django project settings
│   ├── media/              # Uploaded files
│   └── requirements.txt    # Python dependencies
│
└── client/                  # React frontend application
    ├── src/
    │   ├── components/     # Reusable components
    │   │   ├── AddProductDialog.tsx
    │   │   ├── EditProductDialog.tsx
    │   │   ├── ProductUploadDialog.tsx
    │   │   ├── WebhookDialog.tsx
    │   │   ├── Sidebar.tsx
    │   │   └── AppLayout.tsx
    │   ├── pages/           # Page components
    │   │   ├── ProductsPage.tsx
    │   │   └── WebhooksPage.tsx
    │   ├── router/          # Routing configuration
    │   └── styles/          # Global styles
    └── package.json         # Node dependencies
```

## 🚦 Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+
- PostgreSQL
- Redis (for Celery)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend-django
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure database**
   - Create a PostgreSQL database
   - Update `basic_auth_app/settings.py` with your database credentials

5. **Run migrations**
   ```bash
   python manage.py migrate
   ```

6. **Start Django development server**
   ```bash
   python manage.py runserver
   ```

7. **Start Celery worker** (in a separate terminal)
   ```bash
   celery -A basic_auth_app worker --loglevel=info
   ```

### Frontend Setup

1. **Navigate to client directory**
   ```bash
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Create `.env` file with:
     ```
     BACKEND_URL=http://localhost:8000
     ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173` (or the port shown in the terminal).

## 📡 API Documentation

### Base URL
```
http://localhost:8000/api
```

### Products API

#### Get Products (Paginated)
```http
GET /api/products/
```

**Query Parameters:**
- `limit` (optional): Number of products per page (default: 100, max: 1000)
- `offset` (optional): Number of products to skip (default: 0)
- `sku` (optional): Filter by SKU (case-insensitive partial match)
- `name` (optional): Filter by name (case-insensitive partial match)
- `description` (optional): Filter by description (case-insensitive partial match)
- `status` (optional): Filter by status ('active' or 'inactive')

**Response:**
```json
{
  "message": {
    "count": 1000,
    "limit": 100,
    "offset": 0,
    "results": [
      {
        "id": 1,
        "sku": "PROD-001",
        "name": "Product Name",
        "description": "Product description",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### Create Product
```http
POST /api/products/edit/
```

**Request Body:**
```json
{
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description"
}
```

**Response:**
```json
{
  "message": {
    "id": 1,
    "sku": "PROD-001",
    "name": "Product Name",
    "description": "Product description",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Update Product
```http
PATCH /api/products/edit/
```

**Request Body (Single Update):**
```json
{
  "id": 1,
  "name": "Updated Name",
  "status": "inactive"
}
```

**Request Body (Bulk Update):**
```json
{
  "update_operations": [
    {
      "id": 1,
      "name": "Updated Name 1",
      "status": "active"
    },
    {
      "id": 2,
      "name": "Updated Name 2",
      "status": "inactive"
    }
  ]
}
```

#### Delete Product
```http
DELETE /api/products/edit/
```

**Request Body (Single Delete):**
```json
{
  "id": 1
}
```

**Request Body (Bulk Delete):**
```json
{
  "ids": [1, 2, 3]
}
```

**Request Body (Delete All):**
```json
{
  "delete_all": true
}
```

**Note:** Bulk deletes with <100 items are processed synchronously. Larger batches are processed asynchronously and return a `task_id` for status tracking.

#### Upload Products (CSV)
```http
POST /api/products/upload/
```

**Request:**
- Content-Type: `multipart/form-data`
- Body: CSV file with columns: `sku`, `name`, `description`, `status` (optional)

**Response:**
```json
{
  "message": {
    "task_id": "task-uuid",
    "status": "PENDING",
    "message": "File uploaded and processing started"
  }
}
```

**Chunked Upload:**
```http
POST /api/products/upload/?upload_id={uuid}&end={0|1}
```
- `upload_id`: Upload session ID (generated on first chunk)
- `end`: 1 for last chunk, 0 for intermediate chunks

#### Get Task Status
```http
GET /api/tasks/{task_id}/status/
```

**Response:**
```json
{
  "message": {
    "task_id": "task-uuid",
    "state": "SUCCESS",
    "result": {
      "success": true,
      "success_count": 150,
      "total_processed": 150
    }
  }
}
```

### Webhooks API

#### List Webhooks
```http
GET /api/webhooks/
```

**Response:**
```json
{
  "message": [
    {
      "id": 1,
      "url": "https://example.com/webhook",
      "name": "My Webhook",
      "event_types": ["product.created", "product.updated"],
      "enabled": true,
      "timeout": 30,
      "retry_count": 3,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "last_triggered_at": "2024-01-01T12:00:00Z",
      "last_response_code": 200,
      "last_response_time": 45.2
    }
  ]
}
```

#### Create Webhook
```http
POST /api/webhooks/
```

**Request Body:**
```json
{
  "url": "https://example.com/webhook",
  "name": "My Webhook",
  "event_types": ["product.created", "product.updated"],
  "enabled": true,
  "secret": "optional-secret-key",
  "headers": {
    "Authorization": "Bearer token"
  },
  "timeout": 30,
  "retry_count": 3
}
```

#### Get Webhook
```http
GET /api/webhooks/{webhook_id}/
```

#### Update Webhook
```http
PATCH /api/webhooks/{webhook_id}/
```

#### Delete Webhook
```http
DELETE /api/webhooks/{webhook_id}/
```

#### Test Webhook
```http
POST /api/webhooks/{webhook_id}/test/
```

**Request Body (Optional):**
```json
{
  "payload": {
    "test": true,
    "message": "Test webhook trigger"
  }
}
```

**Response:**
```json
{
  "message": {
    "success": true,
    "status_code": 200,
    "response_time_ms": 45.2,
    "message": "Webhook test successful"
  }
}
```

## 🔔 Webhook Events

### Event Payload Structure
All webhook events follow this structure:
```json
{
  "event": "product.created",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    // Event-specific data
  }
}
```

### Event Types

#### product.created
Triggered when a new product is created.
```json
{
  "event": "product.created",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": 1,
    "sku": "PROD-001",
    "name": "Product Name",
    "description": "Product description",
    "status": "active",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

#### product.updated
Triggered when a product is updated.
```json
{
  "event": "product.updated",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": 1,
    "sku": "PROD-001",
    "name": "Updated Name",
    "description": "Updated description",
    "status": "inactive",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:30:00Z"
  }
}
```

#### product.deleted
Triggered when a product is deleted.
```json
{
  "event": "product.deleted",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": 1,
    "sku": "PROD-001",
    "name": "Product Name",
    "description": "Product description",
    "status": "active",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

#### product.bulk_updated
Triggered when multiple products are updated.
```json
{
  "event": "product.bulk_updated",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "count": 10,
    "products": [
      {
        "id": 1,
        "sku": "PROD-001",
        "name": "Updated Name 1",
        "status": "active"
      }
    ]
  }
}
```

#### product.bulk_deleted
Triggered when multiple products are deleted.
```json
{
  "event": "product.bulk_deleted",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "deleted": 50,
    "total": 50,
    "ids": [1, 2, 3, ...]
  }
}
```

#### product.uploaded
Triggered when products are uploaded via CSV.
```json
{
  "event": "product.uploaded",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "success_count": 150,
    "total_processed": 150,
    "upload_type": "csv"
  }
}
```

### Webhook Headers
All webhook requests include these headers:
- `Content-Type: application/json`
- `X-Webhook-Event: {event_type}`
- `User-Agent: Django-Webhook-Client/1.0`
- `X-Webhook-Signature: sha256={signature}` (if secret is configured)

### Signature Verification
If a webhook has a secret configured, the signature is calculated as:
```
HMAC-SHA256(secret, JSON.stringify(payload, sort_keys=True))
```

## 🔄 Background Tasks

The application uses Celery for asynchronous task processing:

### Task Types
1. **CSV Processing** (`process_product_file`): Processes uploaded CSV files
2. **Bulk Delete** (`bulk_delete_products`): Deletes large batches of products
3. **Webhook Triggering** (`trigger_webhooks_task`): Fetches and triggers webhooks
4. **Webhook Delivery** (`send_webhook`): Sends individual webhook requests

### Task Status
Tasks can have the following states:
- `PENDING`: Task is waiting to be processed
- `STARTED`: Task is being processed
- `SUCCESS`: Task completed successfully
- `FAILURE`: Task failed with an error
- `RETRY`: Task is being retried

## 🎨 Frontend Features

### Products Page
- **Table View**: Filterable product table
- **Inline Editing**: Edit cells directly with visual highlighting
- **Batch Operations**: Select multiple rows for bulk actions
- **Advanced Filters**: Filter by SKU, name, description, and status
- **Pagination**: Navigate through large datasets
- **CSV Upload**: Drag-and-drop or file picker for CSV uploads
- **Real-time Updates**: Automatic refresh after operations

### Webhooks Page
- **Webhook Management**: Create, edit, delete webhooks
- **Event Type Selection**: Choose which events trigger each webhook
- **Test Functionality**: Test webhooks with visual feedback
- **Status Monitoring**: View last triggered time, response codes, and times
- **Enable/Disable Toggle**: Quickly enable or disable webhooks

## 🔒 Security Features

- **HMAC Signature Verification**: Optional webhook signature verification
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Django ORM prevents SQL injection
- **CORS Configuration**: Configured CORS headers for API access
- **Error Handling**: Comprehensive error handling and logging

## 📝 Development Notes

### Database Schema
- **Products Table**: `id` (PK), `sku` (unique), `name`, `description`, `status`, `created_at`, `updated_at`
- **Webhooks Table**: `id` (PK), `url`, `name`, `event_types` (JSON), `enabled`, `secret`, `headers` (JSON), `timeout`, `retry_count`, timestamps, and last trigger info

### Performance Optimizations
- **Debounced Filtering**: Reduces API calls while typing
- **Pagination**: Limits data transfer and improves load times
- **Background Processing**: Heavy operations don't block API responses
- **Batch Operations**: Efficient database operations for bulk updates/deletes

### Error Handling
- All API endpoints return consistent error responses
- Frontend displays user-friendly error messages
- Background tasks log errors without failing the main operation

## 🚀 Deployment

### Backend Deployment
1. Set up PostgreSQL database
2. Configure environment variables
3. Run migrations: `python manage.py migrate`
4. Collect static files: `python manage.py collectstatic`
5. Start Gunicorn/uWSGI server
6. Start Celery worker

### Frontend Deployment
1. Build production bundle: `npm run build`
2. Serve static files via Nginx or similar
3. Configure API base URL in environment variables


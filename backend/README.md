# HandPost Backend API

A minimal FastAPI application with SQLite database for task management.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

- `POST /api/tasks` - Create a new task
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/{id}` - Get a specific task
- `POST /api/tasks/{id}/respond` - Respond to a task

## Testing

### Create a task:
```bash
curl -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"title": "Test task", "description": "This is a test"}}'
```

### Get all tasks:
```bash
curl "http://localhost:8000/api/tasks"
```

### Get specific task:
```bash
curl "http://localhost:8000/api/tasks/1"
```

### Respond to a task:
```bash
curl -X POST "http://localhost:8000/api/tasks/1/respond" \
  -H "Content-Type: application/json" \
  -d '{"action": "publish"}'
```

## Database

SQLite database file `tasks.db` will be created automatically in the backend directory.

### Tables:
- `tasks`: id, payload (JSON), status, created_at
- `responses`: id, task_id, action, created_at

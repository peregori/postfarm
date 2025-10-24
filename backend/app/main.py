from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime
from typing import List
from pydantic import ConfigDict
import json
try:
    from .models import Base, Task, Response
except ImportError:
    from models import Base, Task, Response

# Database setup
DATABASE_URL = "sqlite:///./tasks.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic Models
class TaskCreate(BaseModel):
    payload: dict

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    payload: dict
    status: str
    created_at: datetime | None = None

class ResponseCreate(BaseModel):
    action: str

class ResponseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    task_id: int
    action: str
    created_at: datetime | None = None

# FastAPI app
app = FastAPI(title="HandPost API", version="1.0.0")

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# API Endpoints
@app.post("/api/tasks", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = Task(payload=task.payload, status="pending")
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    return TaskResponse(
        id=db_task.id,
        payload=db_task.payload,
        status=db_task.status,
        created_at=db_task.created_at
    )

@app.get("/api/tasks", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    try:
        tasks = db.query(Task).order_by(Task.created_at.desc()).all()
        result = []
        for task in tasks:
            result.append(TaskResponse(
                id=task.id,
                payload=task.payload,
                status=task.status,
                created_at=task.created_at
            ))
        return result
    except Exception as e:
        print(f"Error in get_tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return TaskResponse(
        id=task.id,
        payload=task.payload,
        status=task.status,
        created_at=task.created_at
    )

@app.post("/api/tasks/{task_id}/respond", response_model=ResponseResponse)
def respond_to_task(task_id: int, response: ResponseCreate, db: Session = Depends(get_db)):
    # Check if task exists
    task = db.query(Task).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Create response
    db_response = Response(task_id=task_id, action=response.action)
    db.add(db_response)
    
    # Update task status based on action
    new_status = "published" if response.action == "publish" else "handled"
    task.status = new_status
    
    db.commit()
    db.refresh(db_response)
    
    return ResponseResponse(
        id=db_response.id,
        task_id=db_response.task_id,
        action=db_response.action,
        created_at=db_response.created_at
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
from sqlalchemy import Column, Integer, String, DateTime, JSON, func
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    payload = Column(JSON)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=func.now())

class Response(Base):
    __tablename__ = "responses"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, index=True)
    action = Column(String)
    created_at = Column(DateTime, default=func.now())

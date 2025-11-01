from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ScheduledPost, PostStatus, PlatformType
from sqlalchemy import select
from datetime import datetime

router = APIRouter()

class ScheduledPostResponse(BaseModel):
    id: int
    draft_id: int
    platform: str
    content: str
    scheduled_time: str
    status: str
    posted_at: Optional[str]
    error_message: Optional[str]
    created_at: str
    
    @classmethod
    def from_orm(cls, post: ScheduledPost):
        return cls(**post.to_dict())

@router.get("/", response_model=List[ScheduledPostResponse])
async def list_posts(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    platform: Optional[str] = None
):
    """List all scheduled/posted content"""
    query = select(ScheduledPost)
    
    if status:
        query = query.where(ScheduledPost.status == PostStatus(status))
    if platform:
        query = query.where(ScheduledPost.platform == PlatformType(platform))
    
    result = db.execute(query.offset(skip).limit(limit).order_by(ScheduledPost.scheduled_time.desc()))
    posts = result.scalars().all()
    
    return [ScheduledPostResponse.from_orm(post) for post in posts]

@router.get("/{post_id}", response_model=ScheduledPostResponse)
async def get_post(post_id: int, db: Session = Depends(get_db)):
    """Get a specific scheduled post"""
    result = db.execute(select(ScheduledPost).where(ScheduledPost.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return ScheduledPostResponse.from_orm(post)


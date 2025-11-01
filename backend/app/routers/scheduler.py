from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ScheduledPost, PostStatus, PlatformType, Draft
from sqlalchemy import select
from datetime import datetime
from app.services.scheduler_service import scheduler_service
import pytz

router = APIRouter()

class ScheduleRequest(BaseModel):
    draft_id: int
    platform: str  # "twitter" or "linkedin"
    content: str  # Final content to post (may differ from draft)
    scheduled_time: str  # ISO format datetime
    timezone: Optional[str] = "UTC"

class ScheduleResponse(BaseModel):
    id: int
    draft_id: int
    platform: str
    content: str
    scheduled_time: str
    status: str

@router.post("/schedule", response_model=ScheduleResponse, status_code=201)
async def schedule_post(request: ScheduleRequest, db: Session = Depends(get_db)):
    """Schedule a post for future publication"""
    # Validate draft exists
    result = db.execute(select(Draft).where(Draft.id == request.draft_id))
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Validate platform
    try:
        platform = PlatformType(request.platform.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {request.platform}")
    
    # Parse scheduled time
    try:
        if request.timezone and request.timezone != "UTC":
            tz = pytz.timezone(request.timezone)
            scheduled_dt = datetime.fromisoformat(request.scheduled_time.replace('Z', '+00:00'))
            if scheduled_dt.tzinfo is None:
                scheduled_dt = tz.localize(scheduled_dt)
            scheduled_dt = scheduled_dt.astimezone(pytz.UTC)
        else:
            scheduled_dt = datetime.fromisoformat(request.scheduled_time.replace('Z', '+00:00'))
            if scheduled_dt.tzinfo is None:
                scheduled_dt = pytz.UTC.localize(scheduled_dt)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: {str(e)}")
    
    # Check if scheduled time is in the future
    if scheduled_dt <= datetime.now(pytz.UTC):
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    
    # Create scheduled post
    scheduled_post = ScheduledPost(
        draft_id=request.draft_id,
        platform=platform,
        content=request.content,
        scheduled_time=scheduled_dt,
        status=PostStatus.SCHEDULED
    )
    
    db.add(scheduled_post)
    db.commit()
    db.refresh(scheduled_post)
    
    # Add to scheduler
    scheduler_service.schedule_post(scheduled_post)
    
    return ScheduleResponse(
        id=scheduled_post.id,
        draft_id=scheduled_post.draft_id,
        platform=scheduled_post.platform.value,
        content=scheduled_post.content,
        scheduled_time=scheduled_post.scheduled_time.isoformat(),
        status=scheduled_post.status.value
    )

@router.post("/{post_id}/cancel", status_code=200)
async def cancel_post(post_id: int, db: Session = Depends(get_db)):
    """Cancel a scheduled post"""
    result = db.execute(select(ScheduledPost).where(ScheduledPost.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.status != PostStatus.SCHEDULED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel post with status: {post.status.value}"
        )
    
    post.status = PostStatus.CANCELLED
    db.commit()
    
    # Remove from scheduler
    scheduler_service.unschedule_post(post_id)
    
    return {"message": "Post cancelled successfully", "post_id": post_id}

@router.get("/calendar", response_model=dict)
async def get_calendar(
    db: Session = Depends(get_db),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get calendar view of scheduled posts"""
    query = select(ScheduledPost).where(ScheduledPost.status == PostStatus.SCHEDULED)
    
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        query = query.where(ScheduledPost.scheduled_time >= start_dt)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        query = query.where(ScheduledPost.scheduled_time <= end_dt)
    
    result = db.execute(query.order_by(ScheduledPost.scheduled_time))
    posts = result.scalars().all()
    
    # Group by date
    calendar = {}
    for post in posts:
        date_key = post.scheduled_time.date().isoformat()
        if date_key not in calendar:
            calendar[date_key] = []
        calendar[date_key].append({
            "id": post.id,
            "platform": post.platform.value,
            "content": post.content[:50] + "..." if len(post.content) > 50 else post.content,
            "scheduled_time": post.scheduled_time.isoformat(),
            "draft_id": post.draft_id
        })
    
    return {"calendar": calendar, "total": len(posts)}


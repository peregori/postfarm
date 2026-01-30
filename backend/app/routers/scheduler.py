"""
Scheduler API router.

Supports both SQLite (local dev) and Supabase (production) backends.
When USE_SUPABASE is enabled, all operations are user-scoped.
"""

from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.middleware.auth import ClerkUser, get_current_user
from app.models import Draft, PlatformType, PostStatus, ScheduledPost
from app.services.scheduler_service import scheduler_service

router = APIRouter()


class ScheduleRequest(BaseModel):
    draft_id: str  # UUID string for Supabase, can be int-as-string for SQLite
    platform: str  # "twitter" or "linkedin"
    content: str  # Final content to post (may differ from draft)
    scheduled_time: str  # ISO format datetime
    timezone: Optional[str] = "UTC"


class ScheduleResponse(BaseModel):
    id: str  # UUID string for Supabase
    draft_id: str
    platform: str
    content: str
    scheduled_time: str
    status: str
    user_id: Optional[str] = None


@router.post("/schedule", response_model=ScheduleResponse, status_code=201)
async def schedule_post(
    request: ScheduleRequest,
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Schedule a post for future publication."""
    # Parse and validate scheduled time
    try:
        if request.timezone and request.timezone != "UTC":
            tz = pytz.timezone(request.timezone)
            scheduled_dt = datetime.fromisoformat(
                request.scheduled_time.replace("Z", "+00:00")
            )
            if scheduled_dt.tzinfo is None:
                scheduled_dt = tz.localize(scheduled_dt)
            scheduled_dt = scheduled_dt.astimezone(pytz.UTC)
        else:
            scheduled_dt = datetime.fromisoformat(
                request.scheduled_time.replace("Z", "+00:00")
            )
            if scheduled_dt.tzinfo is None:
                scheduled_dt = pytz.UTC.localize(scheduled_dt)
    except ValueError as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid datetime format: {str(e)}"
        )

    # Check if scheduled time is in the future
    if scheduled_dt <= datetime.now(pytz.UTC):
        raise HTTPException(
            status_code=400, detail="Scheduled time must be in the future"
        )

    # Validate platform
    try:
        platform = PlatformType(request.platform.lower())
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid platform: {request.platform}"
        )

    if settings.USE_SUPABASE:
        from app.database_supabase import DraftRepository, ScheduledPostRepository

        # Validate draft exists and belongs to user
        draft_repo = DraftRepository()
        draft = await draft_repo.get_by_id(request.draft_id, user.user_id)

        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        # Create scheduled post
        post_repo = ScheduledPostRepository()
        post = await post_repo.create(
            user.user_id,
            {
                "draft_id": request.draft_id,
                "platform": platform.value,
                "content": request.content,
                "scheduled_time": scheduled_dt.isoformat(),
            },
        )

        return ScheduleResponse(
            id=post["id"],
            draft_id=post["draft_id"],
            platform=post["platform"],
            content=post["content"],
            scheduled_time=post["scheduled_time"],
            status=post["status"],
            user_id=post["user_id"],
        )
    else:
        # SQLite fallback
        try:
            draft_id_int = int(request.draft_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Draft not found")

        result = db.execute(select(Draft).where(Draft.id == draft_id_int))
        draft = result.scalar_one_or_none()

        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        scheduled_post = ScheduledPost(
            draft_id=draft_id_int,
            platform=platform,
            content=request.content,
            scheduled_time=scheduled_dt,
            status=PostStatus.SCHEDULED,
        )

        db.add(scheduled_post)
        db.commit()
        db.refresh(scheduled_post)

        # Add to scheduler
        scheduler_service.schedule_post(scheduled_post)

        return ScheduleResponse(
            id=str(scheduled_post.id),
            draft_id=str(scheduled_post.draft_id),
            platform=scheduled_post.platform.value,
            content=scheduled_post.content,
            scheduled_time=scheduled_post.scheduled_time.isoformat(),
            status=scheduled_post.status.value,
            user_id=user.user_id,
        )


@router.post("/{post_id}/cancel", status_code=200)
async def cancel_post(
    post_id: str,
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a scheduled post."""
    if settings.USE_SUPABASE:
        from app.database_supabase import (
            ScheduledPostRepository,
            SyncMetadataRepository,
        )

        repo = ScheduledPostRepository()
        post = await repo.get_by_id(post_id, user.user_id)

        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        if post["status"] != "scheduled":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel post with status: {post['status']}",
            )

        await repo.update_status(post_id, user.user_id, "cancelled")

        # Record for sync
        sync_repo = SyncMetadataRepository()
        await sync_repo.record_deletion(user.user_id, "scheduled_post", post_id)

        return {"message": "Post cancelled successfully", "post_id": post_id}
    else:
        # SQLite fallback
        try:
            post_id_int = int(post_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Post not found")

        result = db.execute(
            select(ScheduledPost).where(ScheduledPost.id == post_id_int)
        )
        post = result.scalar_one_or_none()

        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        if post.status != PostStatus.SCHEDULED:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel post with status: {post.status.value}",
            )

        post.status = PostStatus.CANCELLED
        db.commit()

        # Remove from scheduler
        scheduler_service.unschedule_post(post_id_int)

        return {"message": "Post cancelled successfully", "post_id": post_id}


@router.get("/calendar", response_model=dict)
async def get_calendar(
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Get calendar view of scheduled posts for the authenticated user."""
    if settings.USE_SUPABASE:
        from app.database_supabase import ScheduledPostRepository

        repo = ScheduledPostRepository()

        # Parse dates
        start_dt = (
            datetime.fromisoformat(start_date) if start_date else datetime.now(pytz.UTC)
        )
        end_dt = datetime.fromisoformat(end_date) if end_date else None

        if end_dt is None:
            # Default to 3 months ahead
            from datetime import timedelta

            end_dt = start_dt + timedelta(days=90)

        posts = await repo.get_calendar(user.user_id, start_dt, end_dt)

        # Group by date
        calendar = {}
        for post in posts:
            scheduled_time = datetime.fromisoformat(
                post["scheduled_time"].replace("Z", "+00:00")
            )
            date_key = scheduled_time.date().isoformat()
            if date_key not in calendar:
                calendar[date_key] = []
            calendar[date_key].append(
                {
                    "id": post["id"],
                    "platform": post["platform"],
                    "content": post["content"][:50] + "..."
                    if len(post["content"]) > 50
                    else post["content"],
                    "scheduled_time": post["scheduled_time"],
                    "draft_id": post["draft_id"],
                    "status": post["status"],
                }
            )

        return {"calendar": calendar, "total": len(posts)}
    else:
        # SQLite fallback
        query = select(ScheduledPost).where(
            ScheduledPost.status == PostStatus.SCHEDULED
        )

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
            calendar[date_key].append(
                {
                    "id": str(post.id),
                    "platform": post.platform.value,
                    "content": post.content[:50] + "..."
                    if len(post.content) > 50
                    else post.content,
                    "scheduled_time": post.scheduled_time.isoformat(),
                    "draft_id": str(post.draft_id),
                    "status": post.status.value,
                }
            )

        return {"calendar": calendar, "total": len(posts)}


@router.get("/posts", response_model=list)
async def list_scheduled_posts(
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
):
    """List all scheduled posts for the authenticated user."""
    if settings.USE_SUPABASE:
        from app.database_supabase import ScheduledPostRepository

        repo = ScheduledPostRepository()
        posts = await repo.list_by_user(
            user.user_id, status=status, skip=skip, limit=limit
        )

        return [
            {
                "id": post["id"],
                "draft_id": post["draft_id"],
                "platform": post["platform"],
                "content": post["content"],
                "scheduled_time": post["scheduled_time"],
                "status": post["status"],
                "posted_at": post.get("posted_at"),
                "error_message": post.get("error_message"),
                "user_id": post["user_id"],
            }
            for post in posts
        ]
    else:
        # SQLite fallback
        query = select(ScheduledPost)

        if status:
            try:
                status_enum = PostStatus(status.lower())
                query = query.where(ScheduledPost.status == status_enum)
            except ValueError:
                pass

        result = db.execute(
            query.order_by(ScheduledPost.scheduled_time.desc())
            .offset(skip)
            .limit(limit)
        )
        posts = result.scalars().all()

        return [
            {
                "id": str(post.id),
                "draft_id": str(post.draft_id),
                "platform": post.platform.value,
                "content": post.content,
                "scheduled_time": post.scheduled_time.isoformat(),
                "status": post.status.value,
                "posted_at": post.posted_at.isoformat() if post.posted_at else None,
                "error_message": post.error_message,
                "user_id": user.user_id,
            }
            for post in posts
        ]

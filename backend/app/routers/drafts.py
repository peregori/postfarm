"""
Drafts API router.

Supports both SQLite (local dev) and Supabase (production) backends.
When USE_SUPABASE is enabled, all operations are user-scoped.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.middleware.auth import ClerkUser, get_current_user
from app.models import Draft

router = APIRouter()


# Request/Response Models


class DraftCreate(BaseModel):
    id: Optional[str] = None  # Client can provide UUID for offline-first
    title: Optional[str] = None
    content: str
    prompt: Optional[str] = None
    tags: Optional[List[str]] = None
    confirmed: Optional[bool] = False
    scheduled_at: Optional[datetime] = None


class DraftUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    prompt: Optional[str] = None
    tags: Optional[List[str]] = None
    confirmed: Optional[bool] = None
    scheduled_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None  # For conflict detection


class DraftResponse(BaseModel):
    id: str  # UUID string for Supabase, int-as-string for SQLite
    user_id: Optional[str] = None
    title: Optional[str]
    content: str
    prompt: Optional[str]
    created_at: str
    updated_at: Optional[str]
    tags: List[str]
    confirmed: Optional[bool] = False
    scheduled_at: Optional[str] = None

    @classmethod
    def from_orm(cls, draft: Draft, user_id: Optional[str] = None):
        """Convert SQLite Draft model to response."""
        data = draft.to_dict()
        data["id"] = str(data["id"])  # Convert int to string
        data["user_id"] = user_id
        data["confirmed"] = "confirmed" in data.get("tags", [])
        data["scheduled_at"] = None
        return cls(**data)

    @classmethod
    def from_supabase(cls, data: dict):
        """Convert Supabase dict to response."""
        return cls(
            id=data["id"],
            user_id=data.get("user_id"),
            title=data.get("title"),
            content=data.get("content", ""),
            prompt=data.get("prompt"),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at"),
            tags=data.get("tags", []),
            confirmed=data.get("confirmed", False),
            scheduled_at=data.get("scheduled_at"),
        )


# API Endpoints


@router.get("/", response_model=List[DraftResponse])
async def list_drafts(
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List all drafts for the authenticated user."""
    if settings.USE_SUPABASE:
        from app.database_supabase import DraftRepository

        repo = DraftRepository()
        drafts = await repo.list_by_user(user.user_id, skip, limit)
        return [DraftResponse.from_supabase(d) for d in drafts]
    else:
        # SQLite fallback (no user filtering in legacy mode)
        result = db.execute(
            select(Draft).offset(skip).limit(limit).order_by(Draft.created_at.desc())
        )
        drafts = result.scalars().all()
        return [DraftResponse.from_orm(d, user.user_id) for d in drafts]


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: str,
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific draft by ID."""
    if settings.USE_SUPABASE:
        from app.database_supabase import DraftRepository

        repo = DraftRepository()
        draft = await repo.get_by_id(draft_id, user.user_id)

        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        return DraftResponse.from_supabase(draft)
    else:
        # SQLite fallback
        try:
            draft_id_int = int(draft_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Draft not found")

        result = db.execute(select(Draft).where(Draft.id == draft_id_int))
        draft = result.scalar_one_or_none()

        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        return DraftResponse.from_orm(draft, user.user_id)


@router.post("/", response_model=DraftResponse, status_code=201)
async def create_draft(
    draft_data: DraftCreate,
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new draft for the authenticated user."""
    if settings.USE_SUPABASE:
        from app.database_supabase import DraftRepository

        repo = DraftRepository()

        data = {
            "title": draft_data.title,
            "content": draft_data.content,
            "prompt": draft_data.prompt,
            "tags": draft_data.tags or [],
            "confirmed": draft_data.confirmed or False,
            "scheduled_at": draft_data.scheduled_at.isoformat()
            if draft_data.scheduled_at
            else None,
        }

        draft = await repo.create(user.user_id, data, draft_id=draft_data.id)
        return DraftResponse.from_supabase(draft)
    else:
        # SQLite fallback
        tags_str = ",".join(draft_data.tags) if draft_data.tags else None

        draft = Draft(
            title=draft_data.title,
            content=draft_data.content,
            prompt=draft_data.prompt,
            tags=tags_str,
        )

        db.add(draft)
        db.commit()
        db.refresh(draft)

        return DraftResponse.from_orm(draft, user.user_id)


@router.put("/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: str,
    draft_data: DraftUpdate,
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update an existing draft.

    If updated_at is provided, performs conflict detection.
    Returns 409 Conflict if server version is newer.
    """
    if settings.USE_SUPABASE:
        from app.database_supabase import ConflictError, DraftRepository

        repo = DraftRepository()

        data = {}
        if draft_data.title is not None:
            data["title"] = draft_data.title
        if draft_data.content is not None:
            data["content"] = draft_data.content
        if draft_data.prompt is not None:
            data["prompt"] = draft_data.prompt
        if draft_data.tags is not None:
            data["tags"] = draft_data.tags
        if draft_data.confirmed is not None:
            data["confirmed"] = draft_data.confirmed
        if draft_data.scheduled_at is not None:
            data["scheduled_at"] = draft_data.scheduled_at.isoformat()

        try:
            draft = await repo.update(
                draft_id, user.user_id, data, client_updated_at=draft_data.updated_at
            )
            return DraftResponse.from_supabase(draft)
        except ConflictError as e:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "Conflict",
                    "server_updated_at": e.server_updated_at,
                    "message": str(e),
                },
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    else:
        # SQLite fallback
        try:
            draft_id_int = int(draft_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Draft not found")

        result = db.execute(select(Draft).where(Draft.id == draft_id_int))
        draft = result.scalar_one_or_none()

        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        if draft_data.title is not None:
            draft.title = draft_data.title
        if draft_data.content is not None:
            draft.content = draft_data.content
        if draft_data.prompt is not None:
            draft.prompt = draft_data.prompt
        if draft_data.tags is not None:
            draft.tags = ",".join(draft_data.tags) if draft_data.tags else None

        db.commit()
        db.refresh(draft)

        return DraftResponse.from_orm(draft, user.user_id)


@router.delete("/{draft_id}", status_code=204)
async def delete_draft(
    draft_id: str,
    user: ClerkUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a draft."""
    if settings.USE_SUPABASE:
        from app.database_supabase import DraftRepository, SyncMetadataRepository

        repo = DraftRepository()
        deleted = await repo.delete(draft_id, user.user_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Draft not found")

        # Record deletion for sync
        sync_repo = SyncMetadataRepository()
        await sync_repo.record_deletion(user.user_id, "draft", draft_id)

        return None
    else:
        # SQLite fallback
        try:
            draft_id_int = int(draft_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Draft not found")

        result = db.execute(select(Draft).where(Draft.id == draft_id_int))
        draft = result.scalar_one_or_none()

        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        db.delete(draft)
        db.commit()

        return None

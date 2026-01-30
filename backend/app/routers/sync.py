"""
Sync API router.

Provides endpoints for bi-directional synchronization between
frontend localStorage and Supabase backend.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import ClerkUser, get_current_user

router = APIRouter()


# Request/Response Models


class SyncPullRequest(BaseModel):
    last_sync_at: Optional[datetime] = None


class SyncPullResponse(BaseModel):
    drafts: List[Dict[str, Any]]
    scheduled_posts: List[Dict[str, Any]]
    deleted_ids: List[str]
    sync_timestamp: str


class SyncPushItem(BaseModel):
    entity_type: str  # 'draft' or 'scheduled_post'
    entity_id: str  # UUID
    action: str  # 'create', 'update', 'delete'
    data: Optional[Dict[str, Any]] = None
    client_updated_at: Optional[datetime] = None


class SyncPushRequest(BaseModel):
    changes: List[SyncPushItem]


class SyncPushResult(BaseModel):
    entity_id: str
    status: str  # 'success', 'conflict', 'error'
    message: Optional[str] = None
    server_data: Optional[Dict[str, Any]] = None


class SyncPushResponse(BaseModel):
    results: List[SyncPushResult]
    success_count: int
    conflict_count: int
    error_count: int


# API Endpoints


@router.post("/pull", response_model=SyncPullResponse)
async def sync_pull(
    request: SyncPullRequest, user: ClerkUser = Depends(get_current_user)
):
    """
    Pull all changes since last sync.

    Returns:
    - drafts: All drafts modified since last_sync_at
    - scheduled_posts: All scheduled posts modified since last_sync_at
    - deleted_ids: IDs of entities deleted since last_sync_at
    - sync_timestamp: Timestamp to use for next pull
    """
    if not settings.USE_SUPABASE:
        raise HTTPException(
            status_code=501,
            detail="Sync is only available when USE_SUPABASE is enabled",
        )

    from app.database_supabase import (
        DraftRepository,
        ScheduledPostRepository,
        SyncMetadataRepository,
    )

    sync_timestamp = datetime.utcnow()

    # Get drafts modified since last sync
    draft_repo = DraftRepository()
    drafts = await draft_repo.get_modified_since(user.user_id, request.last_sync_at)

    # Get scheduled posts modified since last sync
    post_repo = ScheduledPostRepository()
    scheduled_posts = await post_repo.get_modified_since(
        user.user_id, request.last_sync_at
    )

    # Get deleted entity IDs
    sync_repo = SyncMetadataRepository()
    deleted_ids = await sync_repo.get_deletions_since(
        user.user_id, request.last_sync_at
    )

    return SyncPullResponse(
        drafts=drafts,
        scheduled_posts=scheduled_posts,
        deleted_ids=deleted_ids,
        sync_timestamp=sync_timestamp.isoformat(),
    )


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(
    request: SyncPushRequest, user: ClerkUser = Depends(get_current_user)
):
    """
    Push local changes to server.

    For each change:
    - 'create': Creates new entity (uses client-provided ID)
    - 'update': Updates entity (with conflict detection if client_updated_at provided)
    - 'delete': Deletes entity

    Returns status for each change (success/conflict/error).
    """
    if not settings.USE_SUPABASE:
        raise HTTPException(
            status_code=501,
            detail="Sync is only available when USE_SUPABASE is enabled",
        )

    from app.database_supabase import (
        ConflictError,
        DraftRepository,
        ScheduledPostRepository,
        SyncMetadataRepository,
    )

    results = []
    success_count = 0
    conflict_count = 0
    error_count = 0

    draft_repo = DraftRepository()
    post_repo = ScheduledPostRepository()
    sync_repo = SyncMetadataRepository()

    for change in request.changes:
        try:
            if change.entity_type == "draft":
                result = await _process_draft_change(
                    change, user.user_id, draft_repo, sync_repo
                )
            elif change.entity_type == "scheduled_post":
                result = await _process_scheduled_post_change(
                    change, user.user_id, post_repo, sync_repo
                )
            else:
                result = SyncPushResult(
                    entity_id=change.entity_id,
                    status="error",
                    message=f"Unknown entity type: {change.entity_type}",
                )

            results.append(result)

            if result.status == "success":
                success_count += 1
            elif result.status == "conflict":
                conflict_count += 1
            else:
                error_count += 1

        except Exception as e:
            results.append(
                SyncPushResult(
                    entity_id=change.entity_id, status="error", message=str(e)
                )
            )
            error_count += 1

    return SyncPushResponse(
        results=results,
        success_count=success_count,
        conflict_count=conflict_count,
        error_count=error_count,
    )


async def _process_draft_change(
    change: SyncPushItem, user_id: str, repo, sync_repo
) -> SyncPushResult:
    """Process a single draft change."""
    from app.database_supabase import ConflictError

    if change.action == "create":
        try:
            draft = await repo.create(
                user_id, change.data or {}, draft_id=change.entity_id
            )
            return SyncPushResult(
                entity_id=change.entity_id, status="success", server_data=draft
            )
        except Exception as e:
            # May fail if already exists - try update instead
            if "duplicate" in str(e).lower():
                try:
                    draft = await repo.update(
                        change.entity_id,
                        user_id,
                        change.data or {},
                        client_updated_at=change.client_updated_at,
                    )
                    return SyncPushResult(
                        entity_id=change.entity_id, status="success", server_data=draft
                    )
                except ConflictError as ce:
                    return SyncPushResult(
                        entity_id=change.entity_id,
                        status="conflict",
                        message=str(ce),
                        server_data={"updated_at": ce.server_updated_at},
                    )
            raise

    elif change.action == "update":
        try:
            draft = await repo.update(
                change.entity_id,
                user_id,
                change.data or {},
                client_updated_at=change.client_updated_at,
            )
            return SyncPushResult(
                entity_id=change.entity_id, status="success", server_data=draft
            )
        except ConflictError as ce:
            # Get full server data for conflict resolution
            server_draft = await repo.get_by_id(change.entity_id, user_id)
            return SyncPushResult(
                entity_id=change.entity_id,
                status="conflict",
                message=str(ce),
                server_data=server_draft,
            )
        except ValueError as e:
            return SyncPushResult(
                entity_id=change.entity_id, status="error", message=str(e)
            )

    elif change.action == "delete":
        deleted = await repo.delete(change.entity_id, user_id)
        if deleted:
            await sync_repo.record_deletion(user_id, "draft", change.entity_id)
        return SyncPushResult(entity_id=change.entity_id, status="success")

    return SyncPushResult(
        entity_id=change.entity_id,
        status="error",
        message=f"Unknown action: {change.action}",
    )


async def _process_scheduled_post_change(
    change: SyncPushItem, user_id: str, repo, sync_repo
) -> SyncPushResult:
    """Process a single scheduled post change."""
    if change.action == "create":
        try:
            post = await repo.create(user_id, change.data or {})
            return SyncPushResult(
                entity_id=post["id"], status="success", server_data=post
            )
        except Exception as e:
            return SyncPushResult(
                entity_id=change.entity_id, status="error", message=str(e)
            )

    elif change.action == "update":
        # For scheduled posts, we mainly update status
        status = (change.data or {}).get("status")
        if status:
            try:
                post = await repo.update_status(change.entity_id, user_id, status)
                return SyncPushResult(
                    entity_id=change.entity_id, status="success", server_data=post
                )
            except ValueError as e:
                return SyncPushResult(
                    entity_id=change.entity_id, status="error", message=str(e)
                )
        return SyncPushResult(entity_id=change.entity_id, status="success")

    elif change.action == "delete":
        deleted = await repo.delete(change.entity_id, user_id)
        if deleted:
            await sync_repo.record_deletion(user_id, "scheduled_post", change.entity_id)
        return SyncPushResult(entity_id=change.entity_id, status="success")

    return SyncPushResult(
        entity_id=change.entity_id,
        status="error",
        message=f"Unknown action: {change.action}",
    )


@router.get("/status")
async def sync_status(user: ClerkUser = Depends(get_current_user)):
    """Get sync status and statistics for the user."""
    if not settings.USE_SUPABASE:
        return {
            "enabled": False,
            "message": "Sync is only available when USE_SUPABASE is enabled",
        }

    from app.database_supabase import DraftRepository, ScheduledPostRepository

    draft_repo = DraftRepository()
    post_repo = ScheduledPostRepository()

    drafts = await draft_repo.list_by_user(user.user_id)
    posts = await post_repo.list_by_user(user.user_id)

    return {
        "enabled": True,
        "user_id": user.user_id,
        "draft_count": len(drafts),
        "scheduled_post_count": len(posts),
        "last_checked": datetime.utcnow().isoformat(),
    }

"""
Export API router.

Provides endpoints for exporting user data (GDPR compliance).
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware.auth import ClerkUser, get_current_user

router = APIRouter()


@router.get("/drafts")
async def export_drafts(user: ClerkUser = Depends(get_current_user)):
    """
    Export all user drafts as JSON.

    Returns a downloadable JSON file containing all drafts.
    """
    if settings.USE_SUPABASE:
        from app.database_supabase import DraftRepository

        repo = DraftRepository()
        drafts = await repo.list_by_user(user.user_id, limit=10000)
    else:
        # SQLite fallback - return empty for now
        drafts = []

    export_data = {
        "exported_at": datetime.utcnow().isoformat(),
        "user_id": user.user_id,
        "export_version": "1.0",
        "drafts": drafts,
        "draft_count": len(drafts),
    }

    filename = f"postfarm-drafts-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"

    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/scheduled-posts")
async def export_scheduled_posts(user: ClerkUser = Depends(get_current_user)):
    """
    Export all user scheduled posts as JSON.
    """
    if settings.USE_SUPABASE:
        from app.database_supabase import ScheduledPostRepository

        repo = ScheduledPostRepository()
        posts = await repo.list_by_user(user.user_id, limit=10000)
    else:
        posts = []

    export_data = {
        "exported_at": datetime.utcnow().isoformat(),
        "user_id": user.user_id,
        "export_version": "1.0",
        "scheduled_posts": posts,
        "post_count": len(posts),
    }

    filename = (
        f"postfarm-scheduled-posts-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
    )

    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/all")
async def export_all_data(user: ClerkUser = Depends(get_current_user)):
    """
    Export all user data as JSON (full data export for GDPR).

    Includes:
    - All drafts
    - All scheduled posts
    - User metadata
    """
    if settings.USE_SUPABASE:
        from app.database_supabase import DraftRepository, ScheduledPostRepository

        draft_repo = DraftRepository()
        post_repo = ScheduledPostRepository()

        drafts = await draft_repo.list_by_user(user.user_id, limit=10000)
        posts = await post_repo.list_by_user(user.user_id, limit=10000)
    else:
        drafts = []
        posts = []

    export_data = {
        "exported_at": datetime.utcnow().isoformat(),
        "export_version": "1.0",
        "user": {"user_id": user.user_id, "email": user.email},
        "data": {
            "drafts": {"items": drafts, "count": len(drafts)},
            "scheduled_posts": {"items": posts, "count": len(posts)},
        },
        "totals": {"draft_count": len(drafts), "scheduled_post_count": len(posts)},
    }

    filename = f"postfarm-export-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"

    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

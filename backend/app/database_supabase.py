"""
Supabase client abstraction for PostFarm.

This module provides a wrapper around the Supabase Python client,
handling connection management and providing typed query builders.
"""

from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional
from uuid import UUID

from supabase import Client, create_client

from app.config import settings


@lru_cache()
def get_supabase_client() -> Client:
    """
    Get a cached Supabase client instance.

    Uses the service role key for backend operations, which bypasses RLS.
    User scoping is handled in application code by filtering on user_id.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise ValueError(
            "Supabase configuration missing. "
            "Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file."
        )

    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


class DraftRepository:
    """Repository for draft operations in Supabase."""

    def __init__(self, client: Optional[Client] = None):
        self.client = client or get_supabase_client()
        self.table = "drafts"

    async def list_by_user(
        self, user_id: str, skip: int = 0, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List all drafts for a user."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(skip, skip + limit - 1)
            .execute()
        )

        return response.data

    async def get_by_id(self, draft_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific draft by ID, scoped to user."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("id", draft_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        return response.data

    async def create(
        self, user_id: str, data: Dict[str, Any], draft_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new draft."""
        draft_data = {
            "user_id": user_id,
            "title": data.get("title"),
            "content": data.get("content", ""),
            "prompt": data.get("prompt"),
            "tags": data.get("tags", []),
            "confirmed": data.get("confirmed", False),
            "scheduled_at": data.get("scheduled_at"),
        }

        # Allow client-provided UUID for offline-first support
        if draft_id:
            draft_data["id"] = draft_id

        response = self.client.table(self.table).insert(draft_data).execute()

        if not response.data:
            raise ValueError("Failed to create draft")

        return response.data[0]

    async def update(
        self,
        draft_id: str,
        user_id: str,
        data: Dict[str, Any],
        client_updated_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Update a draft with optional conflict detection.

        If client_updated_at is provided, checks for conflicts.
        Raises ValueError with conflict details if server version is newer.
        """
        # Check for conflicts if client_updated_at provided
        if client_updated_at:
            existing = (
                self.client.table(self.table)
                .select("updated_at")
                .eq("id", draft_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not existing.data:
                raise ValueError("Draft not found")

            server_updated_at = datetime.fromisoformat(
                existing.data["updated_at"].replace("Z", "+00:00")
            )

            if server_updated_at > client_updated_at:
                raise ConflictError(
                    "Draft was modified on another device",
                    server_updated_at=existing.data["updated_at"],
                )

        # Build update dict, excluding None values
        update_data = {}
        for key in ["title", "content", "prompt", "tags", "confirmed", "scheduled_at"]:
            if key in data and data[key] is not None:
                update_data[key] = data[key]

        response = (
            self.client.table(self.table)
            .update(update_data)
            .eq("id", draft_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not response.data:
            raise ValueError("Draft not found or update failed")

        return response.data[0]

    async def delete(self, draft_id: str, user_id: str) -> bool:
        """Delete a draft."""
        response = (
            self.client.table(self.table)
            .delete()
            .eq("id", draft_id)
            .eq("user_id", user_id)
            .execute()
        )

        return len(response.data) > 0

    async def get_modified_since(
        self, user_id: str, since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get all drafts modified since a given timestamp."""
        query = self.client.table(self.table).select("*").eq("user_id", user_id)

        if since:
            query = query.gte("updated_at", since.isoformat())

        response = query.order("updated_at", desc=True).execute()
        return response.data


class ScheduledPostRepository:
    """Repository for scheduled post operations in Supabase."""

    def __init__(self, client: Optional[Client] = None):
        self.client = client or get_supabase_client()
        self.table = "scheduled_posts"

    async def list_by_user(
        self,
        user_id: str,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """List scheduled posts for a user."""
        query = self.client.table(self.table).select("*").eq("user_id", user_id)

        if status:
            query = query.eq("status", status)

        response = (
            query.order("scheduled_time", desc=False)
            .range(skip, skip + limit - 1)
            .execute()
        )

        return response.data

    async def get_by_id(self, post_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific scheduled post by ID."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("id", post_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        return response.data

    async def create(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new scheduled post."""
        post_data = {
            "user_id": user_id,
            "draft_id": data.get("draft_id"),
            "platform": data["platform"],
            "content": data["content"],
            "scheduled_time": data["scheduled_time"],
            "status": "scheduled",
        }

        response = self.client.table(self.table).insert(post_data).execute()

        if not response.data:
            raise ValueError("Failed to create scheduled post")

        return response.data[0]

    async def update_status(
        self,
        post_id: str,
        user_id: str,
        status: str,
        error_message: Optional[str] = None,
        posted_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Update the status of a scheduled post."""
        update_data = {"status": status}

        if error_message is not None:
            update_data["error_message"] = error_message
        if posted_at is not None:
            update_data["posted_at"] = posted_at.isoformat()

        response = (
            self.client.table(self.table)
            .update(update_data)
            .eq("id", post_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not response.data:
            raise ValueError("Scheduled post not found")

        return response.data[0]

    async def delete(self, post_id: str, user_id: str) -> bool:
        """Delete a scheduled post."""
        response = (
            self.client.table(self.table)
            .delete()
            .eq("id", post_id)
            .eq("user_id", user_id)
            .execute()
        )

        return len(response.data) > 0

    async def get_calendar(
        self, user_id: str, start_date: datetime, end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get scheduled posts for a date range (calendar view)."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("user_id", user_id)
            .gte("scheduled_time", start_date.isoformat())
            .lte("scheduled_time", end_date.isoformat())
            .order("scheduled_time", desc=False)
            .execute()
        )

        return response.data

    async def get_modified_since(
        self, user_id: str, since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get all scheduled posts modified since a given timestamp."""
        query = self.client.table(self.table).select("*").eq("user_id", user_id)

        if since:
            query = query.gte("created_at", since.isoformat())

        response = query.order("created_at", desc=True).execute()
        return response.data


class SyncMetadataRepository:
    """Repository for sync metadata (tracking deletions)."""

    def __init__(self, client: Optional[Client] = None):
        self.client = client or get_supabase_client()
        self.table = "sync_metadata"

    async def record_deletion(
        self, user_id: str, entity_type: str, entity_id: str
    ) -> Dict[str, Any]:
        """Record a deletion for sync purposes."""
        data = {
            "user_id": user_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": "delete",
        }

        response = self.client.table(self.table).insert(data).execute()

        return response.data[0] if response.data else None

    async def get_deletions_since(
        self, user_id: str, since: Optional[datetime] = None
    ) -> List[str]:
        """Get entity IDs deleted since a given timestamp."""
        query = (
            self.client.table(self.table)
            .select("entity_id")
            .eq("user_id", user_id)
            .eq("action", "delete")
        )

        if since:
            query = query.gte("created_at", since.isoformat())

        response = query.execute()
        return [item["entity_id"] for item in response.data]


class UserSecretsRepository:
    """Repository for storing encrypted user secrets (OAuth tokens, API keys)."""

    def __init__(self, client: Optional[Client] = None):
        self.client = client or get_supabase_client()
        self.table = "user_secrets"

    async def get_secret(
        self, user_id: str, secret_type: str
    ) -> Optional[Dict[str, Any]]:
        """Get a secret by type (e.g., 'twitter', 'linkedin')."""
        response = (
            self.client.table(self.table)
            .select("secret_data")
            .eq("user_id", user_id)
            .eq("secret_type", secret_type)
            .maybe_single()
            .execute()
        )

        return response.data["secret_data"] if response.data else None

    async def upsert_secret(
        self, user_id: str, secret_type: str, secret_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Insert or update a secret."""
        data = {
            "user_id": user_id,
            "secret_type": secret_type,
            "secret_data": secret_data,
        }

        response = (
            self.client.table(self.table)
            .upsert(data, on_conflict="user_id,secret_type")
            .execute()
        )

        if not response.data:
            raise ValueError("Failed to store secret")

        return response.data[0]

    async def delete_secret(self, user_id: str, secret_type: str) -> bool:
        """Delete a secret."""
        response = (
            self.client.table(self.table)
            .delete()
            .eq("user_id", user_id)
            .eq("secret_type", secret_type)
            .execute()
        )

        return len(response.data) > 0


class ConflictError(Exception):
    """Raised when a sync conflict is detected."""

    def __init__(self, message: str, server_updated_at: str):
        super().__init__(message)
        self.server_updated_at = server_updated_at

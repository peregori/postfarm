"""
Tests for OAuthStateRepository.
Tests CRUD operations, expiration logic, and cleanup.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta

from app.database_supabase import OAuthStateRepository


class TestOAuthStateRepository:
    """Test OAuthStateRepository functionality."""

    @pytest.mark.asyncio
    async def test_create_state(self, mock_supabase_client):
        """Test creating OAuth state."""
        repo = OAuthStateRepository(mock_supabase_client)

        # Mock execute response
        mock_response = Mock()
        mock_response.data = [{
            "state": "test_state_123",
            "user_id": "user_123",
            "platform": "twitter",
            "code_verifier": "verifier_xyz",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat(),
        }]
        mock_supabase_client.table().insert().execute.return_value = mock_response

        # Create state
        result = await repo.create_state(
            state="test_state_123",
            user_id="user_123",
            platform="twitter",
            code_verifier="verifier_xyz"
        )

        # Verify
        assert result["state"] == "test_state_123"
        assert result["user_id"] == "user_123"
        assert result["platform"] == "twitter"

    @pytest.mark.asyncio
    async def test_get_state_valid(self, mock_supabase_client):
        """Test retrieving valid OAuth state."""
        repo = OAuthStateRepository(mock_supabase_client)

        # Mock execute response
        mock_response = Mock()
        mock_response.data = {
            "state": "test_state",
            "user_id": "user_123",
            "platform": "twitter",
            "code_verifier": "verifier",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
        }
        mock_supabase_client.table().select().eq().maybe_single().execute.return_value = mock_response

        # Get state
        result = await repo.get_state("test_state")

        # Verify
        assert result is not None
        assert result["state"] == "test_state"

    @pytest.mark.asyncio
    async def test_get_state_expired(self, mock_supabase_client):
        """Test retrieving expired OAuth state returns None."""
        repo = OAuthStateRepository(mock_supabase_client)

        # Mock execute response with expired state
        mock_response = Mock()
        mock_response.data = {
            "state": "expired_state",
            "user_id": "user_123",
            "platform": "twitter",
            "code_verifier": "verifier",
            "created_at": (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
            "expires_at": (datetime.utcnow() - timedelta(minutes=5)).isoformat() + "Z",
        }
        mock_supabase_client.table().select().eq().maybe_single().execute.return_value = mock_response

        # Mock delete
        delete_response = Mock()
        delete_response.data = [{"state": "expired_state"}]
        mock_supabase_client.table().delete().eq().execute.return_value = delete_response

        # Get state
        result = await repo.get_state("expired_state")

        # Should return None and delete the expired state
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_state(self, mock_supabase_client):
        """Test deleting OAuth state."""
        repo = OAuthStateRepository(mock_supabase_client)

        # Mock execute response
        mock_response = Mock()
        mock_response.data = [{"state": "test_state"}]
        mock_supabase_client.table().delete().eq().execute.return_value = mock_response

        # Delete state
        result = await repo.delete_state("test_state")

        # Verify
        assert result is True

    @pytest.mark.asyncio
    async def test_cleanup_expired(self, mock_supabase_client):
        """Test cleanup of expired states."""
        repo = OAuthStateRepository(mock_supabase_client)

        # Mock execute response (3 states deleted)
        mock_response = Mock()
        mock_response.data = [{"state": "1"}, {"state": "2"}, {"state": "3"}]
        mock_supabase_client.table().delete().lt().execute.return_value = mock_response

        # Cleanup
        result = await repo.cleanup_expired()

        # Verify 3 states were deleted
        assert result == 3

"""
Tests for OAuth router endpoints.
Tests OAuth initiation, callback, disconnect, and status endpoints.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
from fastapi import HTTPException

from app.routers.oauth import (
    initiate_oauth,
    oauth_callback,
    disconnect_platform,
    get_oauth_status,
    OAuthStateCreate,
    OAuthTokenRequest,
)


class TestOAuthInitiate:
    """Tests for OAuth initiation endpoint."""

    @pytest.mark.asyncio
    async def test_initiate_oauth_twitter_success(self, mock_clerk_user, mock_supabase_client):
        """Test successful Twitter OAuth initiation with PKCE."""
        request = OAuthStateCreate(platform="twitter")

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True
            mock_settings.TWITTER_CLIENT_ID = "test_client_id"
            mock_settings.TWITTER_REDIRECT_URI = "http://localhost:3000/oauth/twitter/callback"

            # Mock repository
            mock_repo = AsyncMock()
            mock_repo.create_state = AsyncMock(return_value={
                "state": "test_state",
                "user_id": mock_clerk_user.user_id,
                "platform": "twitter",
                "code_verifier": "test_verifier",
            })
            mock_repo_class.return_value = mock_repo

            # Call endpoint
            response = await initiate_oauth(request, mock_clerk_user)

            # Verify response
            assert response.state is not None
            assert len(response.state) > 0
            assert "twitter.com/i/oauth2/authorize" in response.auth_url
            assert "code_challenge=" in response.auth_url
            assert "code_challenge_method=S256" in response.auth_url
            assert f"state={response.state}" in response.auth_url
            assert "client_id=test_client_id" in response.auth_url
            assert "scope=tweet.read" in response.auth_url

            # Verify state was stored
            mock_repo.create_state.assert_called_once()
            call_args = mock_repo.create_state.call_args[1]
            assert call_args["user_id"] == mock_clerk_user.user_id
            assert call_args["platform"] == "twitter"
            assert len(call_args["code_verifier"]) > 40  # PKCE verifier length

    @pytest.mark.asyncio
    async def test_initiate_oauth_linkedin_success(self, mock_clerk_user):
        """Test successful LinkedIn OAuth initiation."""
        request = OAuthStateCreate(platform="linkedin")

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True
            mock_settings.LINKEDIN_CLIENT_ID = "test_linkedin_client"
            mock_settings.LINKEDIN_REDIRECT_URI = "http://localhost:3000/oauth/linkedin/callback"

            # Mock repository
            mock_repo = AsyncMock()
            mock_repo.create_state = AsyncMock()
            mock_repo_class.return_value = mock_repo

            # Call endpoint
            response = await initiate_oauth(request, mock_clerk_user)

            # Verify response
            assert response.state is not None
            assert "linkedin.com/oauth/v2/authorization" in response.auth_url
            assert f"state={response.state}" in response.auth_url
            assert "client_id=test_linkedin_client" in response.auth_url
            assert "scope=w_member_social" in response.auth_url
            # LinkedIn doesn't use PKCE
            assert "code_challenge=" not in response.auth_url

    @pytest.mark.asyncio
    async def test_initiate_oauth_invalid_platform(self, mock_clerk_user):
        """Test OAuth initiation with invalid platform."""
        request = OAuthStateCreate(platform="invalid_platform")

        with patch("app.routers.oauth.settings") as mock_settings:
            mock_settings.USE_SUPABASE = True

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await initiate_oauth(request, mock_clerk_user)

            assert exc_info.value.status_code == 400
            assert "Unsupported platform" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_initiate_oauth_supabase_disabled(self, mock_clerk_user):
        """Test OAuth initiation when Supabase is disabled."""
        request = OAuthStateCreate(platform="twitter")

        with patch("app.routers.oauth.settings") as mock_settings:
            mock_settings.USE_SUPABASE = False

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await initiate_oauth(request, mock_clerk_user)

            assert exc_info.value.status_code == 501
            assert "Supabase" in exc_info.value.detail


class TestOAuthCallback:
    """Tests for OAuth callback endpoint."""

    @pytest.mark.asyncio
    async def test_oauth_callback_success_twitter(self, mock_clerk_user, mock_twitter_token_response):
        """Test successful Twitter OAuth callback."""
        request = OAuthTokenRequest(
            code="test_auth_code",
            state="test_state_123",
            platform="twitter"
        )

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class, \
             patch("app.routers.oauth._exchange_twitter_code") as mock_exchange, \
             patch("app.routers.oauth._store_oauth_tokens") as mock_store:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock state repository
            mock_repo = AsyncMock()
            mock_repo.get_state = AsyncMock(return_value={
                "state": "test_state_123",
                "user_id": mock_clerk_user.user_id,
                "platform": "twitter",
                "code_verifier": "test_verifier_xyz",
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
            })
            mock_repo.delete_state = AsyncMock()
            mock_repo_class.return_value = mock_repo

            # Mock token exchange
            mock_exchange.return_value = mock_twitter_token_response

            # Mock token storage
            mock_store.return_value = None

            # Call endpoint
            response = await oauth_callback(request, mock_clerk_user)

            # Verify response
            assert response.success is True
            assert response.platform == "twitter"
            assert "connected" in response.message.lower()

            # Verify state was validated and deleted
            mock_repo.get_state.assert_called_once_with("test_state_123")
            mock_repo.delete_state.assert_called_once_with("test_state_123")

            # Verify token exchange used PKCE verifier
            mock_exchange.assert_called_once_with("test_auth_code", "test_verifier_xyz")

            # Verify tokens were stored
            mock_store.assert_called_once()

    @pytest.mark.asyncio
    async def test_oauth_callback_success_linkedin(self, mock_clerk_user, mock_linkedin_token_response):
        """Test successful LinkedIn OAuth callback."""
        request = OAuthTokenRequest(
            code="linkedin_code",
            state="linkedin_state",
            platform="linkedin"
        )

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class, \
             patch("app.routers.oauth._exchange_linkedin_code") as mock_exchange, \
             patch("app.routers.oauth._store_oauth_tokens") as mock_store:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock state repository
            mock_repo = AsyncMock()
            mock_repo.get_state = AsyncMock(return_value={
                "state": "linkedin_state",
                "user_id": mock_clerk_user.user_id,
                "platform": "linkedin",
                "code_verifier": "linkedin_verifier",
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
            })
            mock_repo.delete_state = AsyncMock()
            mock_repo_class.return_value = mock_repo

            # Mock token exchange
            mock_exchange.return_value = mock_linkedin_token_response

            # Mock token storage
            mock_store.return_value = None

            # Call endpoint
            response = await oauth_callback(request, mock_clerk_user)

            # Verify response
            assert response.success is True
            assert response.platform == "linkedin"

    @pytest.mark.asyncio
    async def test_oauth_callback_invalid_state(self, mock_clerk_user):
        """Test OAuth callback with invalid state."""
        request = OAuthTokenRequest(
            code="test_code",
            state="invalid_state",
            platform="twitter"
        )

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository returns None (state not found)
            mock_repo = AsyncMock()
            mock_repo.get_state = AsyncMock(return_value=None)
            mock_repo_class.return_value = mock_repo

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await oauth_callback(request, mock_clerk_user)

            assert exc_info.value.status_code == 400
            assert "Invalid or expired state" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_oauth_callback_expired_state(self, mock_clerk_user):
        """Test OAuth callback with expired state."""
        request = OAuthTokenRequest(
            code="test_code",
            state="expired_state",
            platform="twitter"
        )

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository returns None (get_state handles expiry internally)
            mock_repo = AsyncMock()
            mock_repo.get_state = AsyncMock(return_value=None)
            mock_repo_class.return_value = mock_repo

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await oauth_callback(request, mock_clerk_user)

            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_oauth_callback_state_mismatch(self, mock_clerk_user):
        """Test OAuth callback with user mismatch."""
        request = OAuthTokenRequest(
            code="test_code",
            state="test_state",
            platform="twitter"
        )

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository returns state for different user
            mock_repo = AsyncMock()
            mock_repo.get_state = AsyncMock(return_value={
                "state": "test_state",
                "user_id": "different_user",  # Different user!
                "platform": "twitter",
                "code_verifier": "verifier",
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
            })
            mock_repo_class.return_value = mock_repo

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await oauth_callback(request, mock_clerk_user)

            assert exc_info.value.status_code == 403
            assert "State mismatch" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_oauth_callback_platform_mismatch(self, mock_clerk_user):
        """Test OAuth callback with platform mismatch."""
        request = OAuthTokenRequest(
            code="test_code",
            state="test_state",
            platform="twitter"
        )

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository returns state for different platform
            mock_repo = AsyncMock()
            mock_repo.get_state = AsyncMock(return_value={
                "state": "test_state",
                "user_id": mock_clerk_user.user_id,
                "platform": "linkedin",  # Different platform!
                "code_verifier": "verifier",
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
            })
            mock_repo_class.return_value = mock_repo

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await oauth_callback(request, mock_clerk_user)

            assert exc_info.value.status_code == 400
            assert "Platform mismatch" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_oauth_callback_network_failure(self, mock_clerk_user):
        """Test OAuth callback when token exchange fails."""
        request = OAuthTokenRequest(
            code="test_code",
            state="test_state",
            platform="twitter"
        )

        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.OAuthStateRepository") as mock_repo_class, \
             patch("app.routers.oauth._exchange_twitter_code") as mock_exchange:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock state repository
            mock_repo = AsyncMock()
            mock_repo.get_state = AsyncMock(return_value={
                "state": "test_state",
                "user_id": mock_clerk_user.user_id,
                "platform": "twitter",
                "code_verifier": "verifier",
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
            })
            mock_repo.delete_state = AsyncMock()
            mock_repo_class.return_value = mock_repo

            # Mock token exchange failure
            mock_exchange.side_effect = Exception("Network error")

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await oauth_callback(request, mock_clerk_user)

            assert exc_info.value.status_code == 500
            assert "Failed to complete OAuth flow" in exc_info.value.detail


class TestOAuthDisconnect:
    """Tests for platform disconnect endpoint."""

    @pytest.mark.asyncio
    async def test_disconnect_platform_success(self, mock_clerk_user):
        """Test successful platform disconnection."""
        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.UserSecretsRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository
            mock_repo = AsyncMock()
            mock_repo.delete_secret = AsyncMock(return_value=True)
            mock_repo_class.return_value = mock_repo

            # Call endpoint
            response = await disconnect_platform("twitter", mock_clerk_user)

            # Verify response
            assert response["success"] is True
            assert response["platform"] == "twitter"
            assert "disconnected" in response["message"].lower()

            # Verify deletion was called
            mock_repo.delete_secret.assert_called_once_with(mock_clerk_user.user_id, "twitter")

    @pytest.mark.asyncio
    async def test_disconnect_platform_not_found(self, mock_clerk_user):
        """Test disconnecting platform when not connected."""
        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.UserSecretsRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository returns False (not found)
            mock_repo = AsyncMock()
            mock_repo.delete_secret = AsyncMock(return_value=False)
            mock_repo_class.return_value = mock_repo

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await disconnect_platform("twitter", mock_clerk_user)

            assert exc_info.value.status_code == 404
            assert "No tokens found" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_disconnect_invalid_platform(self, mock_clerk_user):
        """Test disconnecting invalid platform."""
        with patch("app.routers.oauth.settings") as mock_settings:
            mock_settings.USE_SUPABASE = True

            # Should raise HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await disconnect_platform("invalid", mock_clerk_user)

            assert exc_info.value.status_code == 400
            assert "Unsupported platform" in exc_info.value.detail


class TestOAuthStatus:
    """Tests for OAuth status endpoint."""

    @pytest.mark.asyncio
    async def test_get_oauth_status_connected(self, mock_clerk_user):
        """Test status endpoint when platform is connected."""
        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.UserSecretsRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository
            mock_repo = AsyncMock()
            mock_repo.get_secret = AsyncMock(return_value={
                "access_token": "token",
                "expires_at": "2025-12-31T00:00:00",
            })
            mock_repo_class.return_value = mock_repo

            # Call endpoint
            response = await get_oauth_status("twitter", mock_clerk_user)

            # Verify response
            assert response["connected"] is True
            assert response["platform"] == "twitter"
            assert response["expires_at"] == "2025-12-31T00:00:00"

    @pytest.mark.asyncio
    async def test_get_oauth_status_not_connected(self, mock_clerk_user):
        """Test status endpoint when platform is not connected."""
        with patch("app.routers.oauth.settings") as mock_settings, \
             patch("app.routers.oauth.UserSecretsRepository") as mock_repo_class:

            # Mock settings
            mock_settings.USE_SUPABASE = True

            # Mock repository returns None
            mock_repo = AsyncMock()
            mock_repo.get_secret = AsyncMock(return_value=None)
            mock_repo_class.return_value = mock_repo

            # Call endpoint
            response = await get_oauth_status("twitter", mock_clerk_user)

            # Verify response
            assert response["connected"] is False
            assert response["platform"] == "twitter"
            assert response["expires_at"] is None

    @pytest.mark.asyncio
    async def test_get_oauth_status_supabase_disabled(self, mock_clerk_user):
        """Test status endpoint when Supabase is disabled."""
        with patch("app.routers.oauth.settings") as mock_settings:
            mock_settings.USE_SUPABASE = False

            # Call endpoint
            response = await get_oauth_status("twitter", mock_clerk_user)

            # Verify response
            assert response["connected"] is False
            assert "Supabase" in response["message"]

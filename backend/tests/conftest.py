"""
Test configuration and fixtures for PostFarm backend tests.
"""

import pytest
from typing import AsyncGenerator, Dict, Any
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta


# Mock Clerk User
class MockClerkUser:
    """Mock Clerk user for testing authentication."""

    def __init__(self, user_id: str = "test_user_123"):
        self.user_id = user_id
        self.email = f"{user_id}@test.com"


@pytest.fixture
def mock_clerk_user():
    """Fixture providing a mock Clerk user."""
    return MockClerkUser()


@pytest.fixture
def mock_clerk_user_dependency(mock_clerk_user):
    """Fixture to override get_current_user dependency."""
    return lambda: mock_clerk_user


# Mock Supabase Client
@pytest.fixture
def mock_supabase_client():
    """Fixture providing a mock Supabase client."""
    mock_client = Mock()

    # Mock table operations
    mock_table = Mock()
    mock_client.table = Mock(return_value=mock_table)

    # Chain methods for query building
    mock_table.select = Mock(return_value=mock_table)
    mock_table.insert = Mock(return_value=mock_table)
    mock_table.update = Mock(return_value=mock_table)
    mock_table.delete = Mock(return_value=mock_table)
    mock_table.upsert = Mock(return_value=mock_table)
    mock_table.eq = Mock(return_value=mock_table)
    mock_table.lt = Mock(return_value=mock_table)
    mock_table.gte = Mock(return_value=mock_table)
    mock_table.maybe_single = Mock(return_value=mock_table)
    mock_table.order = Mock(return_value=mock_table)

    # Execute returns a response with data
    mock_response = Mock()
    mock_response.data = []
    mock_table.execute = Mock(return_value=mock_response)

    return mock_client


# Mock OAuth Provider Responses
@pytest.fixture
def mock_twitter_token_response():
    """Mock successful Twitter OAuth token response."""
    return {
        "access_token": "twitter_access_token_12345",
        "refresh_token": "twitter_refresh_token_67890",
        "token_type": "Bearer",
        "expires_in": 7200,
        "scope": "tweet.read tweet.write users.read offline.access",
    }


@pytest.fixture
def mock_linkedin_token_response():
    """Mock successful LinkedIn OAuth token response."""
    return {
        "access_token": "linkedin_access_token_12345",
        "token_type": "Bearer",
        "expires_in": 5184000,  # 60 days
        "scope": "openid profile w_member_social",
    }


@pytest.fixture
def mock_httpx_client():
    """Fixture providing a mock httpx AsyncClient."""

    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self._json_data = json_data
            self.status_code = status_code

        def json(self):
            return self._json_data

        def raise_for_status(self):
            if self.status_code >= 400:
                raise Exception(f"HTTP {self.status_code}")

    mock_client = AsyncMock()
    mock_client.post = AsyncMock()
    return mock_client


# Database fixtures for testing repositories
@pytest.fixture
def mock_oauth_state_data():
    """Sample OAuth state data."""
    return {
        "state": "test_state_12345",
        "user_id": "test_user_123",
        "platform": "twitter",
        "code_verifier": "test_verifier_abc123",
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat(),
    }


@pytest.fixture
def mock_user_secret_data():
    """Sample user secret data."""
    return {
        "user_id": "test_user_123",
        "secret_type": "twitter",
        "secret_data": {
            "access_token": "twitter_token_12345",
            "refresh_token": "twitter_refresh_12345",
            "token_type": "Bearer",
            "scope": "tweet.read tweet.write users.read offline.access",
            "expires_at": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
        },
    }


# FastAPI Test Client
@pytest.fixture
async def async_client():
    """Fixture providing async httpx client for testing FastAPI endpoints."""
    from httpx import AsyncClient
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


# Environment variable mocking
@pytest.fixture
def mock_oauth_settings():
    """Mock OAuth environment variables."""
    settings = {
        "TWITTER_CLIENT_ID": "test_twitter_client_id",
        "TWITTER_CLIENT_SECRET": "test_twitter_client_secret",
        "TWITTER_REDIRECT_URI": "http://localhost:3000/oauth/twitter/callback",
        "LINKEDIN_CLIENT_ID": "test_linkedin_client_id",
        "LINKEDIN_CLIENT_SECRET": "test_linkedin_client_secret",
        "LINKEDIN_REDIRECT_URI": "http://localhost:3000/oauth/linkedin/callback",
        "USE_SUPABASE": True,
    }

    with patch.dict("os.environ", settings):
        yield settings

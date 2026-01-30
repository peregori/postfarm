"""
OAuth 2.0 router for platform connections (Twitter, LinkedIn).
Handles authorization flows and token storage in Supabase.
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import ClerkUser, get_current_user

router = APIRouter(prefix="/oauth", tags=["oauth"])

# In-memory state storage (in production, use Redis or database)
_oauth_states = {}


class OAuthStateCreate(BaseModel):
    platform: str  # 'twitter' or 'linkedin'


class OAuthStateResponse(BaseModel):
    state: str
    auth_url: str


class OAuthTokenRequest(BaseModel):
    code: str
    state: str
    platform: str


class OAuthTokenResponse(BaseModel):
    success: bool
    platform: str
    message: str


@router.post("/initiate", response_model=OAuthStateResponse)
async def initiate_oauth(
    request: OAuthStateCreate,
    user: ClerkUser = Depends(get_current_user),
):
    """
    Initiate OAuth flow for a platform.
    Returns authorization URL for the user to visit.
    """
    platform = request.platform.lower()

    if platform not in ["twitter", "linkedin"]:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    # Generate secure random state
    state = secrets.token_urlsafe(32)

    # Store state with user_id and timestamp (expires in 10 minutes)
    _oauth_states[state] = {
        "user_id": user.user_id,
        "platform": platform,
        "created_at": datetime.utcnow(),
    }

    # Build authorization URL
    if platform == "twitter":
        # Twitter OAuth 2.0 with PKCE
        # Scopes: tweet.read, tweet.write, users.read, offline.access
        auth_params = {
            "response_type": "code",
            "client_id": settings.TWITTER_CLIENT_ID,
            "redirect_uri": settings.TWITTER_REDIRECT_URI,
            "scope": "tweet.read tweet.write users.read offline.access",
            "state": state,
            "code_challenge": "challenge",  # TODO: Implement PKCE properly
            "code_challenge_method": "plain",
        }
        auth_url = "https://twitter.com/i/oauth2/authorize?" + urlencode(auth_params)

    elif platform == "linkedin":
        # LinkedIn OAuth 2.0
        # Scopes: w_member_social, r_liteprofile
        auth_params = {
            "response_type": "code",
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            "scope": "w_member_social r_liteprofile",
            "state": state,
        }
        auth_url = "https://www.linkedin.com/oauth/v2/authorization?" + urlencode(
            auth_params
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    return OAuthStateResponse(state=state, auth_url=auth_url)


@router.post("/callback", response_model=OAuthTokenResponse)
async def oauth_callback(
    request: OAuthTokenRequest,
    user: ClerkUser = Depends(get_current_user),
):
    """
    Handle OAuth callback.
    Exchange authorization code for access token and store in Supabase.
    """
    platform = request.platform.lower()
    code = request.code
    state = request.state

    # Verify state
    if state not in _oauth_states:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    state_data = _oauth_states[state]
    if state_data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="State mismatch")

    # Check expiration (10 minutes)
    if datetime.utcnow() - state_data["created_at"] > timedelta(minutes=10):
        del _oauth_states[state]
        raise HTTPException(status_code=400, detail="State expired")

    # Remove state from storage
    del _oauth_states[state]

    # Exchange code for token
    try:
        if platform == "twitter":
            token_data = await _exchange_twitter_code(code)
        elif platform == "linkedin":
            token_data = await _exchange_linkedin_code(code)
        else:
            raise HTTPException(status_code=400, detail="Unsupported platform")

        # Store tokens in Supabase
        await _store_oauth_tokens(user.user_id, platform, token_data)

        return OAuthTokenResponse(
            success=True,
            platform=platform,
            message=f"{platform.capitalize()} connected successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete OAuth flow: {str(e)}",
        )


@router.delete("/{platform}")
async def disconnect_platform(
    platform: str,
    user: ClerkUser = Depends(get_current_user),
):
    """
    Disconnect a platform by deleting stored tokens.
    """
    platform = platform.lower()

    if platform not in ["twitter", "linkedin"]:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    if not settings.USE_SUPABASE:
        raise HTTPException(
            status_code=501,
            detail="OAuth is only available when USE_SUPABASE is enabled",
        )

    from app.database_supabase import UserSecretsRepository

    repo = UserSecretsRepository()
    deleted = await repo.delete_secret(user.user_id, platform)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"No tokens found for {platform}",
        )

    return {
        "success": True,
        "platform": platform,
        "message": f"{platform.capitalize()} disconnected",
    }


@router.get("/{platform}/status")
async def get_oauth_status(
    platform: str,
    user: ClerkUser = Depends(get_current_user),
):
    """
    Check if a platform is connected (has valid tokens).
    """
    platform = platform.lower()

    if platform not in ["twitter", "linkedin"]:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    if not settings.USE_SUPABASE:
        return {
            "connected": False,
            "platform": platform,
            "message": "OAuth requires Supabase",
        }

    from app.database_supabase import UserSecretsRepository

    repo = UserSecretsRepository()
    secret = await repo.get_secret(user.user_id, platform)

    return {
        "connected": secret is not None,
        "platform": platform,
        "expires_at": secret.get("expires_at") if secret else None,
    }


# Helper functions


async def _exchange_twitter_code(code: str) -> dict:
    """
    Exchange Twitter authorization code for access token.
    Returns: {access_token, refresh_token, expires_in, scope}
    """
    import httpx

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "code": code,
                "grant_type": "authorization_code",
                "client_id": settings.TWITTER_CLIENT_ID,
                "redirect_uri": settings.TWITTER_REDIRECT_URI,
                "code_verifier": "challenge",  # TODO: Use real PKCE verifier
            },
            auth=(settings.TWITTER_CLIENT_ID, settings.TWITTER_CLIENT_SECRET),
        )
        response.raise_for_status()
        return response.json()


async def _exchange_linkedin_code(code: str) -> dict:
    """
    Exchange LinkedIn authorization code for access token.
    Returns: {access_token, expires_in, scope}
    """
    import httpx

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            },
        )
        response.raise_for_status()
        return response.json()


async def _store_oauth_tokens(user_id: str, platform: str, token_data: dict):
    """
    Store OAuth tokens in Supabase user_secrets table.
    """
    if not settings.USE_SUPABASE:
        raise ValueError("Supabase is required for token storage")

    from app.database_supabase import UserSecretsRepository

    repo = UserSecretsRepository()

    # Calculate expiration time
    expires_in = token_data.get("expires_in", 7200)  # Default 2 hours
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    secret_data = {
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "token_type": token_data.get("token_type", "Bearer"),
        "scope": token_data.get("scope", ""),
        "expires_at": expires_at.isoformat(),
    }

    await repo.upsert_secret(user_id, platform, secret_data)


async def refresh_oauth_token(user_id: str, platform: str) -> dict:
    """
    Refresh an expired OAuth token.
    Returns new token data.
    """
    if not settings.USE_SUPABASE:
        raise ValueError("Supabase is required for token refresh")

    from app.database_supabase import UserSecretsRepository

    repo = UserSecretsRepository()
    secret = await repo.get_secret(user_id, platform)

    if not secret or not secret.get("refresh_token"):
        raise ValueError(f"No refresh token found for {platform}")

    # Refresh token
    if platform == "twitter":
        new_token_data = await _refresh_twitter_token(secret["refresh_token"])
    elif platform == "linkedin":
        # LinkedIn tokens don't support refresh (60-day expiry)
        raise ValueError("LinkedIn tokens cannot be refreshed")
    else:
        raise ValueError(f"Unsupported platform: {platform}")

    # Store new tokens
    await _store_oauth_tokens(user_id, platform, new_token_data)

    return new_token_data


async def _refresh_twitter_token(refresh_token: str) -> dict:
    """
    Refresh Twitter access token using refresh token.
    """
    import httpx

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": settings.TWITTER_CLIENT_ID,
            },
            auth=(settings.TWITTER_CLIENT_ID, settings.TWITTER_CLIENT_SECRET),
        )
        response.raise_for_status()
        return response.json()

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
from app.utils.pkce import generate_code_verifier, generate_code_challenge

router = APIRouter(prefix="/oauth", tags=["oauth"])


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

    if not settings.USE_SUPABASE:
        raise HTTPException(
            status_code=501,
            detail="OAuth requires Supabase for state storage",
        )

    # Generate secure random state and PKCE verifier
    state = secrets.token_urlsafe(32)
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)

    # Store state with PKCE verifier in database
    from app.database_supabase import OAuthStateRepository

    repo = OAuthStateRepository()
    await repo.create_state(
        state=state,
        user_id=user.user_id,
        platform=platform,
        code_verifier=code_verifier,
        ttl_seconds=600,  # 10 minutes
    )

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
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        auth_url = "https://twitter.com/i/oauth2/authorize?" + urlencode(auth_params)

    elif platform == "linkedin":
        # LinkedIn OAuth 2.0 (no PKCE support)
        # Scopes: openid, profile (replaces deprecated r_liteprofile), w_member_social
        auth_params = {
            "response_type": "code",
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            "scope": "openid profile w_member_social",
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

    if not settings.USE_SUPABASE:
        raise HTTPException(
            status_code=501,
            detail="OAuth requires Supabase",
        )

    # Retrieve and verify state from database
    from app.database_supabase import OAuthStateRepository

    repo = OAuthStateRepository()
    state_data = await repo.get_state(state)

    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    if state_data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="State mismatch")

    if state_data["platform"] != platform:
        raise HTTPException(status_code=400, detail="Platform mismatch")

    # Get PKCE code verifier
    code_verifier = state_data["code_verifier"]

    # Delete state (one-time use)
    await repo.delete_state(state)

    # Exchange code for token
    try:
        if platform == "twitter":
            token_data = await _exchange_twitter_code(code, code_verifier)
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


async def _exchange_twitter_code(code: str, code_verifier: str) -> dict:
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
                "code_verifier": code_verifier,
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


async def cleanup_expired_oauth_states():
    """
    Background task to clean up expired OAuth states.
    Should be called periodically (e.g., every 5 minutes).
    """
    if not settings.USE_SUPABASE:
        return

    from app.database_supabase import OAuthStateRepository

    repo = OAuthStateRepository()
    deleted_count = await repo.cleanup_expired()
    return deleted_count

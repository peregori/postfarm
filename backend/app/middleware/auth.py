"""
Clerk JWT authentication middleware for FastAPI.

This module provides dependency functions for verifying Clerk JWT tokens
and extracting user information from authenticated requests.
"""

import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)

# Cache for JWKS (JSON Web Key Set)
_jwks_cache = {
    "keys": None,
    "fetched_at": 0,
    "ttl": 3600,  # Cache for 1 hour
}


@dataclass
class ClerkUser:
    """Represents an authenticated Clerk user."""

    user_id: str
    session_id: Optional[str] = None
    email: Optional[str] = None


async def _fetch_jwks() -> dict:
    """
    Fetch Clerk's JWKS (JSON Web Key Set) for JWT verification.
    Results are cached to avoid frequent HTTP requests.
    """
    current_time = time.time()

    # Return cached keys if still valid
    if (
        _jwks_cache["keys"]
        and (current_time - _jwks_cache["fetched_at"]) < _jwks_cache["ttl"]
    ):
        return _jwks_cache["keys"]

    # Fetch fresh JWKS from Clerk
    # Extract the Clerk instance from the publishable key
    # Format: pk_test_<instance_id>$  or pk_live_<instance_id>$
    # The instance_id is base64 encoded frontend API domain
    try:
        pk = settings.CLERK_PUBLISHABLE_KEY
        if not pk:
            raise ValueError("CLERK_PUBLISHABLE_KEY not configured")

        # Extract the base64 encoded part and decode to get the frontend API
        import base64

        # Remove pk_test_ or pk_live_ prefix and any trailing $
        parts = pk.split("_")
        if len(parts) < 3:
            raise ValueError(f"Invalid CLERK_PUBLISHABLE_KEY format")

        encoded_part = parts[2].rstrip("$")

        # Decode base64 to get the frontend API domain
        # Add padding if needed
        padding = 4 - len(encoded_part) % 4
        if padding != 4:
            encoded_part += "=" * padding

        try:
            decoded = base64.b64decode(encoded_part).decode("utf-8").rstrip("$")
            frontend_api = f"https://{decoded}"
        except Exception:
            # Fallback: try using the secret key's instance or construct from key
            # The frontend API is typically: https://<instance>.clerk.accounts.dev
            raise ValueError(
                f"Could not decode CLERK_PUBLISHABLE_KEY. Please check it's correctly set."
            )

        jwks_url = f"{frontend_api}/.well-known/jwks.json"

        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            jwks = response.json()

        # Update cache
        _jwks_cache["keys"] = jwks
        _jwks_cache["fetched_at"] = current_time

        return jwks
    except Exception as e:
        # If we have cached keys, use them even if expired
        if _jwks_cache["keys"]:
            return _jwks_cache["keys"]
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch Clerk JWKS: {str(e)}",
        )


def _get_signing_key(jwks: dict, kid: str) -> Optional[str]:
    """Extract the signing key from JWKS matching the key ID."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            # Convert JWK to PEM format
            from jwt import algorithms

            return algorithms.RSAAlgorithm.from_jwk(key)
    return None


async def verify_clerk_token(token: str) -> ClerkUser:
    """
    Verify a Clerk JWT token and extract user information.

    Args:
        token: The JWT token from the Authorization header

    Returns:
        ClerkUser object with user information

    Raises:
        HTTPException: If token is invalid or verification fails
    """
    try:
        # Decode header to get the key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing key ID",
            )

        # Fetch JWKS and get the signing key
        jwks = await _fetch_jwks()
        signing_key = _get_signing_key(jwks, kid)

        if not signing_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: unknown signing key",
            )

        # Verify and decode the token
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            options={
                "verify_aud": False,  # Clerk doesn't always set aud
                "verify_iss": False,  # We verify via JWKS instead
            },
        )

        # Extract user information
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )

        return ClerkUser(
            user_id=user_id, session_id=payload.get("sid"), email=payload.get("email")
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}"
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> ClerkUser:
    """
    FastAPI dependency to get the current authenticated user.

    Raises HTTPException 401 if not authenticated.

    Usage:
        @router.get("/protected")
        async def protected_route(user: ClerkUser = Depends(get_current_user)):
            return {"user_id": user.user_id}
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await verify_clerk_token(credentials.credentials)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[ClerkUser]:
    """
    FastAPI dependency to optionally get the current user.

    Returns None if not authenticated (no error raised).

    Usage:
        @router.get("/public")
        async def public_route(user: Optional[ClerkUser] = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello, {user.user_id}"}
            return {"message": "Hello, anonymous"}
    """
    if not credentials:
        return None

    try:
        return await verify_clerk_token(credentials.credentials)
    except HTTPException:
        return None

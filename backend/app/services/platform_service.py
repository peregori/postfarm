import httpx
import os
from typing import Optional
from app.database import SessionLocal
from app.models import PlatformType, PlatformConfig
from sqlalchemy import select
import logging
import base64
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)

class PlatformService:
    """Service for publishing to social media platforms"""

    async def publish_post(self, platform: str, content: str, user_id: Optional[str] = None) -> dict:
        """
        Publish content to the specified platform

        Args:
            platform: Platform name (twitter, linkedin)
            content: Content to post
            user_id: User ID for Supabase token lookup (required in Supabase mode)

        Returns:
            Response dictionary with post details
        """
        if platform == PlatformType.TWITTER.value:
            return await self._post_to_twitter(content, user_id)
        elif platform == PlatformType.LINKEDIN.value:
            return await self._post_to_linkedin(content, user_id)
        else:
            raise ValueError(f"Unsupported platform: {platform}")
    
    async def _post_to_twitter(self, content: str, user_id: Optional[str] = None) -> dict:
        """Post to Twitter/X using API v2 with OAuth 2.0 tokens"""

        if settings.USE_SUPABASE:
            # Use Supabase mode - fetch user's OAuth tokens
            if not user_id:
                raise ValueError("user_id is required for Supabase mode")

            from app.database_supabase import UserSecretsRepository
            repo = UserSecretsRepository()

            secret = await repo.get_secret(user_id, "twitter")
            if not secret or not secret.get("access_token"):
                raise ValueError("Twitter not connected. Please connect your Twitter account first.")

            # Check if token is expired
            expires_at = datetime.fromisoformat(secret["expires_at"].replace("Z", "+00:00"))
            if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) >= expires_at:
                # Token expired - attempt refresh
                from app.routers.oauth import refresh_oauth_token
                try:
                    new_token_data = await refresh_oauth_token(user_id, "twitter")
                    access_token = new_token_data["access_token"]
                except Exception as e:
                    raise ValueError(f"Twitter token expired and refresh failed: {str(e)}")
            else:
                access_token = secret["access_token"]

            # Twitter API v2 endpoint
            url = "https://api.twitter.com/2/tweets"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

        else:
            # Legacy SQLite mode
            db = SessionLocal()
            try:
                result = db.execute(
                    select(PlatformConfig).where(
                        PlatformConfig.platform == PlatformType.TWITTER,
                        PlatformConfig.is_active == True
                    )
                )
                config = result.scalar_one_or_none()

                if not config or not config.bearer_token:
                    raise ValueError("Twitter API credentials not configured")

                # Twitter API v2 endpoint
                url = "https://api.twitter.com/2/tweets"
                headers = {
                    "Authorization": f"Bearer {config.bearer_token}",
                    "Content-Type": "application/json"
                }
            finally:
                db.close()

        # Twitter has a 280 character limit
        if len(content) > 280:
            content = content[:277] + "..."

        payload = {
            "text": content
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

            return {
                "success": True,
                "platform": "twitter",
                "post_id": data.get("data", {}).get("id"),
                "content": content,
                "posted_at": datetime.utcnow().isoformat()
            }
    
    async def _post_to_linkedin(self, content: str, user_id: Optional[str] = None) -> dict:
        """Post to LinkedIn using API with OAuth 2.0 tokens"""

        if settings.USE_SUPABASE:
            # Use Supabase mode - fetch user's OAuth tokens
            if not user_id:
                raise ValueError("user_id is required for Supabase mode")

            from app.database_supabase import UserSecretsRepository
            repo = UserSecretsRepository()

            secret = await repo.get_secret(user_id, "linkedin")
            if not secret or not secret.get("access_token"):
                raise ValueError("LinkedIn not connected. Please connect your LinkedIn account first.")

            # Note: LinkedIn tokens have 60-day expiry and cannot be refreshed
            # In production, re-authentication would be needed
            access_token = secret["access_token"]

            # LinkedIn API v2: Get user profile URN
            # We'll use the person URN format for posting as an individual
            # For now, we'll use a simplified approach and post as the authenticated user
            url = "https://api.linkedin.com/v2/ugcPosts"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }

            # Get user profile ID first
            profile_response = await self._get_linkedin_profile(access_token)
            author_urn = profile_response.get("id")

            if not author_urn:
                raise ValueError("Failed to get LinkedIn profile ID")

            # LinkedIn API v2 UGC Post structure for individual user
            payload = {
                "author": f"urn:li:person:{author_urn}",
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": content
                        },
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }

        else:
            # Legacy SQLite mode
            db = SessionLocal()
            try:
                result = db.execute(
                    select(PlatformConfig).where(
                        PlatformConfig.platform == PlatformType.LINKEDIN,
                        PlatformConfig.is_active == True
                    )
                )
                config = result.scalar_one_or_none()

                if not config or not config.access_token:
                    raise ValueError("LinkedIn API credentials not configured")

                # LinkedIn API endpoint for shares
                # Note: LinkedIn requires organization ID for posting
                if not config.linkedin_org_id:
                    raise ValueError("LinkedIn organization ID not configured")

                url = "https://api.linkedin.com/v2/ugcPosts"

                headers = {
                    "Authorization": f"Bearer {config.access_token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0"
                }

                # LinkedIn API v2 UGC Post structure
                payload = {
                    "author": f"urn:li:organization:{config.linkedin_org_id}",
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": content
                            },
                            "shareMediaCategory": "NONE"
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
            finally:
                db.close()

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

            return {
                "success": True,
                "platform": "linkedin",
                "post_id": data.get("id"),
                "content": content,
                "posted_at": datetime.utcnow().isoformat()
            }

    async def _get_linkedin_profile(self, access_token: str) -> dict:
        """Get LinkedIn profile information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.linkedin.com/v2/me",
                headers={
                    "Authorization": f"Bearer {access_token}",
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def test_connection(self, platform: str) -> dict:
        """Test connection to platform API"""
        try:
            # For Twitter, we can check credentials without posting
            if platform == PlatformType.TWITTER.value:
                db = SessionLocal()
                try:
                    result = db.execute(
                        select(PlatformConfig).where(
                            PlatformConfig.platform == PlatformType.TWITTER,
                            PlatformConfig.is_active == True
                        )
                    )
                    config = result.scalar_one_or_none()
                    
                    if not config or not config.bearer_token:
                        return {"success": False, "message": "Credentials not configured"}
                    
                    # Test with a simple API call
                    url = "https://api.twitter.com/2/tweets/search/recent"
                    headers = {"Authorization": f"Bearer {config.bearer_token}"}
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.get(url, headers=headers, params={"query": "test", "max_results": 1})
                        if response.status_code == 200:
                            return {"success": True, "message": "Connection successful"}
                        else:
                            return {"success": False, "message": f"API error: {response.status_code}"}
                            
                finally:
                    db.close()
            
            elif platform == PlatformType.LINKEDIN.value:
                # Similar test for LinkedIn
                return {"success": True, "message": "Connection test not implemented"}
            
            return {"success": False, "message": "Unknown platform"}
            
        except Exception as e:
            return {"success": False, "message": str(e)}


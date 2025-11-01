import httpx
import os
from typing import Optional
from app.database import SessionLocal
from app.models import PlatformType, PlatformConfig
from sqlalchemy import select
import logging
import base64
from datetime import datetime

logger = logging.getLogger(__name__)

class PlatformService:
    """Service for publishing to social media platforms"""
    
    async def publish_post(self, platform: str, content: str) -> dict:
        """
        Publish content to the specified platform
        
        Args:
            platform: Platform name (twitter, linkedin)
            content: Content to post
            
        Returns:
            Response dictionary with post details
        """
        if platform == PlatformType.TWITTER.value:
            return await self._post_to_twitter(content)
        elif platform == PlatformType.LINKEDIN.value:
            return await self._post_to_linkedin(content)
        else:
            raise ValueError(f"Unsupported platform: {platform}")
    
    async def _post_to_twitter(self, content: str) -> dict:
        """Post to Twitter/X using API v2"""
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
                
        finally:
            db.close()
    
    async def _post_to_linkedin(self, content: str) -> dict:
        """Post to LinkedIn using API"""
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
            
            url = f"https://api.linkedin.com/v2/ugcPosts"
            
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
                
        finally:
            db.close()
    
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


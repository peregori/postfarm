from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PlatformConfig, PlatformType
from app.services.platform_service import PlatformService
from app.middleware.auth import ClerkUser, get_current_user
from app.config import settings
from sqlalchemy import select

router = APIRouter()
platform_service = PlatformService()

class PlatformConfigRequest(BaseModel):
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    access_token_secret: Optional[str] = None
    bearer_token: Optional[str] = None  # For Twitter
    linkedin_org_id: Optional[str] = None
    is_active: Optional[bool] = True

class PlatformConfigResponse(BaseModel):
    id: int
    platform: str
    is_active: bool
    updated_at: Optional[str]
    has_credentials: bool

class TestConnectionResponse(BaseModel):
    success: bool
    message: str

@router.get("/", response_model=list[PlatformConfigResponse])
async def list_platforms(db: Session = Depends(get_db)):
    """List all platform configurations"""
    result = db.execute(select(PlatformConfig))
    configs = result.scalars().all()
    
    return [
        PlatformConfigResponse(
            id=config.id,
            platform=config.platform.value,
            is_active=config.is_active,
            updated_at=config.updated_at.isoformat() if config.updated_at else None,
            has_credentials=bool(
                config.bearer_token or (config.access_token and config.api_key)
            )
        )
        for config in configs
    ]

@router.get("/{platform}", response_model=PlatformConfigResponse)
async def get_platform_config(platform: str, db: Session = Depends(get_db)):
    """Get configuration for a specific platform"""
    try:
        platform_type = PlatformType(platform.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")
    
    result = db.execute(
        select(PlatformConfig).where(PlatformConfig.platform == platform_type)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        # Create default config if it doesn't exist
        config = PlatformConfig(
            platform=platform_type,
            is_active=False
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    
    return PlatformConfigResponse(
        id=config.id,
        platform=config.platform.value,
        is_active=config.is_active,
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
        has_credentials=bool(
            config.bearer_token or (config.access_token and config.api_key)
        )
    )

@router.put("/{platform}", response_model=PlatformConfigResponse)
async def update_platform_config(
    platform: str,
    config_data: PlatformConfigRequest,
    db: Session = Depends(get_db)
):
    """Update platform configuration"""
    try:
        platform_type = PlatformType(platform.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")
    
    result = db.execute(
        select(PlatformConfig).where(PlatformConfig.platform == platform_type)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        config = PlatformConfig(platform=platform_type)
        db.add(config)
    
    # Update fields
    if config_data.api_key is not None:
        config.api_key = config_data.api_key
    if config_data.api_secret is not None:
        config.api_secret = config_data.api_secret
    if config_data.access_token is not None:
        config.access_token = config_data.access_token
    if config_data.access_token_secret is not None:
        config.access_token_secret = config_data.access_token_secret
    if config_data.bearer_token is not None:
        config.bearer_token = config_data.bearer_token
    if config_data.linkedin_org_id is not None:
        config.linkedin_org_id = config_data.linkedin_org_id
    if config_data.is_active is not None:
        config.is_active = config_data.is_active
    
    db.commit()
    db.refresh(config)
    
    return PlatformConfigResponse(
        id=config.id,
        platform=config.platform.value,
        is_active=config.is_active,
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
        has_credentials=bool(
            config.bearer_token or (config.access_token and config.api_key)
        )
    )

@router.post("/{platform}/test", response_model=TestConnectionResponse)
async def test_platform_connection(platform: str):
    """Test connection to platform API"""
    try:
        result = await platform_service.test_connection(platform.lower())
        return TestConnectionResponse(**result)
    except Exception as e:
        return TestConnectionResponse(success=False, message=str(e))

class PublishRequest(BaseModel):
    content: str

@router.post("/{platform}/publish", response_model=dict)
async def publish_now(
    platform: str,
    request: PublishRequest,
    user: ClerkUser = Depends(get_current_user),
):
    """Publish content immediately"""
    try:
        # Pass user_id for Supabase mode token lookup
        user_id = user.user_id if settings.USE_SUPABASE else None
        result = await platform_service.publish_post(
            platform.lower(),
            request.content,
            user_id=user_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


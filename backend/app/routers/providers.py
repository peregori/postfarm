from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AIProviderConfig
from app.providers.factory import list_providers, get_provider
from app.config import settings
import json

router = APIRouter()

class ProviderConfigRequest(BaseModel):
    config: Dict[str, Any]

class SelectProviderRequest(BaseModel):
    provider_name: str

@router.get("/")
async def list_available_providers():
    """List all available AI providers"""
    return {"providers": list_providers()}

@router.get("/current")
async def get_current_provider(db: Session = Depends(get_db)):
    """Get the currently active provider"""
    try:
        # Check database for active provider
        active_config = db.query(AIProviderConfig).filter(
            AIProviderConfig.is_active == True
        ).first()
        
        if active_config:
            return {
                "provider_name": active_config.provider_name,
                "display_name": active_config.to_dict().get("display_name", active_config.provider_name),
                "is_active": True
            }
        
        # Fall back to default from settings
        default_provider = settings.AI_PROVIDER
        providers = list_providers()
        provider_info = next((p for p in providers if p["name"] == default_provider), None)
        
        return {
            "provider_name": default_provider,
            "display_name": provider_info["display_name"] if provider_info else default_provider,
            "is_active": False  # Not explicitly set in DB
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting current provider: {str(e)}")

@router.post("/select")
async def select_provider(request: SelectProviderRequest, db: Session = Depends(get_db)):
    """Select and activate a provider"""
    try:
        # Validate provider exists
        providers = list_providers()
        provider_names = [p["name"] for p in providers]
        if request.provider_name not in provider_names:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown provider: {request.provider_name}"
            )
        
        # Deactivate all providers
        db.query(AIProviderConfig).update({AIProviderConfig.is_active: False})
        
        # Activate the selected provider
        provider_config = db.query(AIProviderConfig).filter(
            AIProviderConfig.provider_name == request.provider_name
        ).first()
        
        if provider_config:
            provider_config.is_active = True
        else:
            # Create new config if it doesn't exist
            provider_config = AIProviderConfig(
                provider_name=request.provider_name,
                is_active=True,
                config_json=None
            )
            db.add(provider_config)
        
        db.commit()
        
        return {
            "provider_name": request.provider_name,
            "message": f"Provider {request.provider_name} activated"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error selecting provider: {str(e)}")

@router.get("/{provider_name}/config")
async def get_provider_config(provider_name: str, db: Session = Depends(get_db)):
    """Get configuration for a specific provider"""
    try:
        provider_config = db.query(AIProviderConfig).filter(
            AIProviderConfig.provider_name == provider_name
        ).first()
        
        if provider_config:
            return provider_config.to_dict(include_secrets=False)
        else:
            # Return default config structure
            default_config = {}
            if provider_name == "llamacpp":
                default_config = {
                    "server_url": settings.LLAMA_CPP_SERVER_URL,
                    "model_name": settings.LLAMA_MODEL_NAME,
                }
            elif provider_name == "openai":
                default_config = {
                    "api_key": None,
                    "model": "gpt-4o-mini"
                }
            elif provider_name == "anthropic":
                default_config = {
                    "api_key": None,
                    "model": "claude-3-5-sonnet-20241022"
                }
            
            return {
                "provider_name": provider_name,
                "config": default_config,
                "is_active": False
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting provider config: {str(e)}")

@router.put("/{provider_name}/config")
async def update_provider_config(
    provider_name: str,
    request: ProviderConfigRequest,
    db: Session = Depends(get_db)
):
    """Update configuration for a specific provider"""
    try:
        provider_config = db.query(AIProviderConfig).filter(
            AIProviderConfig.provider_name == provider_name
        ).first()
        
        config_json = json.dumps(request.config)
        
        if provider_config:
            provider_config.config_json = config_json
        else:
            provider_config = AIProviderConfig(
                provider_name=provider_name,
                config_json=config_json,
                is_active=False
            )
            db.add(provider_config)
        
        db.commit()
        
        return {
            "provider_name": provider_name,
            "message": "Configuration updated"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating provider config: {str(e)}")

@router.post("/{provider_name}/test")
async def test_provider(provider_name: str, db: Session = Depends(get_db)):
    """Test connection to a provider"""
    try:
        provider = get_provider(provider_name=provider_name, db=db)
        is_healthy = await provider.check_health()
        
        if is_healthy:
            return {
                "provider_name": provider_name,
                "status": "healthy",
                "message": f"{provider.get_display_name()} is accessible"
            }
        else:
            raise HTTPException(
                status_code=503,
                detail=f"{provider.get_display_name()} is not accessible"
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error testing provider: {str(e)}")


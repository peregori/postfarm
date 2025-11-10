from typing import Optional, Dict, List
from app.providers.base import BaseAIProvider
from app.providers.llamacpp import LlamaCppProvider
from app.config import settings
from sqlalchemy.orm import Session
from app.models import AIProviderConfig
import json

# Registry of available providers
_PROVIDER_REGISTRY = {
    'llamacpp': LlamaCppProvider,
}

# Try to register optional providers
try:
    from app.providers.openai import OpenAIProvider
    _PROVIDER_REGISTRY['openai'] = OpenAIProvider
except ImportError:
    pass

try:
    from app.providers.anthropic import AnthropicProvider
    _PROVIDER_REGISTRY['anthropic'] = AnthropicProvider
except ImportError:
    pass

def list_providers() -> List[Dict[str, str]]:
    """List all available providers"""
    providers = [
        {
            'name': 'llamacpp',
            'display_name': 'Llama.cpp',
            'description': 'Local llama.cpp server'
        },
    ]
    
    if 'openai' in _PROVIDER_REGISTRY:
        providers.append({
            'name': 'openai',
            'display_name': 'OpenAI',
            'description': 'OpenAI API (GPT-4, GPT-3.5, etc.)'
        })
    
    if 'anthropic' in _PROVIDER_REGISTRY:
        providers.append({
            'name': 'anthropic',
            'display_name': 'Anthropic',
            'description': 'Anthropic Claude API'
        })
    
    return providers

def get_provider(provider_name: Optional[str] = None, db: Optional[Session] = None) -> BaseAIProvider:
    """
    Get an AI provider instance
    
    Args:
        provider_name: Name of the provider (defaults to configured provider)
        db: Database session for loading config
        
    Returns:
        BaseAIProvider instance
    """
    # Determine which provider to use
    if provider_name is None:
        provider_name = settings.AI_PROVIDER
    
    if provider_name not in _PROVIDER_REGISTRY:
        raise ValueError(f"Unknown provider: {provider_name}")
    
    provider_class = _PROVIDER_REGISTRY[provider_name]
    
    # Load configuration from database if available
    config = {}
    if db:
        try:
            provider_config = db.query(AIProviderConfig).filter(
                AIProviderConfig.provider_name == provider_name
            ).first()
            
            if provider_config and provider_config.config_json:
                config = json.loads(provider_config.config_json)
        except Exception:
            # If database query fails, use defaults
            pass
    
    # For llama.cpp, merge with settings if config is empty
    if provider_name == 'llamacpp' and not config:
        config = {
            'server_url': settings.LLAMA_CPP_SERVER_URL,
            'model_name': settings.LLAMA_MODEL_NAME,
        }
    
    try:
        return provider_class(config=config)
    except Exception as e:
        raise ValueError(f"Failed to initialize provider {provider_name}: {str(e)}")


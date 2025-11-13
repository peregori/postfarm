import hashlib
import json
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.providers.factory import get_provider
from app.providers.base import BaseAIProvider

class LLMService:
    """Service for interacting with AI providers"""
    
    def __init__(self, db: Optional[Session] = None):
        self.db = db
        # Simple in-memory cache: {cache_key: (content, expiry_time)}
        self._cache: dict[str, tuple[str, datetime]] = {}
        self._cache_ttl = timedelta(hours=24)  # Cache for 24 hours
        self._max_cache_size = 1000  # Limit cache size
        self._provider: Optional[BaseAIProvider] = None
        
    def _get_cache_key(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int,
        temperature: float,
        platform: Optional[str] = None
    ) -> str:
        """Generate a cache key from prompt and parameters"""
        # Create a hash from the request parameters
        # For caching purposes, we round temperature to 2 decimals to allow some variance
        cache_data = {
            "prompt": prompt,
            "system_prompt": system_prompt,
            "max_tokens": max_tokens,
            "temperature": round(temperature, 2),
            "platform": platform or "general"
        }
        cache_string = json.dumps(cache_data, sort_keys=True)
        return hashlib.sha256(cache_string.encode()).hexdigest()
    
    def _get_cached_content(self, cache_key: str) -> Optional[str]:
        """Get cached content if it exists and hasn't expired"""
        if cache_key not in self._cache:
            return None
        
        content, expiry_time = self._cache[cache_key]
        
        # Check if expired
        if datetime.now() > expiry_time:
            del self._cache[cache_key]
            return None
        
        return content
    
    def _set_cached_content(self, cache_key: str, content: str):
        """Store content in cache"""
        # Limit cache size - remove oldest entries if needed
        if len(self._cache) >= self._max_cache_size:
            # Remove oldest 10% of entries
            sorted_items = sorted(
                self._cache.items(),
                key=lambda x: x[1][1]  # Sort by expiry time
            )
            to_remove = len(sorted_items) // 10
            for key, _ in sorted_items[:to_remove]:
                del self._cache[key]
        
        expiry_time = datetime.now() + self._cache_ttl
        self._cache[cache_key] = (content, expiry_time)
    
    def _get_provider(self) -> BaseAIProvider:
        """Get the current provider instance"""
        if self._provider is None:
            self._provider = get_provider(db=self.db)
        return self._provider

    async def generate_content(
        self, 
        prompt: str, 
        max_tokens: int = 500,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
        platform: Optional[str] = None
    ) -> str:
        """
        Generate content using the configured AI provider
        
        Args:
            prompt: User prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            system_prompt: Optional system prompt for instructions
            platform: Optional platform ("twitter", "linkedin", "general", or None)
            
        Returns:
            Generated text content
        """
        # Check cache first
        cache_key = self._get_cache_key(prompt, system_prompt or "", max_tokens, temperature, platform)
        cached_content = self._get_cached_content(cache_key)
        if cached_content is not None:
            return cached_content
        
        # Get provider and generate
        provider = self._get_provider()
        content = await provider.generate_content(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            system_prompt=system_prompt,
            platform=platform
        )
        
        # Cache the result
        self._set_cached_content(cache_key, content)
        
        return content
    
    async def edit_content(
        self, 
        original_content: str, 
        edit_instruction: str,
        temperature: float = 0.5
    ) -> str:
        """
        Edit existing content based on instructions
        
        Args:
            original_content: The content to edit
            edit_instruction: Instructions for how to edit
            temperature: Sampling temperature
            
        Returns:
            Edited content
        """
        provider = self._get_provider()
        return await provider.edit_content(
            original_content=original_content,
            edit_instruction=edit_instruction,
            temperature=temperature
        )
    
    async def check_server_health(self) -> bool:
        """Check if the current AI provider is accessible"""
        try:
            provider = self._get_provider()
            return await provider.check_health()
        except Exception:
            return False
    
    def reset_provider(self):
        """Reset the provider instance (useful when switching providers)"""
        self._provider = None

from abc import ABC, abstractmethod
from typing import Optional

class BaseAIProvider(ABC):
    """Base class for AI providers"""
    
    @abstractmethod
    async def generate_content(
        self,
        prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generate content from a prompt
        
        Args:
            prompt: User prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            system_prompt: Optional system prompt
            
        Returns:
            Generated text content
        """
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def check_health(self) -> bool:
        """
        Check if the provider is available and healthy
        
        Returns:
            True if provider is healthy, False otherwise
        """
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """
        Get the name of this provider
        
        Returns:
            Provider name (e.g., 'llamacpp', 'openai', 'anthropic')
        """
        pass
    
    def get_display_name(self) -> str:
        """
        Get a human-readable display name for this provider
        
        Returns:
            Display name (e.g., 'Llama.cpp', 'OpenAI', 'Anthropic')
        """
        return self.get_provider_name()


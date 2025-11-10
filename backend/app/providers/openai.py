from typing import Optional
from app.providers.base import BaseAIProvider

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

class OpenAIProvider(BaseAIProvider):
    """Provider for OpenAI API"""
    
    def __init__(self, config: Optional[dict] = None):
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI package not installed. Install it with: pip install openai")
        
        self.config = config or {}
        api_key = self.config.get('api_key')
        if not api_key:
            raise ValueError("OpenAI API key is required")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = self.config.get('model', 'gpt-4o-mini')
        self.timeout = self.config.get('timeout', 60.0)
    
    async def generate_content(
        self,
        prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate content using OpenAI API"""
        if system_prompt is None:
            system_prompt = """You are a social media content creator. 
Create engaging, authentic content for professional platforms like Twitter and LinkedIn.
Keep responses concise and platform-appropriate."""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=self.timeout
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("OpenAI returned empty content")
            
            return content.strip()
        except Exception as e:
            raise ConnectionError(f"OpenAI API error: {str(e)}")
    
    async def edit_content(
        self,
        original_content: str,
        edit_instruction: str,
        temperature: float = 0.5
    ) -> str:
        """Edit existing content based on instructions"""
        system_prompt = """You are a professional content editor. 
Edit the provided content according to the user's instructions while maintaining 
the original tone and style. Make the requested changes precisely."""
        
        prompt = f"""Original content:
{original_content}

Edit instructions:
{edit_instruction}

Provide the edited version:"""
        
        return await self.generate_content(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=1000
        )
    
    async def check_health(self) -> bool:
        """Check if OpenAI API is accessible"""
        try:
            # Simple health check - try to list models
            await self.client.models.list(timeout=5.0)
            return True
        except Exception:
            return False
    
    def get_provider_name(self) -> str:
        return "openai"
    
    def get_display_name(self) -> str:
        return "OpenAI"


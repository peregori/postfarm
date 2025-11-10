from typing import Optional
from app.providers.base import BaseAIProvider

try:
    import anthropic
    from anthropic import AsyncAnthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

class AnthropicProvider(BaseAIProvider):
    """Provider for Anthropic Claude API"""
    
    def __init__(self, config: Optional[dict] = None):
        if not ANTHROPIC_AVAILABLE:
            raise ImportError("Anthropic package not installed. Install it with: pip install anthropic")
        
        self.config = config or {}
        api_key = self.config.get('api_key')
        if not api_key:
            raise ValueError("Anthropic API key is required")
        
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = self.config.get('model', 'claude-3-5-sonnet-20241022')
        self.timeout = self.config.get('timeout', 60.0)
    
    async def generate_content(
        self,
        prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate content using Anthropic API"""
        if system_prompt is None:
            system_prompt = """You are a social media content creator. 
Create engaging, authentic content for professional platforms like Twitter and LinkedIn.
Keep responses concise and platform-appropriate."""
        
        try:
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                timeout=self.timeout
            )
            
            # Extract text from content blocks
            content = ""
            for block in message.content:
                if block.type == "text":
                    content += block.text
            
            if not content:
                raise ValueError("Anthropic returned empty content")
            
            return content.strip()
        except anthropic.APIError as e:
            raise ConnectionError(f"Anthropic API error: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error generating content: {str(e)}")
    
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
        """Check if Anthropic API is accessible"""
        try:
            # Simple health check - try a minimal request
            await self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}],
                timeout=5.0
            )
            return True
        except Exception:
            return False
    
    def get_provider_name(self) -> str:
        return "anthropic"
    
    def get_display_name(self) -> str:
        return "Anthropic"


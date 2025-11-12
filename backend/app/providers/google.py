from typing import Optional
from app.providers.base import BaseAIProvider

try:
    from google import genai
    from google.genai.types import GenerateContentConfig
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

class GoogleProvider(BaseAIProvider):
    """Provider for Google Gemini API"""
    
    def __init__(self, config: Optional[dict] = None):
        if not GOOGLE_AVAILABLE:
            raise ImportError("Google GenAI package not installed. Install it with: pip install google-genai")
        
        self.config = config or {}
        api_key = self.config.get('api_key')
        if not api_key:
            raise ValueError("Google Gemini API key is required")
        
        self.client = genai.Client(api_key=api_key)
        self.model = self.config.get('model', 'gemini-2.0-flash')
        self.timeout = self.config.get('timeout', 60.0)
    
    async def generate_content(
        self,
        prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate content using Google Gemini API"""
        if system_prompt is None:
            system_prompt = """You are a social media content creator. 
Create engaging, authentic content for professional platforms like Twitter and LinkedIn.
Keep responses concise and platform-appropriate."""
        
        try:
            # Build contents list with system prompt and user prompt
            contents = []
            if system_prompt:
                contents.append(system_prompt)
            contents.append(prompt)
            
            # Configure generation parameters
            config = GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens
            )
            
            # Generate content using async client
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )
            
            # Extract text from response
            content = response.text
            if not content:
                raise ValueError("Google Gemini returned empty content")
            
            return content.strip()
        except Exception as e:
            raise ConnectionError(f"Google Gemini API error: {str(e)}")
    
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
        """Check if Google Gemini API is accessible"""
        try:
            # Simple health check - try a minimal request
            config = GenerateContentConfig(
                max_output_tokens=10
            )
            await self.client.aio.models.generate_content(
                model=self.model,
                contents=["test"],
                config=config
            )
            return True
        except Exception:
            return False
    
    def get_provider_name(self) -> str:
        return "google"
    
    def get_display_name(self) -> str:
        return "Google Gemini"


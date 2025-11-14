import json
import re
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
        system_prompt: Optional[str] = None,
        platform: Optional[str] = None
    ) -> str:
        """Generate content using Google Gemini API"""
        if system_prompt is None:
            # Use platform-specific system prompts
            if platform == "twitter":
                system_prompt = """Write a Twitter post in a positive, energetic, and assertive tone that feels smart and engaging. Use clear, concise language as if giving valuable advice or sharing an insight directly with a friend. Keep the message abstract so it can be applied to any topic or perspective. Never include hashtags, emojis, meta-commentary, "—" dashes, or checklist confirmations. Output ONLY the post content."""
            elif platform == "linkedin":
                system_prompt = """You are a LinkedIn ghostwriter creating viral, engaging posts. Write in first person with a confident, upbeat, savvy tone. Use this structure naturally (don't number it or mention steps):
- Bold hook with metrics/results
- Free value or key insight
- Brief origin story or realization
- Show expertise through experience
- Surprising or unconventional insight
- Actionable method or framework
- Bullet points for metrics/outcomes (use ↳, →, •, for visual emphasis)
- Positive, energizing conclusion
- Call-to-action for engagement

CRITICAL: Never include hashtags, emojis, meta-commentary, "—" dashes, or checklist confirmations. Output ONLY the post content. Max 250 words."""
        
        try:
            # Build contents list with system prompt and user prompt
            contents = []
            if system_prompt:
                contents.append(system_prompt)
            
            # For LinkedIn, integrate the user prompt as the post topic
            if platform == "linkedin":
                user_prompt = f"Post Topic: {prompt}\n\nCreate a LinkedIn post following the structure provided. Output the post content directly."
            else:
                user_prompt = prompt
            
            contents.append(user_prompt)
            
            # Adjust max_tokens based on platform to match character limits
            # Twitter: 280 chars ≈ 70 tokens, but we get ~100 from frontend
            # LinkedIn: 3000 chars ≈ 750 tokens, but we get ~800 from frontend
            # Use the provided max_tokens (already calculated by frontend)
            effective_max_tokens = max_tokens
            
            # Configure generation parameters
            config = GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=effective_max_tokens
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
            
            content = content.strip()
            
            # For LinkedIn, try to extract JSON if present
            if platform == "linkedin" and content:
                # Try to parse JSON response
                try:
                    # Look for JSON block in the content (handle nested braces)
                    json_start = content.find('{')
                    if json_start != -1:
                        # Find matching closing brace
                        brace_count = 0
                        json_end = -1
                        for i in range(json_start, len(content)):
                            if content[i] == '{':
                                brace_count += 1
                            elif content[i] == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    json_end = i + 1
                                    break
                        
                        if json_end > json_start:
                            json_str = content[json_start:json_end]
                            parsed = json.loads(json_str)
                            if "linkedin_post" in parsed:
                                content = parsed["linkedin_post"]
                except (json.JSONDecodeError, KeyError, ValueError):
                    # If JSON parsing fails, use content as-is
                    pass
            
            return content
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


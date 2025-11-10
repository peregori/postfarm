import httpx
import re
from typing import Optional
from app.providers.base import BaseAIProvider
from app.config import settings

class LlamaCppProvider(BaseAIProvider):
    """Provider for llama.cpp server"""
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.base_url = self.config.get('server_url', settings.LLAMA_CPP_SERVER_URL)
        self.model_name = self.config.get('model_name', settings.LLAMA_MODEL_NAME)
        self.timeout = self.config.get('timeout', 180.0)
    
    async def generate_content(
        self,
        prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate content using local llama.cpp server"""
        if system_prompt is None:
            system_prompt = """You are a social media content creator. 
Create engaging, authentic content for professional platforms like Twitter and LinkedIn.
Keep responses concise and platform-appropriate."""
        
        # For reasoning models, add explicit instruction to output directly
        user_content = prompt
        if max_tokens > 0:
            user_content = f"{prompt}\n\nIMPORTANT: Provide only the final content output. Do not show your reasoning process."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Build request payload
                if max_tokens < 3000:
                    effective_max_tokens = max(max_tokens * 2, 3000)
                else:
                    effective_max_tokens = max_tokens
                
                payload = {
                    "model": self.model_name,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": effective_max_tokens,
                    "stream": False,
                    "reasoning_effort": 0.0
                }
                
                response = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                
                # Extract generated content
                if "choices" in data and len(data["choices"]) > 0:
                    choice = data["choices"][0]
                    message = choice.get("message", {})
                    
                    content = message.get("content", "").strip()
                    reasoning = message.get("reasoning_content", "").strip()
                    
                    # Handle reasoning models
                    if not content and reasoning:
                        # Strategy 1: Look for quoted text
                        quoted = re.findall(r'"([^"]+)"', reasoning)
                        if quoted:
                            content = quoted[-1]
                        
                        # Strategy 2: Look for text after markers
                        if not content:
                            markers = ['answer:', 'output:', 'content:', 'tweet:', 'post:']
                            reasoning_lines = reasoning.split('\n')
                            for i, line in enumerate(reasoning_lines):
                                line_lower = line.lower().strip()
                                for marker in markers:
                                    if marker in line_lower:
                                        parts = line.split(':', 1)
                                        if len(parts) > 1:
                                            content = parts[1].strip()
                                            break
                                if content:
                                    break
                        
                        # Strategy 3: Take last substantial non-reasoning line
                        if not content:
                            reasoning_keywords = ['think', 'consider', 'hmm', 'well', 'let me', 'i need']
                            reasoning_lines = reasoning.split('\n')
                            for line in reversed(reasoning_lines):
                                line_clean = line.strip()
                                if line_clean and len(line_clean) > 10:
                                    is_reasoning = any(kw in line_clean.lower() for kw in reasoning_keywords)
                                    if not is_reasoning:
                                        content = line_clean
                                        break
                        
                        # Strategy 4: Use entire reasoning if all else fails
                        if not content:
                            content = reasoning
                    
                    content = content.strip() if content else ""
                    
                    if not content:
                        raise ValueError(
                            f"LLM returned empty content. Finish reason: {choice.get('finish_reason', 'unknown')}. "
                            f"Try increasing max_tokens or check if the model is loaded correctly."
                        )
                    
                    return content
                else:
                    raise ValueError("Unexpected response format from LLM server")
                    
            except httpx.RequestError as e:
                raise ConnectionError(f"Failed to connect to LLM server: {str(e)}")
            except httpx.HTTPStatusError as e:
                raise ValueError(f"LLM server error: {e.response.status_code} - {e.response.text}")
    
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
        """Check if llama.cpp server is accessible"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception:
            return False
    
    def get_provider_name(self) -> str:
        return "llamacpp"
    
    def get_display_name(self) -> str:
        return "Llama.cpp"


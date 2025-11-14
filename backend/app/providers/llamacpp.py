import httpx
import re
import json
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
        system_prompt: Optional[str] = None,
        platform: Optional[str] = None
    ) -> str:
        """Generate content using local llama.cpp server"""
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
        
        # For reasoning models, add explicit instruction to output directly
        # For LinkedIn, integrate the user prompt as the post topic
        if platform == "linkedin":
            user_content = f"Post Topic: {prompt}\n\nCreate a LinkedIn post following the structure provided. Output the post content directly."
        else:
            user_content = prompt
        
        if max_tokens > 0 and platform != "linkedin":
            user_content = f"{user_content}\n\nIMPORTANT: Provide only the final content output. Do not show your reasoning process."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Adjust max_tokens based on platform to match character limits
                # The frontend now sends platform-specific max_tokens:
                # Twitter: ~100 tokens (for 280 char limit)
                # LinkedIn: ~800 tokens (for 3000 char limit)
                # Don't multiply for Twitter - it's already correctly sized
                if platform == "twitter":
                    # Twitter needs small token limit to match 280 char limit
                    effective_max_tokens = min(max_tokens, 150)  # Cap at 150 to prevent over-generation
                elif platform == "linkedin":
                    # LinkedIn can use more tokens, but don't multiply unnecessarily
                    effective_max_tokens = min(max_tokens, 1000)  # Cap at 1000
                else:
                    # For other platforms, use the provided max_tokens
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


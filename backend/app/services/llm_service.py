import httpx
import os
import re
import hashlib
import json
from typing import Optional
from datetime import datetime, timedelta
from app.config import settings

class LLMService:
    """Service for interacting with llama.cpp server"""
    
    def __init__(self):
        self.base_url = settings.LLAMA_CPP_SERVER_URL
        self.timeout = 180.0  # 3 minutes timeout for LLM generation (reasoning models can be slow)
        # Simple in-memory cache: {cache_key: (content, expiry_time)}
        self._cache: dict[str, tuple[str, datetime]] = {}
        self._cache_ttl = timedelta(hours=24)  # Cache for 24 hours
        self._max_cache_size = 1000  # Limit cache size
        
    def _get_cache_key(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int,
        temperature: float
    ) -> str:
        """Generate a cache key from prompt and parameters"""
        # Create a hash from the request parameters
        # For caching purposes, we round temperature to 2 decimals to allow some variance
        cache_data = {
            "prompt": prompt,
            "system_prompt": system_prompt,
            "max_tokens": max_tokens,
            "temperature": round(temperature, 2)
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

    async def generate_content(
        self, 
        prompt: str, 
        max_tokens: int = 500,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generate content using local llama.cpp server
        
        Args:
            prompt: User prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            system_prompt: Optional system prompt for instructions
            
        Returns:
            Generated text content
        """
        if system_prompt is None:
            system_prompt = """You are a social media content creator. 
Create engaging, authentic content for professional platforms like Twitter and LinkedIn.
Keep responses concise and platform-appropriate."""
        
        # For reasoning models, add explicit instruction to output directly
        # DeepSeek-R1 and similar models need clear instructions
        user_content = prompt
        if max_tokens > 0:  # Only if we're generating (not editing)
            # Add instruction to provide direct output without showing reasoning
            user_content = f"{prompt}\n\nIMPORTANT: Provide only the final content output. Do not show your reasoning process."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        # Check cache first (only for non-zero temperature to allow deterministic results)
        # For temperature > 0, we still cache as it's useful for repeated prompts
        cache_key = self._get_cache_key(prompt, system_prompt, max_tokens, temperature)
        cached_content = self._get_cached_content(cache_key)
        if cached_content is not None:
            return cached_content
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Build request payload
                # For reasoning models, allocate significantly more tokens
                # Reasoning models use tokens for reasoning AND content
                # We need at least 3000 tokens to reliably get content from reasoning models
                if max_tokens < 3000:
                    effective_max_tokens = max(max_tokens * 2, 3000)  # At least 3000 tokens
                else:
                    effective_max_tokens = max_tokens
                
                payload = {
                    "model": settings.LLAMA_MODEL_NAME,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": effective_max_tokens,
                    "stream": False
                }
                
                # Try to disable reasoning for reasoning models (may not work for all servers)
                # These parameters are model/server specific
                payload["reasoning_effort"] = 0.0
                
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
                    
                    # Get content - reasoning models (like DeepSeek-R1) may put output in different fields
                    content = message.get("content", "").strip()
                    reasoning = message.get("reasoning_content", "").strip()
                    
                    # For reasoning models, if content is empty, we need to extract from reasoning
                    # DeepSeek-R1 often puts the final answer at the end of reasoning
                    if not content and reasoning:
                        # Try to find the actual answer in reasoning
                        # Look for patterns like quotes, or text after certain markers
                        reasoning_lines = reasoning.split('\n')
                        
                        # Strategy 1: Look for quoted text (often the final answer)
                        quoted = re.findall(r'"([^"]+)"', reasoning)
                        if quoted:
                            content = quoted[-1]  # Take last quoted text
                        
                        # Strategy 2: Look for text after markers like "Answer:", "Output:", etc.
                        if not content:
                            markers = ['answer:', 'output:', 'content:', 'tweet:', 'post:']
                            for i, line in enumerate(reasoning_lines):
                                line_lower = line.lower().strip()
                                for marker in markers:
                                    if marker in line_lower:
                                        # Take everything after the marker
                                        parts = line.split(':', 1)
                                        if len(parts) > 1:
                                            content = parts[1].strip()
                                            break
                                if content:
                                    break
                        
                        # Strategy 3: Take the last substantial non-reasoning line
                        if not content:
                            # Skip lines that are clearly reasoning (contain "think", "consider", etc.)
                            reasoning_keywords = ['think', 'consider', 'hmm', 'well', 'let me', 'i need']
                            for line in reversed(reasoning_lines):
                                line_clean = line.strip()
                                if line_clean and len(line_clean) > 10:
                                    is_reasoning = any(kw in line_clean.lower() for kw in reasoning_keywords)
                                    if not is_reasoning:
                                        content = line_clean
                                        break
                        
                        # Strategy 4: If all else fails, use the entire reasoning
                        if not content:
                            content = reasoning
                    
                    content = content.strip() if content else ""
                    
                    if not content:
                        raise ValueError(
                            f"LLM returned empty content. Finish reason: {choice.get('finish_reason', 'unknown')}. "
                            f"Try increasing max_tokens or check if the model is loaded correctly."
                        )
                    
                    # Cache the result
                    self._set_cached_content(cache_key, content)
                    
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
        """
        Edit existing content based on instructions
        
        Args:
            original_content: The content to edit
            edit_instruction: Instructions for how to edit
            temperature: Sampling temperature
            
        Returns:
            Edited content
        """
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
    
    async def check_server_health(self) -> bool:
        """Check if llama.cpp server is accessible"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except httpx.ConnectError:
            return False
        except httpx.TimeoutException:
            return False
        except Exception:
            return False


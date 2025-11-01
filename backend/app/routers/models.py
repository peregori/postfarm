from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import glob
from pathlib import Path

router = APIRouter()

# Default model cache directory
DEFAULT_LLAMA_CACHE_DIR = os.path.expanduser("~/Library/Caches/llama.cpp")
LLAMA_CACHE_DIR = os.getenv("LLAMA_CACHE_DIR", DEFAULT_LLAMA_CACHE_DIR)

class ModelInfo(BaseModel):
    name: str
    path: str
    size: Optional[int] = None

@router.get("/", response_model=List[ModelInfo])
async def list_models():
    """List all available GGUF models in the cache directory"""
    models = []
    
    if not os.path.exists(LLAMA_CACHE_DIR):
        return models
    
    # Find all .gguf files
    pattern = os.path.join(LLAMA_CACHE_DIR, "*.gguf")
    model_files = glob.glob(pattern)
    
    for model_path in model_files:
        model_name = os.path.basename(model_path)
        size = None
        try:
            size = os.path.getsize(model_path)
        except:
            pass
        
        models.append(ModelInfo(
            name=model_name,
            path=model_path,
            size=size
        ))
    
    # Sort by name
    models.sort(key=lambda x: x.name)
    return models

@router.get("/cache-dir")
async def get_cache_dir():
    """Get the current model cache directory"""
    return {
        "cache_dir": LLAMA_CACHE_DIR,
        "exists": os.path.exists(LLAMA_CACHE_DIR),
        "model_count": len(glob.glob(os.path.join(LLAMA_CACHE_DIR, "*.gguf"))) if os.path.exists(LLAMA_CACHE_DIR) else 0
    }


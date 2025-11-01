from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.llama_server_manager import server_manager

router = APIRouter()

class StartServerRequest(BaseModel):
    model_name: str

class ServerStatusResponse(BaseModel):
    running: bool
    url: str
    port: int
    pid: Optional[int] = None
    model: Optional[str] = None

class ServerActionResponse(BaseModel):
    success: bool
    message: str
    status: str

@router.get("/status", response_model=ServerStatusResponse)
async def get_server_status():
    """Get llama.cpp server status"""
    status = await server_manager.get_server_status()
    return ServerStatusResponse(**status)

@router.post("/start", response_model=ServerActionResponse)
async def start_server(request: StartServerRequest):
    """Start llama.cpp server with specified model"""
    result = await server_manager.start_server(request.model_name)
    return ServerActionResponse(**result)

@router.post("/stop", response_model=ServerActionResponse)
async def stop_server():
    """Stop llama.cpp server"""
    result = await server_manager.stop_server()
    return ServerActionResponse(**result)

@router.get("/models")
async def get_available_models():
    """Get list of available models for server"""
    models = server_manager.get_available_models()
    return {"models": models}


from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.llm_service import LLMService

router = APIRouter()
llm_service = LLMService()

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = 500
    temperature: Optional[float] = 0.7
    system_prompt: Optional[str] = None

class GenerateResponse(BaseModel):
    content: str
    prompt: str

class EditRequest(BaseModel):
    original_content: str
    edit_instruction: str
    temperature: Optional[float] = 0.5

class EditResponse(BaseModel):
    edited_content: str
    original_content: str

@router.post("/generate", response_model=GenerateResponse)
async def generate_content(request: GenerateRequest):
    """Generate content from a prompt using local LLM"""
    try:
        content = await llm_service.generate_content(
            prompt=request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            system_prompt=request.system_prompt
        )
        return GenerateResponse(content=content, prompt=request.prompt)
    except ConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM server not available: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating content: {str(e)}"
        )

@router.post("/edit", response_model=EditResponse)
async def edit_content(request: EditRequest):
    """Edit existing content based on instructions"""
    try:
        edited_content = await llm_service.edit_content(
            original_content=request.original_content,
            edit_instruction=request.edit_instruction,
            temperature=request.temperature
        )
        return EditResponse(
            edited_content=edited_content,
            original_content=request.original_content
        )
    except ConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM server not available: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error editing content: {str(e)}"
        )

@router.get("/health")
async def llm_health():
    """Check LLM server health"""
    is_healthy = await llm_service.check_server_health()
    if is_healthy:
        return {"status": "healthy", "server_url": llm_service.base_url}
    else:
        raise HTTPException(
            status_code=503,
            detail="LLM server is not available"
        )


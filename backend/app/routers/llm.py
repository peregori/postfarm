from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.services.llm_service import LLMService
from app.database import get_db

router = APIRouter()

def get_llm_service(db: Session = Depends(get_db)) -> LLMService:
    """Dependency to get LLMService with database session"""
    return LLMService(db=db)

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
async def generate_content(request: GenerateRequest, llm_service: LLMService = Depends(get_llm_service)):
    """Generate content from a prompt using configured AI provider"""
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
            detail=f"AI provider not available: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating content: {str(e)}"
        )

@router.post("/edit", response_model=EditResponse)
async def edit_content(request: EditRequest, llm_service: LLMService = Depends(get_llm_service)):
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
            detail=f"AI provider not available: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error editing content: {str(e)}"
        )

@router.get("/health")
async def llm_health(llm_service: LLMService = Depends(get_llm_service)):
    """Check AI provider health"""
    is_healthy = await llm_service.check_server_health()
    if is_healthy:
        provider = llm_service._get_provider()
        return {
            "status": "healthy",
            "provider": provider.get_provider_name(),
            "display_name": provider.get_display_name()
        }
    else:
        raise HTTPException(
            status_code=503,
            detail="AI provider is not available"
        )


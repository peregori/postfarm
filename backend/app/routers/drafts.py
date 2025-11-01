from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import Draft
from sqlalchemy import select

router = APIRouter()

class DraftCreate(BaseModel):
    title: Optional[str] = None
    content: str
    prompt: Optional[str] = None
    tags: Optional[List[str]] = None

class DraftUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    prompt: Optional[str] = None
    tags: Optional[List[str]] = None

class DraftResponse(BaseModel):
    id: int
    title: Optional[str]
    content: str
    prompt: Optional[str]
    created_at: str
    updated_at: Optional[str]
    tags: List[str]
    
    @classmethod
    def from_orm(cls, draft: Draft):
        return cls(**draft.to_dict())

@router.get("/", response_model=List[DraftResponse])
async def list_drafts(db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    """List all drafts"""
    result = db.execute(select(Draft).offset(skip).limit(limit).order_by(Draft.created_at.desc()))
    drafts = result.scalars().all()
    return [DraftResponse.from_orm(draft) for draft in drafts]

@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(draft_id: int, db: Session = Depends(get_db)):
    """Get a specific draft"""
    result = db.execute(select(Draft).where(Draft.id == draft_id))
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return DraftResponse.from_orm(draft)

@router.post("/", response_model=DraftResponse, status_code=201)
async def create_draft(draft_data: DraftCreate, db: Session = Depends(get_db)):
    """Create a new draft"""
    tags_str = ",".join(draft_data.tags) if draft_data.tags else None
    
    draft = Draft(
        title=draft_data.title,
        content=draft_data.content,
        prompt=draft_data.prompt,
        tags=tags_str
    )
    
    db.add(draft)
    db.commit()
    db.refresh(draft)
    
    return DraftResponse.from_orm(draft)

@router.put("/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: int, 
    draft_data: DraftUpdate, 
    db: Session = Depends(get_db)
):
    """Update an existing draft"""
    result = db.execute(select(Draft).where(Draft.id == draft_id))
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft_data.title is not None:
        draft.title = draft_data.title
    if draft_data.content is not None:
        draft.content = draft_data.content
    if draft_data.prompt is not None:
        draft.prompt = draft_data.prompt
    if draft_data.tags is not None:
        draft.tags = ",".join(draft_data.tags) if draft_data.tags else None
    
    db.commit()
    db.refresh(draft)
    
    return DraftResponse.from_orm(draft)

@router.delete("/{draft_id}", status_code=204)
async def delete_draft(draft_id: int, db: Session = Depends(get_db)):
    """Delete a draft"""
    result = db.execute(select(Draft).where(Draft.id == draft_id))
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    db.delete(draft)
    db.commit()
    
    return None


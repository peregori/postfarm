from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum
from datetime import datetime

class PlatformType(str, enum.Enum):
    TWITTER = "twitter"
    LINKEDIN = "linkedin"

class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    POSTED = "posted"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Draft(Base):
    __tablename__ = "drafts"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    prompt = Column(Text, nullable=True)  # Original prompt used to generate content
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    tags = Column(String(500), nullable=True)  # Comma-separated tags
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "prompt": self.prompt,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "tags": self.tags.split(",") if self.tags else []
        }

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, nullable=False)  # Reference to draft
    platform = Column(SQLEnum(PlatformType), nullable=False)
    content = Column(Text, nullable=False)  # Final content to post (may differ from draft)
    scheduled_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(PostStatus), default=PostStatus.SCHEDULED)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "draft_id": self.draft_id,
            "platform": self.platform.value,
            "content": self.content,
            "scheduled_time": self.scheduled_time.isoformat() if self.scheduled_time else None,
            "status": self.status.value,
            "posted_at": self.posted_at.isoformat() if self.posted_at else None,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class PlatformConfig(Base):
    __tablename__ = "platform_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(SQLEnum(PlatformType), nullable=False, unique=True)
    api_key = Column(String(500), nullable=True)
    api_secret = Column(String(500), nullable=True)
    access_token = Column(String(1000), nullable=True)
    access_token_secret = Column(String(1000), nullable=True)
    bearer_token = Column(String(1000), nullable=True)  # For Twitter API v2
    linkedin_org_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def to_dict(self, include_secrets=False):
        data = {
            "id": self.id,
            "platform": self.platform.value,
            "is_active": self.is_active,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_secrets:
            data.update({
                "api_key": self.api_key,
                "api_secret": self.api_secret,
                "access_token": self.access_token,
                "access_token_secret": self.access_token_secret,
                "bearer_token": self.bearer_token,
                "linkedin_org_id": self.linkedin_org_id,
            })
        return data


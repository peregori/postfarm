from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL - using SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./postfarm.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.models import Draft, ScheduledPost, PlatformConfig, AIProviderConfig, PlatformType
    Base.metadata.create_all(bind=engine)

    # Seed default platforms if they don't exist
    db = SessionLocal()
    try:
        from sqlalchemy import select
        # Check if platforms exist
        result = db.execute(select(PlatformConfig))
        existing = result.scalars().all()

        if not existing:
            # Create default Twitter and LinkedIn platforms
            platforms = [
                PlatformConfig(platform=PlatformType.TWITTER, is_active=False),
                PlatformConfig(platform=PlatformType.LINKEDIN, is_active=False),
            ]
            db.add_all(platforms)
            db.commit()
            print("✅ Seeded default platforms: Twitter, LinkedIn")
    finally:
        db.close()


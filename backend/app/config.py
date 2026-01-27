from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # LLM Configuration
    LLAMA_CPP_SERVER_URL: str = "http://localhost:8080"
    LLAMA_MODEL_NAME: str = "default"
    AI_PROVIDER: str = "llamacpp"  # Default provider
    
    # Database
    DATABASE_URL: str = "sqlite:///./postfarm.db"
    
    # API Settings
    API_PREFIX: str = "/api"
    
    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()


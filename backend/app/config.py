from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM Configuration
    LLAMA_CPP_SERVER_URL: str = "http://localhost:8080"
    LLAMA_MODEL_NAME: str = "default"
    AI_PROVIDER: str = "llamacpp"  # Default provider

    # Database (SQLite for local dev)
    DATABASE_URL: str = "sqlite:///./postfarm.db"

    # Supabase Configuration (for user-scoped cloud storage)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""  # Service role key for backend
    SUPABASE_ANON_KEY: str = ""  # Publishable key (not used in backend)
    USE_SUPABASE: bool = False  # Feature flag for gradual migration

    # API Settings
    API_PREFIX: str = "/api"

    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""

    # OAuth Configuration (Twitter, LinkedIn)
    TWITTER_CLIENT_ID: str = ""
    TWITTER_CLIENT_SECRET: str = ""
    TWITTER_REDIRECT_URI: str = "http://localhost:3000/oauth/twitter/callback"

    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_REDIRECT_URI: str = "http://localhost:3000/oauth/linkedin/callback"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Allow extra env vars without failing


settings = Settings()

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.middleware.auth import get_current_user
from app.routers import (
    drafts,
    export,
    llm,
    models,
    oauth,
    platforms,
    posts,
    providers,
    scheduler,
    server,
    sync,
)
from app.services.scheduler_service import scheduler_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    scheduler_service.start()
    yield
    # Shutdown
    scheduler_service.stop()


app = FastAPI(
    title="PostFarm - Content Management & Scheduling",
    description="Local content generation and scheduling app with llama.cpp",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]
# Add production URL from env if set
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    cors_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with authentication
# All routes except health check require authentication
auth_dependency = [Depends(get_current_user)]

app.include_router(
    llm.router, prefix="/api/llm", tags=["LLM"], dependencies=auth_dependency
)
app.include_router(
    providers.router,
    prefix="/api/providers",
    tags=["Providers"],
    dependencies=auth_dependency,
)
app.include_router(
    posts.router, prefix="/api/posts", tags=["Posts"], dependencies=auth_dependency
)
app.include_router(
    drafts.router, prefix="/api/drafts", tags=["Drafts"], dependencies=auth_dependency
)
app.include_router(
    scheduler.router,
    prefix="/api/scheduler",
    tags=["Scheduler"],
    dependencies=auth_dependency,
)
app.include_router(
    platforms.router,
    prefix="/api/platforms",
    tags=["Platforms"],
    dependencies=auth_dependency,
)
app.include_router(
    models.router, prefix="/api/models", tags=["Models"], dependencies=auth_dependency
)
app.include_router(
    server.router, prefix="/api/server", tags=["Server"], dependencies=auth_dependency
)
app.include_router(
    sync.router, prefix="/api/sync", tags=["Sync"], dependencies=auth_dependency
)
app.include_router(
    export.router, prefix="/api/export", tags=["Export"], dependencies=auth_dependency
)
app.include_router(
    oauth.router, prefix="/api", tags=["OAuth"], dependencies=auth_dependency
)


@app.get("/")
async def root():
    return {"message": "PostFarm API", "version": "1.0.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os

from app.database import init_db
from app.routers import posts, drafts, scheduler, llm, platforms, models, server
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
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React/Vite default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(llm.router, prefix="/api/llm", tags=["LLM"])
app.include_router(posts.router, prefix="/api/posts", tags=["Posts"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["Drafts"])
app.include_router(scheduler.router, prefix="/api/scheduler", tags=["Scheduler"])
app.include_router(platforms.router, prefix="/api/platforms", tags=["Platforms"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])
app.include_router(server.router, prefix="/api/server", tags=["Server"])

@app.get("/")
async def root():
    return {"message": "PostFarm API", "version": "1.0.0"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


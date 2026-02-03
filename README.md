# Postfarm

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Twitter](https://img.shields.io/badge/platform-Twitter-1DA1F2?logo=twitter&logoColor=white)
![LinkedIn](https://img.shields.io/badge/platform-LinkedIn-0A66C2?logo=linkedin&logoColor=white)
![Supabase](https://img.shields.io/badge/database-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel&logoColor=white)

AI-powered social media scheduling. Write drafts, polish with AI, schedule posts, publish to Twitter/LinkedIn automatically.

## Features

- **AI Editing** — Polish drafts with Cmd+K (Google Gemini or local llama.cpp)
- **Multi-Platform** — Twitter and LinkedIn (Instagram planned)
- **Auto-Scheduling** — Posts publish at exact scheduled times
- **Token Refresh** — Twitter tokens auto-refresh (no manual re-auth)
- **Free Hosting** — Runs on Supabase + Vercel free tiers

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/peregori/postfarm.git
cd postfarm

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend && npm install
```

### 2. Configure environment

```bash
# backend/.env
CLERK_SECRET_KEY=sk_...
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...
USE_SUPABASE=true
```

### 3. Run migrations

Run these SQL files in Supabase SQL Editor:
- `backend/migrations/001_user_secrets.sql`
- `backend/migrations/002_oauth_states.sql`
- `backend/migrations/004_scheduled_posts.sql`

### 4. Deploy scheduler

```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase functions deploy publish-scheduled-posts
supabase secrets set TWITTER_CLIENT_ID=... TWITTER_CLIENT_SECRET=...
```

Then run the pg_cron SQL from `backend/migrations/003_pg_cron_scheduler.sql`.

### 5. Run locally

```bash
# Terminal 1: Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

Open http://localhost:5173

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│   Vercel    │────▶│   FastAPI   │────▶│      Supabase       │
│  (Frontend) │     │  (Backend)  │     │  PostgreSQL + Auth  │
└─────────────┘     └─────────────┘     └──────────┬──────────┘
                                                   │
                                        ┌──────────▼──────────┐
                                        │  pg_cron (1/min)    │
                                        │         │           │
                                        │  Edge Function      │
                                        │  (publish posts)    │
                                        └─────────────────────┘
```

| Component | Tech | Cost |
|-----------|------|------|
| Frontend | React + Vite + Zustand | Free (Vercel) |
| Backend | Python FastAPI | Free (or Docker self-hosted) |
| Database | Supabase PostgreSQL | Free (500MB) |
| Scheduler | pg_cron + Edge Functions | Free |
| Auth | Clerk | Free tier |

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for full instructions.

**Cloud (recommended):** Vercel + Supabase — zero maintenance, free.

**Self-hosted:** Docker on your own server — full control.

## Documentation

- [MVP Spec](docs/MVP.md) — Features, acceptance criteria, status
- [Deployment Guide](docs/DEPLOY.md) — Setup for cloud and self-hosted
- [Platform Integrations](docs/INTEGRATIONS.md) — Twitter, LinkedIn, Instagram

## License

MIT

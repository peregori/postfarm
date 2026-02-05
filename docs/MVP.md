# MVP — Postfarm

## One-liner
AI-powered social media scheduling app: write drafts, polish with AI, schedule posts, and publish to Twitter/LinkedIn automatically.

## Target user
Solo content creators, indie hackers, and small marketing teams who want a simple, fast way to write and schedule social media posts without enterprise bloat.

## Core flow (MVP)
1. User signs in (Clerk auth)
2. User creates a draft in the Inbox editor
3. User optionally polishes text with AI (Cmd+K)
4. User confirms the draft → schedules it to a time slot
5. At the scheduled time, the app publishes to Twitter/LinkedIn
6. User sees post status (scheduled → posted / failed)

## Limits (keep MVP shippable)
- Platforms: Twitter + LinkedIn only (Instagram planned)
- Media: Text-only posts
- Analytics: None
- Teams: Single-user only
- Billing: Free tier only

## Acceptance criteria (testable)
- [x] User can create, edit, confirm, and delete drafts
- [x] User can schedule confirmed drafts to specific date/time
- [x] User can connect Twitter account via OAuth
- [x] User can connect LinkedIn account via OAuth
- [x] Scheduled post publishes to Twitter at the scheduled time
- [x] Scheduled post publishes to LinkedIn at the scheduled time
- [x] User sees clear status: scheduled → posted / failed
- [x] Failed posts show error reason + retry option
- [x] `./scripts/verify.sh` passes on main branch
- [x] Scheduled post executes in cloud mode (Supabase pg_cron)

## Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React + Vite + Zustand | Clerk auth, localStorage state |
| Backend | Python FastAPI | OAuth, AI editing |
| Database | Supabase PostgreSQL | user_secrets, scheduled_posts |
| Scheduler | pg_cron + Edge Functions | Runs every minute |
| Auth | Clerk | OAuth 2.0 for social platforms |
| AI | Google Gemini or local llama.cpp | Draft editing |

### Deployment (Cloud — Recommended)

| Component | Where | Cost |
|-----------|-------|------|
| Frontend | Vercel | Free |
| Backend | Supabase Edge Functions | Free |
| Database | Supabase PostgreSQL | Free (500MB) |
| Scheduler | pg_cron | Free |

Set `USE_SUPABASE=true` for cloud mode. See [DEPLOY.md](./DEPLOY.md).

## Current Status

### Done
- [x] App shell + navigation (Inbox, Scheduler, Settings)
- [x] Zustand state + localStorage persistence
- [x] Draft editor with AI polish (Cmd+K)
- [x] Scheduler UI (calendar + list views)
- [x] Settings page (platform toggles, theme)
- [x] Clerk authentication
- [x] Twitter OAuth 2.0 + PKCE
- [x] LinkedIn OAuth 2.0
- [x] Supabase Edge Function for posting
- [x] pg_cron scheduler (runs every minute)
- [x] Twitter auto token refresh (2-hour expiry)
- [x] RLS security on user_secrets + scheduled_posts
- [x] Docker setup for self-hosted mode
- [x] Deployment documentation

### In Progress
- [ ] Post status UI updates

### Pending
- [ ] Migrate drafts from localStorage to Supabase
- [ ] User-scoped data sync across devices
- [ ] Instagram integration

## Manual QA Checklist
- [ ] Sign up / sign in works
- [ ] Create draft → AI edit → confirm → schedule
- [ ] Connect Twitter → schedule post → verify on Twitter
- [ ] Connect LinkedIn → schedule post → verify on LinkedIn
- [ ] Disconnect platform works
- [ ] Failed post shows error
- [ ] Schedule post 2 min out → executes automatically

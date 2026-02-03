# MVP — Postfarm

## One-liner
AI-powered social media scheduling app: write drafts, polish with AI, schedule posts, and publish to Twitter/LinkedIn from one place.

## Target user
Solo content creators, indie hackers, and small marketing teams who want a simple, fast way to write and schedule social media posts without enterprise bloat.

## Core flow (MVP)
1) User signs in (Clerk auth)
2) User creates a draft in the Inbox editor
3) User optionally polishes text with AI (Cmd+K)
4) User confirms the draft → schedules it to a time slot
5) At the scheduled time, the app publishes to the connected platform (Twitter/LinkedIn)
6) User sees post status (pending → published / failed)

## Limits (keep MVP shippable)
- Platforms: Twitter + LinkedIn only (Instagram later)
- Media: Text-only posts (images in Phase 9)
- Analytics: None yet (Phase 10)
- Teams: Single-user only (Phase 12)
- Billing: Free tier only (Phase 13)
- Queue: Manual scheduling only (no auto-queue yet)

## Acceptance criteria (testable)
- [ ] User can create, edit, confirm, and delete drafts
- [ ] User can schedule confirmed drafts to specific date/time
- [x] User can connect Twitter account via OAuth
- [x] User can connect LinkedIn account via OAuth
- [x] Scheduled post publishes to Twitter at the scheduled time
- [ ] Scheduled post publishes to LinkedIn at the scheduled time
- [ ] User sees clear status: pending → publishing → published / failed
- [ ] Failed posts show error reason + retry option
- [x] `./scripts/verify.sh` passes on main branch
- [x] Scheduled post executes in at least one deployment mode (cloud or self-hosted)
- [ ] Testing: manual QA checklist used per release

## Manual QA checklist
- [ ] Sign up / sign in works
- [ ] Create draft → AI edit → confirm → schedule flow works
- [ ] Connect Twitter → post publishes → verify on Twitter
- [ ] Connect LinkedIn → post publishes → verify on LinkedIn
- [ ] Disconnect platform works
- [ ] Failed post shows actionable error
- [ ] Mobile responsive (basic sanity)
- [ ] Data persists across sessions / devices
- [ ] **Deployment**: App running in chosen mode (cloud or self-hosted)
- [ ] **Scheduled execution**: Post scheduled 2 min in future → executes automatically

## Architecture notes
- Frontend: React + Vite, Zustand, Clerk auth
- Backend: Python FastAPI
- AI: Genini API or GCP Vertex or options for draft editing

### Deployment modes

| Mode | DB | Scheduler | Frontend | Backend | Cost |
|------|-----|-----------|----------|---------|------|
| **Cloud** (recommended) | Supabase | pg_cron + Edge Functions | Vercel | Serverless | Free |
| **Self-hosted** | SQLite | APScheduler | Vercel or local | Docker | Free |

Set `USE_SUPABASE=true` for cloud mode, `USE_SUPABASE=false` for self-hosted.

See [DEPLOY.md](./DEPLOY.md) for setup instructions per mode.

## Tasks (current phase: Platform Connections & Real Posting)

### Done (Phases 1-7)
- [x] App shell + navigation (Inbox, Scheduler, Settings)
- [x] Zustand state management + localStorage persistence
- [x] Draft list + draft editor with AI polish
- [x] Scheduler UI (calendar + list views)
- [x] Scheduling logic (confirm → schedule → reschedule → unschedule)
- [x] Settings page (platform toggles, theme, clear data)
- [x] Keyboard shortcuts + UX polish
- [x] Clerk authentication (sign up, sign in, protected routes)

### Done (Phase 8: OAuth 2.0 Implementation) ✅

#### Backend
- [x] 1. PKCE utilities (RFC 7636 compliant) - `backend/app/utils/pkce.py`
- [x] 2. OAuthStateRepository (database-backed state storage) - `backend/app/database_supabase.py`
- [x] 3. OAuth router with real PKCE for Twitter - `backend/app/routers/oauth.py`
- [x] 4. LinkedIn OAuth support (no PKCE) - `backend/app/routers/oauth.py`
- [x] 5. APScheduler persistence (SQLAlchemy jobstore) - `backend/app/services/scheduler_service.py`
- [x] 6. OAuth state cleanup task (runs every 5 min) - `backend/app/services/scheduler_service.py`
- [x] 7. Database migration for oauth_states table - `backend/migrations/002_oauth_states.sql`
- [x] 8. Database migration for user_secrets table - `backend/migrations/001_user_secrets.sql`
- [x] 9. Test suite (PKCE, OAuth router, state repo) - `backend/tests/`
- [x] 10. Documentation (.env.example, OAUTH_SETUP.md)

#### Frontend (Complete ✅)
- [x] 11. OAuth API client methods - `frontend/src/api/client.js`
- [x] 12. OAuth popup service - `frontend/src/services/oauthService.js`
- [x] 13. OAuth callback page - `frontend/src/pages/OAuthCallback.jsx`
- [x] 14. OAuth callback routes - `frontend/src/App.jsx`
- [x] 15. Settings page OAuth UI integration - `frontend/src/pages/Settings.jsx`

#### Testing & Deployment (Complete ✅)
- [x] 16. Run database migrations in Supabase (001_user_secrets.sql, 002_oauth_states.sql)
- [x] 17. Set OAuth environment variables (TWITTER_CLIENT_ID, LINKEDIN_CLIENT_ID, etc.)
- [x] 18. Manual OAuth flow testing (Twitter + LinkedIn end-to-end)
- [x] 19. Run quality checks (`./scripts/verify.sh`)
- [x] 20. Update acceptance criteria checkboxes when OAuth works

### Next (Phase 8: Real Posting Engine)
- [x] 6. Background job system (APScheduler or Celery)
- [ ] 7. Scheduled job execution at exact times *(needs deployment testing)*
- [ ] 8. Twitter API: post tweet at scheduled time *(needs deployment testing)*
- [ ] 9. LinkedIn API: post update at scheduled time
- [ ] 10. Post status tracking (pending → publishing → published / failed)
- [ ] 11. Retry logic with exponential backoff
- [ ] 12. Error notifications (toast on failure)
- [ ] 13. Rate limit handling per platform

### Next (Phase 9: Deployment)

#### Self-hosted mode (Docker)
- [x] 1. Dockerfile for backend
- [x] 2. docker-compose.yml
- [ ] 3. Test on local Mac / VPS

#### Cloud mode (Supabase pg_cron) — Recommended ✅
- [x] 4. Enable pg_cron + pg_net extensions in Supabase Dashboard
- [x] 5. Create Edge Function for posting (`supabase/functions/publish-scheduled-posts/`)
- [x] 6. Create pg_cron SQL migration (`backend/migrations/003_pg_cron_scheduler.sql`)
- [x] 7. Deploy Edge Function + run pg_cron SQL
- [x] 8. Test scheduled execution via Supabase

#### Documentation
- [x] 9. DEPLOY.md with instructions for both modes
- [x] 10. INTEGRATIONS.md — platform reference

### Pending (Phase 13: Data Migration)
- [ ] 14. Migrate from localStorage to Supabase
- [ ] 15. User-scoped data (drafts, schedules, tokens)
- [ ] 16. Sync state between devices
- [ ] 17. Data export (download as JSON)

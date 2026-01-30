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
- [ ] User can connect Twitter account via OAuth
- [ ] User can connect LinkedIn account via OAuth
- [ ] Scheduled post publishes to Twitter at the scheduled time
- [ ] Scheduled post publishes to LinkedIn at the scheduled time
- [ ] User sees clear status: pending → publishing → published / failed
- [ ] Failed posts show error reason + retry option
- [ ] `./scripts/verify.sh` passes on main branch
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

## Architecture notes
- Frontend: React + Vite, Zustand, Clerk auth
- Backend: Python FastAPI
- DB: Supabase (PostgreSQL)
- Queue/jobs: Background worker for scheduled publishing (BullMQ or APScheduler)
- AI: OpenAI API for draft editing
- Deployment: Vercel (frontend), Railway/Fly.io (backend)

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

### In Progress (Phase 8: Platform Connections)
- [x] 1. Twitter OAuth 2.0 flow (request scopes, store tokens)
- [ ] 2. LinkedIn OAuth flow (store tokens securely)
- [ ] 3. Settings: connection status indicators + disconnect buttons
- [ ] 4. Token refresh logic for expired tokens
- [ ] 5. Handle OAuth errors gracefully (UI feedback)

### Next (Phase 8: Real Posting Engine)
- [ ] 6. Background job system (APScheduler or Celery)
- [ ] 7. Scheduled job execution at exact times
- [ ] 8. Twitter API: post tweet at scheduled time
- [ ] 9. LinkedIn API: post update at scheduled time
- [ ] 10. Post status tracking (pending → publishing → published / failed)
- [ ] 11. Retry logic with exponential backoff
- [ ] 12. Error notifications (toast on failure)
- [ ] 13. Rate limit handling per platform

### Pending (Phase 13: Data Migration)
- [ ] 14. Migrate from localStorage to Supabase
- [ ] 15. User-scoped data (drafts, schedules, tokens)
- [ ] 16. Sync state between devices
- [ ] 17. Data export (download as JSON)

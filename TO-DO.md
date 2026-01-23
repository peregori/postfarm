# **PHASE 1 — FOUNDATIONS (APP SHELL + STATE + DRAFT DATA)** - DONE

### **1. App Shell & Navigation** - DONE

* Next.js app with App Router
* Global layout: sidebar + main workspace
* Sidebar items: Inbox, Scheduler, Settings
* Mobile-responsive collapse behavior
* Global hotkeys infrastructure (optional but helpful later)

### **2. Global State (Zustand)** – DONE

* Create `draftStore` with:

  * `drafts[]`
  * `selectedDraftId`
  * Actions: createDraft, updateDraft, deleteDraft, confirmDraft, scheduleDraft, unscheduleDraft
* Add `UIStore` for:

  * currentModal
  * toasts
  * temporary UI flags
* Add Zustand persist → localStorage
* Add Draft model
* Implement auto-ID (uuid)

---

# **PHASE 2 — INBOX (DRAFT EDITOR & DRAFT LIST)** - DONE

### **3. Draft List Panel** - DONE

* Render list of drafts
* Show name, snippet, platform badge, confirmed badge
* Indicators for scheduled vs unscheduled
* Selecting a draft loads it into editor
* New Draft button: creates draft + selects it

### **4. Draft Editor** - DONE

* Auto-resize textarea
* Character counter
* Platform selector
* Auto-name drafts (“Draft 1, 2, 3…”)
* Update `updatedAt` on typing
* Disable editing when `confirmed === true`
* Delete draft (with confirm modal)
* Toast feedback for delete/undo

### **5. “Edit with AI” Action** - DONE

* AI polish button - DONE (context-aware: edit when text selected, generate otherwise)
* Loading overlay during processing - DONE
* AI integration with backend - DONE (replaces stub)
* Diff view for reviewing changes - DONE
* Accept/reject changes UI - DONE (trash button to remove unwanted segments)
* Selection preservation - DONE
* Replace current text & show toast - DONE

---

# **PHASE 3 — SCHEDULER (CORE MVP)** - DONE

### **6. Scheduler UI** - DONE

* Two views:

  * **Calendar / Grid View**: shows scheduled posts placed at times - DONE
  * **List View**: chronological list of all scheduled posts - DONE
* Scheduled posts display: draft name + platform badge + timestamp - DONE
* Click to open "Reschedule / Unschedule" modal - DONE

### **7. Scheduling Logic** - DONE

* Only confirmed drafts can be scheduled - DONE
* Local scheduling engine:

  * Generate future time slots - DONE (via calendar views)
  * FIFO assignment (next free slot) - DONE (handled by backend)
  * Prevent double-booking - DONE (backend validation)
* `scheduleDraft(draftId, timestamp)` - DONE
* `unscheduleDraft(draftId)` - DONE
* When confirming a draft in Inbox → optionally show "Schedule now?" - DONE

### **8. Interactions** - DONE

* Drag draft card → drop onto a time slot - DONE
* Or select a draft → click "Schedule" → modal to pick date/time - DONE
* Reschedule via modal - DONE
* Unschedule button - DONE
* Updating scheduledAt updates UI instantly - DONE

---

# **PHASE 4 — SETTINGS PAGE** - DONE

### **9. Settings Page** - DONE

* Platform toggles:

  * Enable/disable Twitter, LinkedIn (affects selector in editor) - DONE
* App theme (light/dark) - DONE
* Button: “Clear all data”

  * Confirm modal - DONE
  * Clear Zustand + localStorage - DONE
* Version label at bottom - DONE

---

# **PHASE 5 — POLISHING THE UX** - DONE

### **10. Keyboard & Editing Experience** - DONE

* Basic word-processor-like controls:

  * Cmd+A select all - DONE
  * Cmd+C/V copy/paste - DONE (browser default)
  * Cmd+Z/Cmd+Shift+Z undo/redo - DONE (custom history system)
  * Cmd+K smart AI (edit if selected, generate if not) - DONE
  * Text input repeat on held key - DONE (browser default)
* Clear content button in Draft Editor - DONE
* Click day number in calendar → jump to day view - DONE
* Smooth transitions when switching drafts - DONE
* Hover + active states on all cards - DONE
* Modals animated - DONE
* Toasts for every important action - DONE

---

# **PHASE 6 — SYSTEM QUALITY & CLEANUP** - DONE

### **11. Stability & Data Quality** - DONE

* Ensure all drafts persist reliably - DONE (Zustand + localStorage)
* Ensure scheduling logic always respects constraints - DONE (backend validation)
* Add skeleton loaders (Inbox + Scheduler) - DONE
* Error boundary for the whole app - DONE
* Audit component tree: remove unused props - DONE
* Final design polish (padding, spacing, font weights) - DONE

---

# **PHASE 7 — AUTHENTICATION & USER ACCOUNTS**

### **12. User Authentication**

* Auth provider integration (Clerk)
* Sign up / Sign in / Sign out flows
* Email verification
* Password reset flow
* OAuth login (Google, GitHub)
* Protected routes (redirect to login if unauthenticated)
* User profile page (name, email, avatar)

### **13. Data Migration to User-Scoped Storage**

* Migrate from localStorage to database (Supabase, Planetscale, or similar)
* All drafts/schedules scoped to user ID
* Sync state between devices
* Conflict resolution for offline edits
* Data export (download all drafts as JSON)

---

# **PHASE 8 — SOCIAL MEDIA PLATFORM CONNECTIONS**

### **14. Platform OAuth & API Integration**

* Twitter/X OAuth 2.0 flow
  * Request necessary scopes (tweet.write, users.read)
  * Store encrypted access/refresh tokens
  * Token refresh logic
* LinkedIn OAuth flow
  * Organization page vs personal profile posting
  * Store tokens securely
* Connection status indicators in Settings
* Disconnect/reconnect functionality
* Handle expired tokens gracefully

### **15. Real Posting Engine**

* Background job system (BullMQ, Inngest, or similar)
* Scheduled job execution at exact times
* Retry logic with exponential backoff
* Rate limit handling per platform
* Post status tracking (pending → publishing → published / failed)
* Webhook/polling for publish confirmation
* Error notifications (email/toast) on failures

---

# **PHASE 9 — MEDIA & RICH CONTENT**

### **16. Image & Media Upload**

* Image upload to cloud storage (S3, Cloudflare R2, Uploadthing)
* Image preview in draft editor
* Multiple images per post (carousel support)
* Image compression/optimization
* Alt text input for accessibility
* Drag-and-drop upload
* Paste image from clipboard

### **17. Link Previews & Formatting**

* URL detection and link preview cards
* Thread/carousel mode for Twitter
* LinkedIn article vs post distinction
* Hashtag suggestions
* Emoji picker
* Character count per platform (with media adjustment)

### **18. Instagram Integration (Follow-up Platform)**

* Instagram Graph API integration (via Facebook Login)
* Business account connection requirements
* Media validation (aspect ratios, resolution checks)
* Support for Feed posts and Stories
* Caption & hashtag management

---

# **PHASE 10 — ANALYTICS & INSIGHTS**

### **19. Post Performance Tracking**

* Fetch engagement metrics from platforms (likes, retweets, comments, impressions)
* Historical performance dashboard
* Per-post analytics view
* Best time to post suggestions (based on historical data)
* Engagement trend charts

### **20. Content Calendar Analytics**

* Posts per day/week/month visualization
* Platform distribution pie chart
* Posting streak tracker
* Scheduled vs published ratio

---

# **PHASE 11 — ADVANCED SCHEDULING FEATURES**

### **21. Smart Scheduling**

* Auto-schedule: pick optimal times based on audience engagement
* Queue system: add to queue, auto-assign next available slot
* Recurring posts (daily, weekly, monthly)
* Bulk schedule (CSV import)
* Draft templates / saved snippets
* Time zone support (user's local vs specific TZ)

### **22. Content Categories & Organization**

* Tags/labels for drafts
* Filter by tag, platform, status
* Search across all content
* Archive old drafts (soft delete)
* Favorites/starred drafts

---

# **PHASE 12 — TEAM & COLLABORATION**

### **23. Multi-User Workspaces**

* Create/join workspaces (organizations)
* Invite team members via email
* Role-based permissions (admin, editor, viewer)
* Shared drafts within workspace
* Activity log (who edited what, when)

### **24. Approval Workflows**

* Submit draft for review
* Approve/reject with comments
* Notification system for pending approvals
* Draft versioning (see edit history)

---

# **PHASE 13 — BILLING & MONETIZATION**

### **25. Subscription System**

* Stripe integration
* Pricing tiers (Free, Pro, Team)
* Feature gating by plan
  * Free: 10 scheduled posts/month, 1 platform
  * Pro: Unlimited posts, all platforms, analytics
  * Team: Workspaces, collaboration, priority support
* Upgrade/downgrade flows
* Usage tracking and limits enforcement
* Invoice history

### **26. Trial & Onboarding**

* 14-day free trial of Pro features
* Onboarding wizard for new users
* Sample drafts to explore features
* Tooltips for first-time users
* In-app upgrade prompts

---

# **PHASE 14 — INFRASTRUCTURE & DEPLOYMENT**

### **27. Production Backend**

* API server (Node.js/Express, or serverless functions)
* Database setup (PostgreSQL via Supabase/Neon)
* Redis for job queues and caching
* Environment management (dev, staging, prod)
* Secrets management (Vault, Doppler, or Vercel env vars)

### **28. Deployment & DevOps**

* CI/CD pipeline (GitHub Actions)
* Automated testing on PR
* Preview deployments (Vercel)
* Production deployment to Vercel/Railway/Fly.io
* Custom domain + SSL
* CDN for static assets
* Database backups (automated daily)

### **29. Monitoring & Observability**

* Error tracking (Sentry)
* Application performance monitoring
* Uptime monitoring (BetterStack, Checkly)
* Log aggregation
* Alerting for critical failures
* Status page for users

---

# **PHASE 15 — SECURITY & COMPLIANCE**

### **30. Security Hardening**

* Input sanitization (XSS prevention)
* CSRF protection
* Rate limiting on API endpoints
* Secure token storage (encrypted at rest)
* Regular dependency audits (npm audit, Snyk)
* Security headers (CSP, HSTS)

### **31. Legal & Privacy**

* Privacy Policy page
* Terms of Service page
* Cookie consent banner (GDPR)
* Data deletion request flow (right to be forgotten)
* SOC 2 preparation (if targeting enterprise)

---

# **PHASE 16 — TESTING & QUALITY ASSURANCE**

### **32. Automated Testing**

* Unit tests for utility functions (Vitest)
* Component tests (React Testing Library)
* Integration tests for API routes
* E2E tests for critical flows (Playwright)
  * Sign up → create draft → schedule → publish
  * Connect platform → disconnect
  * Billing flow
* Visual regression tests (Chromatic or Percy)

### **33. Manual QA Checklist**

* Cross-browser testing (Chrome, Safari, Firefox, Edge)
* Mobile responsiveness (iOS Safari, Android Chrome)
* Accessibility audit (WCAG 2.1 AA compliance)
* Performance audit (Lighthouse score > 90)
* Load testing for concurrent users

---

# **PHASE 17 — LAUNCH PREPARATION**

### **34. Pre-Launch Checklist**

* Landing page with feature highlights
* Pricing page
* Documentation / Help center
* Contact form / Support email
* Social proof (testimonials, if available)
* SEO optimization (meta tags, OG images)
* Analytics setup (Plausible, PostHog, or GA4)

### **35. Launch & Marketing**

* Product Hunt launch preparation
* Twitter/LinkedIn announcement posts
* Email list for early access
* Referral program (optional)
* Changelog / What's New page

---

# **FUTURE ENHANCEMENTS (POST-LAUNCH)**

* AI content suggestions based on trending topics
* White-label / API for agencies
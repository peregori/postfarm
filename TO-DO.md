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

### **5. “Edit with AI” Action**

* AI polish button
* Loading overlay during processing
* AI stub (local function returning improved text until backend exists)
* Replace current text & show toast

---

# **PHASE 3 — SCHEDULER (CORE MVP)**

### **6. Scheduler UI**

* Two views:

  * **Calendar / Grid View**: shows scheduled posts placed at times
  * **List View**: chronological list of all scheduled posts
* Scheduled posts display: draft name + platform badge + timestamp
* Click to open “Reschedule / Unschedule” modal

### **7. Scheduling Logic**

* Only confirmed drafts can be scheduled
* Local scheduling engine:

  * Generate future time slots
  * FIFO assignment (next free slot)
  * Prevent double-booking
* `scheduleDraft(draftId, timestamp)`
* `unscheduleDraft(draftId)`
* When confirming a draft in Inbox → optionally show “Schedule now?”

### **8. Interactions**

* Drag draft card → drop onto a time slot
* Or select a draft → click “Schedule” → modal to pick date/time
* Reschedule via modal
* Unschedule button
* Updating scheduledAt updates UI instantly

---

# **PHASE 4 — SETTINGS PAGE**

### **9. Settings Page**

* Platform toggles:

  * Enable/disable Twitter, LinkedIn (affects selector in editor)
* App theme (light/dark)
* Button: “Clear all data”

  * Confirm modal
  * Clear Zustand + localStorage
* Version label at bottom

---

# **PHASE 5 — POLISHING THE UX**

### **10. Keyboard & Editing Experience**

* Basic word-processor-like controls:

  * Cmd+A select all
  * Cmd+C/V copy/paste
  * Text input repeat on held key
* “Copy post” button inside Draft Editor
* Smooth transitions when switching drafts
* Hover + active states on all cards
* Modals animated
* Toasts for every important action

---

# **PHASE 6 — SYSTEM QUALITY & CLEANUP**

### **11. Stability & Data Quality**

* Ensure all drafts persist reliably
* Ensure scheduling logic always respects constraints
* Add skeleton loaders (Inbox + Scheduler)
* Error boundary for the whole app
* Audit component tree: remove unused props
* Final design polish (padding, spacing, font weights)

---

# **PHASE 7 — READY FOR REAL SCHEDULING BACKEND**

*(This is after MVP, not part of the MVP itself)*

* Connect real scheduler API
* Validate auth integration
* Deploy to cloud
* Add pricing + Stripe
* Social media auth flows
* Replace AI stub with real model
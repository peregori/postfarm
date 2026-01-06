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

# **PHASE 3 — SCHEDULER (CORE MVP)** - TBF

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

TBF

- on clicking confirmed posts in week view: error page
on month view drag and drop not working, opens modal
- on day view drag and drop reschedules but jumps you to todat
- on clciking scheduled posts over claendar in many views, modal does not show


* Drag draft card → drop onto a time slot - DONE
* Or select a draft → click "Schedule" → modal to pick date/time - DONE
* Reschedule via modal - DONE
* Unschedule button - DONE
* Updating scheduledAt updates UI instantly - DONE

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

### **10. Keyboard & Editing Experience** - PARTIALLY DONE

* Basic word-processor-like controls:

  * Cmd+A select all - DONE
  * Cmd+C/V copy/paste - DONE (browser default)
  * Cmd+Z/Cmd+Shift+Z undo/redo - DONE (custom history system)
  * Cmd+K smart AI (edit if selected, generate if not) - DONE
  * Text input repeat on held key - DONE (browser default)
* “Copy post” button inside Draft Editor - PENDING
* Smooth transitions when switching drafts - DONE
* Hover + active states on all cards - DONE
* Modals animated - DONE
* Toasts for every important action - DONE

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
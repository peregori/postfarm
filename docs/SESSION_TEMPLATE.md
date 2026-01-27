# Session Start Template

Copy this prompt when starting a new Cursor session:

---

```
I'm continuing work on Postfarm. Before we start:

1. Read docs/PROGRESS.md and tell me:
   - Current phase
   - What's completed
   - What's next

2. I want to work on: [DESCRIBE TASK]

3. Confirm this aligns with current phase before writing any code.
```

---

# Quick Commands

## Check Status
```
Read docs/PROGRESS.md and summarize: current phase, completed items, next task.
```

## Start Feature
```
I want to implement [FEATURE]. Check PROGRESS.md, confirm it's in current phase, then proceed step by step.
```

## Review & Commit
```
Review what we built today. What should I update in PROGRESS.md? Then help me write a commit message.
```

## End Session
```
Summarize what we accomplished. Update the Session Log in PROGRESS.md with today's work.
```

---

# Cost Control Tips

1. **Be specific** — "Add the upload API endpoint" not "work on uploads"
2. **One thing at a time** — Don't ask for multiple features in one prompt
3. **Approve incrementally** — Review generated code before asking for more
4. **Use references** — Point to existing patterns: "Follow the pattern in X file"
5. **Stop early** — If output looks wrong, stop and correct rather than letting it continue

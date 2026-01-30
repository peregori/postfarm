---
name: step
description: Implement the next unchecked task from docs/MVP.md and run ./scripts/check.sh (one checkbox per run).
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(./scripts/check.sh), Bash(git diff*), Bash(git status*)
model: sonnet
---

Implement exactly ONE task checkbox from docs/MVP.md.

Procedure:
1) Read docs/MVP.md
2) Find the first unchecked task: `- [ ] N. ...`
3) Implement it with the smallest reasonable diff.
4) Run: ./scripts/check.sh
   - If it fails: fix and rerun once.
5) Mark ONLY that task as done in docs/MVP.md (`[x]`).
6) Return a short summary:
   - task completed
   - files changed (name-only)
   - check status (pass/fail)
   - any follow-up note for the next /step

Keep output short; no long logs.

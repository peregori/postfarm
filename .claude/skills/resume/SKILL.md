---
name: resume
description: Quick repo status + next task (low output). Use at the start of every work session.
disable-model-invocation: true
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(grep *)
model: haiku
---

Repo status (keep it short):
- Status: !`git status -sb`
- Diff stat: !`git diff --stat || true`
- Recent commits: !`git log -5 --oneline --decorate || true`
- Next tasks: !`grep -n "^- \\[ \\]" docs/MVP.md 2>/dev/null | head -n 8 || true`

Output rules:
- <= 6 bullets total.
- Tell me the SINGLE next best action.
- If there is no docs/MVP.md, tell me to run: /mvp "<one-liner>".

---
name: ship
argument-hint: "[optional commit message]"
description: Run ./scripts/verify.sh, summarize release, and optionally commit.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(./scripts/verify.sh), Bash(git diff*), Bash(git status*), Bash(git add*), Bash(git commit*)
model: sonnet
---

Goal: prepare for shipping (safe + minimal output).

1) Run: ./scripts/verify.sh
   - If it fails: fix and retry once.
2) Show:
   - `git status -sb`
   - `git diff --stat`
3) Release summary:
   - What changed (3–7 bullets)
   - Risks / manual QA steps (short)
   - Mention if tests were skipped (verify warns)
4) If $ARGUMENTS provided, commit:
   - git add -A
   - git commit -m "$ARGUMENTS"
   Otherwise: propose a good commit message and stop.

Keep it concise.

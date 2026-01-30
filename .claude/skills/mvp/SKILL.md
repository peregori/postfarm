---
name: mvp
description: Create or refresh docs/MVP.md from a one-line product idea (turn idea into acceptance criteria + task list).
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob
model: sonnet
---

Create or refresh docs/MVP.md for this project based on:
IDEA: $ARGUMENTS

Rules:
- Keep it shippable. Prefer “first working pipeline” over perfect polish.
- Include: One-liner, target user, core flow, limits, acceptance criteria, manual QA checklist, and 10–18 tasks.
- Tasks must be small and sequential and each one should be doable in 30–120 minutes.
- Include explicit testing (at least one smoke test task) OR require manual QA checklist usage.
- If this is a Next.js app, assume Vercel deploy and include auth + error states.
- DO NOT invent secrets or API keys.
- Output only by editing/writing docs/MVP.md (no long essay).

If docs/MVP.md already exists:
- Preserve any filled-in facts the user already wrote.
- Rewrite the task list to match the updated idea.

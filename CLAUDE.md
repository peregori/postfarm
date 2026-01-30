# Lean Factory (Claude Code) — minimal, production-minded workflow

## What stays constant (architecture-proof)
This system is deliberately architecture-agnostic. **Only two things are “the contract”:**

1) **docs/MVP.md** — what you’re building (scope + acceptance + task checkboxes)
2) **scripts/check.sh** and **scripts/verify.sh** — how “quality gates” run for *this repo*

Everything else (Next vs non-Next, Supabase vs Prisma, pnpm vs npm, Python worker or not) can change
without breaking your method. If architecture changes, you update:
- docs/MVP.md tasks + acceptance criteria
- scripts/check.sh / scripts/verify.sh to match the repo’s reality

The Claude skills always call those scripts, so your workflow stays the same.

## The workflow you use
- **/mvp "one-liner idea"** → create/refresh docs/MVP.md (scope + acceptance + task list)
- **/resume** → tiny status + next action
- **/step** → implement ONE checkbox from docs/MVP.md + run fast checks
- **/ship "message"** → run full verify + short release summary + optional commit

## Safety defaults
- Never read or write `.env*` or secret files (blocked by .claude/settings.json).
- Prefer small outputs (git --stat, --name-only).

## Package manager flexibility
scripts/run.sh auto-detects your package manager by lockfile:
- pnpm-lock.yaml → pnpm
- package-lock.json / npm-shrinkwrap.json → npm
- yarn.lock → yarn
- bun.lockb / bun.lock → bun

Override anytime with: `LEANCODE_PM=npm` (or pnpm/yarn/bun).

## Testing expectations (MVP shippable)
- verify runs: check → tests (if present) → build (if present).
- If you don’t have tests yet, verify will warn.
  Your MVP acceptance criteria should include:
  - at least a smoke test, OR
  - a manual QA checklist in docs/MVP.md used for each release.

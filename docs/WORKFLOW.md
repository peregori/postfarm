# Daily workflow (Lean Factory)

## New repo from scratch
1) Create your app (Next/shadcn/etc).
2) Run this installer (or copy the pack files).
3) Ensure scripts are executable and git hooks enabled:
   - chmod +x scripts/*.sh .claude/hooks/*.mjs .githooks/*
   - git config core.hooksPath .githooks
4) Fill docs/MVP.md OR run: /mvp "your one-liner idea"

Then: /resume → /step → /ship

## Existing repo
1) Install the pack into repo root.
2) chmod +x scripts/*.sh .claude/hooks/*.mjs .githooks/*
3) git config core.hooksPath .githooks
4) Ensure package.json has scripts (lint/build; typecheck recommended; test recommended).
5) Create docs/MVP.md and list your next 8–20 tasks.

## Working session
1) Start Claude Code in the repo.
2) Run /resume
3) Run /step (repeat)
4) When ready to push: /ship "feat: message" then git push

## Contract
- /step calls: ./scripts/check.sh
- /ship calls: ./scripts/verify.sh
If you change stack/package manager/monorepo layout, update scripts/check.sh and scripts/verify.sh only.

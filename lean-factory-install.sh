#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-.}"
FORCE="${LEANCODE_FORCE:-0}"

# ---------- helpers ----------
write() {
  local path="$1"
  mkdir -p "$(dirname "$path")"

  if [[ -f "$path" && "$FORCE" != "1" ]]; then
    echo "[skip] $path exists (set LEANCODE_FORCE=1 to overwrite)" >&2
    cat >/dev/null || true
    return 0
  fi

  cat > "$path"
  echo "[write] $path" >&2
}

is_git_repo() {
  command -v git >/dev/null 2>&1 || return 1
  (cd "$TARGET" && git rev-parse --is-inside-work-tree >/dev/null 2>&1)
}

# ---------- create dirs ----------
mkdir -p "$TARGET"/docs "$TARGET"/scripts "$TARGET"/.claude/hooks \
         "$TARGET"/.claude/skills/{mvp,resume,step,ship} \
         "$TARGET"/.githooks

# ---------- CLAUDE.md ----------
write "$TARGET/CLAUDE.md" <<'EOF'
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
EOF

# ---------- docs ----------
write "$TARGET/docs/MVP.md" <<'EOF'
# MVP

## One-liner
<What does this app do in one sentence?>

## Target user
<Who is it for?>

## Core flow (MVP)
1) <User does X>
2) <System does Y>
3) <User gets Z>

## Limits (keep MVP shippable)
- Max input size/time:
- Max jobs/day:
- Timeouts:
- Pricing tier assumptions (if any):

## Acceptance criteria (testable)
- [ ] A user can complete the full core flow end-to-end in production (e.g., Vercel deploy).
- [ ] Errors are user-visible and actionable (no silent failures).
- [ ] Basic abuse protection exists (rate limits / size limits / auth).
- [ ] `./scripts/verify.sh` passes on main branch.
- [ ] Testing: at least one of:
  - [ ] automated smoke test(s) exist
  - [ ] manual QA checklist below is filled & used per release

## Manual QA checklist (if you don’t have tests yet)
- [ ] Sign up / sign in works
- [ ] Core flow works on a realistic input
- [ ] Failure mode is understandable (bad input, quota hit, timeout)
- [ ] Billing/limits do not break UX (if applicable)
- [ ] Mobile basic sanity check

## Architecture notes (optional, keep short)
- Frontend:
- Backend:
- DB / storage:
- Queue / jobs:
- AI providers:

## Tasks (ONLY list /step uses)
- [ ] 1. Scaffold routes + layout + navigation (shadcn)
- [ ] 2. Auth + protected dashboard
- [ ] 3. Core DB schema + minimal data access
- [ ] 4. Core flow happy-path end-to-end (fake data if needed)
- [ ] 5. Real integration for the core feature (first working version)
- [ ] 6. Failure modes + retry + status UI
- [ ] 7. Limits + rate limiting + input validation
- [ ] 8. Observability: structured logs + basic tracing/events
- [ ] 9. Add smoke test OR finalize manual QA checklist
- [ ] 10. Pre-launch polish (copy, empty states, loading, errors)
EOF

write "$TARGET/docs/WORKFLOW.md" <<'EOF'
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
EOF

write "$TARGET/docs/PLUGINS.md" <<'EOF'
# Plugins (minimal set)

Recommended for Next.js/TypeScript:
1) Install language server:
   - npm i -g typescript typescript-language-server
2) Install plugin in Claude Code:
   - /plugin install typescript-lsp@claude-plugins-official

Optional for Python workers:
- npm i -g pyright
- /plugin install pyright-lsp@claude-plugins-official
EOF

# ---------- scripts ----------
write "$TARGET/scripts/pm.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Allow explicit override
if [[ -n "${LEANCODE_PM:-}" ]]; then
  echo "${LEANCODE_PM}"
  exit 0
fi

# Detect by lockfile
if [[ -f "pnpm-lock.yaml" ]]; then echo "pnpm"; exit 0; fi
if [[ -f "package-lock.json" || -f "npm-shrinkwrap.json" ]]; then echo "npm"; exit 0; fi
if [[ -f "yarn.lock" ]]; then echo "yarn"; exit 0; fi
if [[ -f "bun.lockb" || -f "bun.lock" ]]; then echo "bun"; exit 0; fi

echo "npm"
EOF

write "$TARGET/scripts/run.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/run.sh <npm-script> [-- args...]" >&2
  exit 2
fi

SCRIPT="$1"; shift || true
PM="$(./scripts/pm.sh)"

case "$PM" in
  pnpm)
    command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found. Install pnpm or set LEANCODE_PM=npm" >&2; exit 1; }
    pnpm -s run "$SCRIPT" -- "$@"
    ;;
  npm)
    command -v npm >/dev/null 2>&1 || { echo "npm not found. Install Node/npm." >&2; exit 1; }
    npm run --silent "$SCRIPT" -- "$@"
    ;;
  yarn)
    command -v yarn >/dev/null 2>&1 || { echo "yarn not found. Install yarn or set LEANCODE_PM=npm" >&2; exit 1; }
    yarn -s run "$SCRIPT" -- "$@"
    ;;
  bun)
    command -v bun >/dev/null 2>&1 || { echo "bun not found. Install bun or set LEANCODE_PM=npm" >&2; exit 1; }
    bun run "$SCRIPT" -- "$@"
    ;;
  *)
    echo "Unknown package manager: $PM (set LEANCODE_PM=pnpm|npm|yarn|bun)" >&2
    exit 2
    ;;
esac
EOF

write "$TARGET/scripts/format.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

[[ $# -eq 0 ]] && exit 0

is_target() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.mdx|*.css|*.scss|*.yml|*.yaml) return 0 ;;
    *) return 1 ;;
  esac
}

PRETTIER="./node_modules/.bin/prettier"
if [[ -x "$PRETTIER" ]]; then
  targets=()
  for f in "$@"; do
    [[ -f "$f" ]] || continue
    is_target "$f" || continue
    targets+=("$f")
  done
  if [[ "${#targets[@]}" -gt 0 ]]; then
    "$PRETTIER" --write "${targets[@]}" >/dev/null 2>&1 || true
  fi
fi

exit 0
EOF

write "$TARGET/scripts/check.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "package.json" ]]; then
  echo "[check] No package.json found. Customize scripts/check.sh for this repo." >&2
  exit 0
fi

has_script() {
  local name="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$name'] ? 0 : 1)"
}

echo "[check] running lint (if present)…" >&2
if has_script "lint"; then
  ./scripts/run.sh lint
else
  echo "[check] warning: no npm script 'lint' found (skipping)." >&2
fi

# Typecheck: prefer local tsc if tsconfig exists
if [[ -f "tsconfig.json" ]]; then
  if [[ -x "./node_modules/.bin/tsc" ]]; then
    echo "[check] running tsc --noEmit…" >&2
    ./node_modules/.bin/tsc -p tsconfig.json --noEmit
  elif has_script "typecheck"; then
    echo "[check] running typecheck script…" >&2
    ./scripts/run.sh typecheck
  else
    echo "[check] warning: tsconfig.json exists but no local tsc and no 'typecheck' script. (Typechecking may still happen during build.)" >&2
  fi
fi

echo "[check] ok" >&2
EOF

write "$TARGET/scripts/verify.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "package.json" ]]; then
  echo "[verify] No package.json found. Customize scripts/verify.sh for this repo." >&2
  exit 0
fi

has_script() {
  local name="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$name'] ? 0 : 1)"
}

./scripts/check.sh

echo "[verify] running tests (if present)…" >&2
if has_script "test"; then
  ./scripts/run.sh test
else
  echo "[verify] warning: no npm script 'test' found (skipping tests). Add at least a smoke test before calling it shippable." >&2
fi

echo "[verify] running build (if present)…" >&2
if has_script "build"; then
  ./scripts/run.sh build
else
  echo "[verify] warning: no npm script 'build' found (skipping build)." >&2
fi

echo "[verify] ok" >&2
EOF

# ---------- git hooks ----------
write "$TARGET/.githooks/pre-commit" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ "${SKIP_LEAN_HOOKS:-0}" == "1" ]] && exit 0
./scripts/check.sh
EOF

write "$TARGET/.githooks/pre-push" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ "${SKIP_LEAN_HOOKS:-0}" == "1" ]] && exit 0
./scripts/verify.sh
EOF

# ---------- claude settings + hook ----------
write "$TARGET/.claude/settings.json" <<'EOF'
{
  "model": "sonnet",
  "env": {
    "NEXT_TELEMETRY_DISABLED": "1"
  },
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(./config/credentials.json)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Bash(curl *)",
      "Bash(wget *)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(vercel *)",
      "Bash(supabase *)",
      "Bash(npm install *)",
      "Bash(pnpm add *)",
      "Bash(pnpm remove *)",
      "Bash(yarn add *)",
      "Bash(bun add *)"
    ],
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Edit",
      "Write",
      "Bash(git status*)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git show*)",
      "Bash(git checkout*)",
      "Bash(git switch*)",
      "Bash(git add*)",
      "Bash(git commit*)",
      "Bash(node *)",
      "Bash(./scripts/*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/format-after-edit.mjs",
            "timeout": 20
          }
        ]
      }
    ]
  }
}
EOF

write "$TARGET/.claude/hooks/format-after-edit.mjs" <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function safeParse(jsonText) {
  try { return JSON.parse(jsonText); } catch { return null; }
}

const inputText = fs.readFileSync(0, "utf8");
const payload = safeParse(inputText);
if (!payload) process.exit(0);

const toolName = payload.tool_name;
if (toolName !== "Write" && toolName !== "Edit") process.exit(0);

const abs = payload?.tool_input?.file_path;
if (!abs || typeof abs !== "string") process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
try { process.chdir(projectDir); } catch {}

const rel = path.relative(projectDir, abs);
// Only format files inside the project directory
if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);

spawnSync("./scripts/format.sh", [rel], {
  stdio: "ignore",
  env: process.env
});

// Never fail Claude's flow because formatting failed
process.exit(0);
EOF

# ---------- skills ----------
write "$TARGET/.claude/skills/resume/SKILL.md" <<'EOF'
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
EOF

write "$TARGET/.claude/skills/mvp/SKILL.md" <<'EOF'
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
EOF

write "$TARGET/.claude/skills/step/SKILL.md" <<'EOF'
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
EOF

write "$TARGET/.claude/skills/ship/SKILL.md" <<'EOF'
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
EOF

# ---------- chmod ----------
chmod +x "$TARGET"/scripts/*.sh || true
chmod +x "$TARGET"/.githooks/* || true
chmod +x "$TARGET"/.claude/hooks/*.mjs || true

# ---------- git hooks enable ----------
if is_git_repo; then
  (cd "$TARGET" && git config core.hooksPath .githooks)
  echo "[ok] enabled git hooks: core.hooksPath=.githooks" >&2
else
  echo "[note] not a git repo at $TARGET (skipping git hook config)" >&2
fi

echo "" >&2
echo "[done] Lean Factory installed into: $TARGET" >&2
echo "Next steps:" >&2
echo "  1) Ensure package.json has scripts: lint, build (typecheck + test recommended)" >&2
echo "  2) Start Claude Code in repo and run: /mvp \"your idea\"" >&2
echo "  3) Then: /resume → /step (repeat) → /ship \"feat: ...\" → git push" >&2

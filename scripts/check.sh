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

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

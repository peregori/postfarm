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

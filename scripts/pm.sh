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

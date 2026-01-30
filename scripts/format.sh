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

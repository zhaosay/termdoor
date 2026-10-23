#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "[termdoor] pulling latest changes..."
# Preserve local work, including lockfile edits. Updates only run on a clean checkout.
if [[ -n "$(git status --porcelain)" ]]; then
  node lib/cli-ui.js error "update has local changes"
  exit 1
fi
if ! git pull --ff-only; then node lib/cli-ui.js error "update failed"; exit 1; fi

if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -qE '^package(-lock)?\.json$'; then
  echo "[termdoor] package.json changed, running npm install..."
  if ! npm install; then node lib/cli-ui.js error "install failed"; exit 1; fi
fi

echo "[termdoor] update complete, restarting..."
exec ./restart.sh

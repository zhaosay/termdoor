#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Candidate dependencies are installed before the running checkout is changed.
node lib/update.js
exec ./restart.sh

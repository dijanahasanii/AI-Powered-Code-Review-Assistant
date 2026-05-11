#!/usr/bin/env bash
# Usage: ./deploy.sh "your commit message"
#        ./deploy.sh               (uses default message below)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MSG="${commitMessage}"
git add -A
git commit -m "$MSG"
git push

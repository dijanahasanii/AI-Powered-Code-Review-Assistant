#!/bin/bash

echo "REBUILD_DATE=\"$(date +%Y-%m-%d\ %H:%M)\"" > ./.environment

git add .

read -p "Commit message: " commit_message

if [[ -z "$commit_message" ]]; then
  git commit -am "Deployment $(date +%Y-%m-%d\ %H:%M)"
else
  git commit -am "$commit_message"
fi

git push -u origin $(git rev-parse --abbrev-ref HEAD)
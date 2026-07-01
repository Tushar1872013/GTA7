#!/bin/bash
# Push to GitHub — run this after adding your credentials
#
# Option 1: Using a Personal Access Token (recommended)
#   1. Go to https://github.com/settings/tokens
#   2. Generate a new token with "repo" scope
#   3. Run: GH_TOKEN=your_token_here ./push-to-github.sh
#
# Option 2: Using SSH (if you have SSH keys set up)
#   1. Run: ./push-to-github.sh ssh
#
# Option 3: Manual — just run: git push -u origin main
#   and enter your GitHub username + token when prompted

set -e
cd "$(dirname "$0")"

if [ "$1" = "ssh" ]; then
  echo "Switching to SSH remote..."
  git remote set-url origin git@github.com:Tushar1872013/GTA7.git
  git push -u origin main
  echo "✓ Pushed via SSH!"
  exit 0
fi

if [ -n "$GH_TOKEN" ]; then
  echo "Pushing with token..."
  git remote set-url origin "https://Tushar1872013:${GH_TOKEN}@github.com/Tushar1872013/GTA7.git"
  git push -u origin main
  # Reset to clean URL (don't leave token in config)
  git remote set-url origin https://github.com/Tushar1872013/GTA7.git
  echo "✓ Pushed with token!"
  exit 0
fi

echo "No credentials provided. Options:"
echo "  1. GH_TOKEN=your_token ./push-to-github.sh"
echo "  2. ./push-to-github.sh ssh"
echo "  3. git push -u origin main (enter credentials manually)"
exit 1

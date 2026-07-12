#!/usr/bin/env bash
# Manual deploy: bring the compose stack to the newest release tag (vX.Y.Z).
# Run over SSH on the VM after cutting a release:
#
#   cd /opt/raeon && ./deploy.sh
#
# Idempotent: new tag -> checks it out and rebuilds; already on latest -> just
# recreates the stack. Pins to the highest release tag, never branch main.
set -euo pipefail

cd "$(dirname "$0")"
REMOTE="origin"

log() { echo "[deploy] $*"; }

# Refresh remote tags (public repo over HTTPS, no auth needed).
git fetch --tags --force --prune "$REMOTE" >/dev/null 2>&1

latest_tag="$(git tag -l 'v*' --sort=-v:refname | head -n1)"
if [ -z "$latest_tag" ]; then
  log "no release tags found; nothing to deploy"
  exit 0
fi

current="$(git describe --tags --exact-match 2>/dev/null || echo none)"
if [ "$current" != "$latest_tag" ]; then
  log "tag change: $current -> $latest_tag"
  # .env is gitignored, so --force won't touch local secrets.
  git checkout --force "$latest_tag"
fi

if [ ! -f .env ]; then
  log "ERROR: .env missing — create it first (DISCORD_TOKEN, DB_PASSWORD, LAVALINK_PASSWORD)"
  exit 1
fi

# External networks owned by the shared infra stacks (postgres, lavalink).
# Idempotent — the bot stack declares them external and won't start without.
docker network create shared-db    >/dev/null 2>&1 || true
docker network create lavalink-net >/dev/null 2>&1 || true

log "building + starting $latest_tag"
docker compose up -d --build

docker image prune -f >/dev/null 2>&1 || true
log "deployed $latest_tag"

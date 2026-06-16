#!/usr/bin/env bash
# Pull-based deploy: checks GitHub for the newest release tag (vX.Y.Z) and
# brings the compose stack to it. Idempotent — safe to run on a timer.
#
#   * fresh box / stack down  -> builds and starts the current latest tag
#   * new tag pushed          -> checks it out, rebuilds, recreates
#   * already on latest + up  -> no-op
#
# Run by the raeon-deploy.service systemd unit (as user 'ubuntu').
set -euo pipefail

APP_DIR="${RAEON_DIR:-/opt/raeon}"
REMOTE="origin"

log() { echo "[redeploy] $*"; }

cd "$APP_DIR"

# Refresh remote tags (public repo over HTTPS, no auth needed).
git fetch --tags --force --prune "$REMOTE" >/dev/null 2>&1

latest_tag="$(git tag -l 'v*' --sort=-v:refname | head -n1)"
if [ -z "$latest_tag" ]; then
  log "no release tags found; nothing to deploy"
  exit 0
fi

current="$(git describe --tags --exact-match 2>/dev/null || echo none)"

need_deploy=0

if [ "$current" != "$latest_tag" ]; then
  log "tag change: $current -> $latest_tag"
  # .env is gitignored, so --force won't touch local secrets.
  git checkout --force "$latest_tag"
  need_deploy=1
fi

# Nothing running? (first boot, or crash/reboot) -> (re)start.
if [ -z "$(docker compose ps -q --status running 2>/dev/null)" ]; then
  log "stack not running"
  need_deploy=1
fi

if [ "$need_deploy" -eq 0 ]; then
  log "on $latest_tag and running; nothing to do"
  exit 0
fi

if [ ! -f "$APP_DIR/.env" ]; then
  log "ERROR: $APP_DIR/.env missing — create it before deploying (DISCORD_TOKEN, DB_PASSWORD, LAVALINK_PASSWORD)"
  exit 1
fi

# External networks owned by the shared infra stacks (postgres, lavalink).
# Idempotent — the bot stack declares them `external` and won't start without.
docker network create shared-db    >/dev/null 2>&1 || true
docker network create lavalink-net >/dev/null 2>&1 || true

log "building + starting $latest_tag"
docker compose up -d --build

docker image prune -f >/dev/null 2>&1 || true
log "deployed $latest_tag"

#!/usr/bin/env bash
# Pairs with .github/workflows/build.yml (GHCR image tagged by sha) and a
# compose service carrying `image: ghcr.io/latoulicious/raeon:${TAG:-main}`.
set -euo pipefail
cd "$(dirname "$0")"

usage() {
  cat <<'EOF'
Usage: deploy.sh [sha]

No arg: pull main and deploy its HEAD. With a sha: deploy that commit
(rollback). Images come from GHCR (TAG = deployed sha); nothing builds here.
EOF
}

REF="${1:-}"
[[ "$REF" == "-h" || "$REF" == "--help" ]] && { usage; exit 0; }
[[ -z "$REF" || "$REF" =~ ^[0-9a-fA-F]{7,40}$ ]] || { echo "invalid sha: $REF" >&2; exit 2; }

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing — create it first (DISCORD_TOKEN, DB_PASSWORD, LAVALINK_PASSWORD)" >&2
  exit 1
fi

git fetch --prune origin
if [[ -n "$REF" ]]; then
  git checkout --detach "$REF"
else
  git checkout main
  git pull --ff-only origin main
fi

TAG="$(git rev-parse HEAD)"
export TAG

# External networks owned by the shared infra stacks (postgres, lavalink).
docker network create shared-db    >/dev/null 2>&1 || true
docker network create lavalink-net >/dev/null 2>&1 || true

# Explicit -f: never let a local-dev docker-compose.override.yml auto-load
# on the VPS.
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d --wait --remove-orphans

docker image prune -f >/dev/null 2>&1 || true
echo "deployed $TAG"

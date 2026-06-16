# Docker Setup

The bot runs as a **bot-only** stack. Postgres and Lavalink+yt-cipher are
shared infrastructure, extracted to standalone stacks under
`/Atelier/Infrastructure/{postgres,lavalink}`. The bot reaches them over two
external docker networks:

- `shared-db`    → `postgres:5432`  (via `DATABASE_URL`)
- `lavalink-net` → `lavalink:2333`  (via `LAVALINK_HOST`)

## Quick Start

1. **Bring up shared infra first** (once per VPS):

   ```bash
   docker network create shared-db lavalink-net

   cd /Atelier/Infrastructure/postgres
   cp .env.example .env   # set POSTGRES_PASSWORD
   docker compose up -d

   cd /Atelier/Infrastructure/lavalink
   cp .env.example .env   # set LAVALINK_PASSWORD, YT_CIPHER_TOKEN, YOUTUBE_REFRESH_TOKEN
   docker compose up -d
   ```

2. **Bot environment:**

   ```bash
   cp .env.example .env
   # fill DISCORD_TOKEN, LAVALINK_PASSWORD, DB_PASSWORD
   ```

   `LAVALINK_PASSWORD` must equal the lavalink stack's; `DB_PASSWORD` must
   equal the postgres stack's `POSTGRES_PASSWORD`.

3. **Build and run the bot:**

   ```bash
   docker compose up -d --build
   docker compose logs -f raeon-bot
   ```

In-stack `LAVALINK_HOST` and `DATABASE_URL` are injected by compose — you do
not set them in `.env` for the Docker path. The bot tolerates infra not being
up yet (Shoukaku reconnects to Lavalink; Postgres is optional/fire-and-forget),
so there is no `depends_on` across stacks.

## Environment Variables

Required in the bot's `.env`:

```bash
DISCORD_TOKEN=your_discord_bot_token
LAVALINK_PASSWORD=shared_with_the_lavalink_node
DB_PASSWORD=matches_postgres_stack_POSTGRES_PASSWORD
```

Optional: `LOG_LEVEL` (default `info`), `HEALTH_PORT` (default `3000`).
`NODE_ENV` is forced to `production` in-stack — commands register globally.
The YouTube/cipher secrets (`YT_CIPHER_TOKEN`, `YOUTUBE_REFRESH_TOKEN`) now
live in the **lavalink** stack's `.env`, not the bot's.

## Health check

`GET http://127.0.0.1:3000/health` → `200` when Discord, Lavalink, and the DB
are all reachable, `503` otherwise. Wire it into Uptime Kuma. The container
healthcheck uses the same endpoint.

## Common Commands

```bash
# Bot logs / rebuild
docker compose logs -f raeon-bot
docker compose up -d --build
docker compose down

# Lavalink (in the infra stack dir)
cd /Atelier/Infrastructure/lavalink && docker compose logs -f lavalink

# Postgres (in the infra stack dir)
cd /Atelier/Infrastructure/postgres
docker compose exec postgres psql -U raeon -d raeon
docker compose exec postgres pg_dump -U raeon raeon > backup.sql
docker compose exec -T postgres psql -U raeon raeon < backup.sql
```

## Host port bindings

All bound to localhost only:

- Bot health: `127.0.0.1:3000`
- Lavalink:   `127.0.0.1:2333`  (lavalink stack)
- Postgres:   `127.0.0.1:5432`  (postgres stack)

## Troubleshooting

- **Bot exits `network shared-db not found`:** create the external networks
  (`docker network create shared-db lavalink-net`) and start the infra stacks.
- **Bot can't reach DB/Lavalink:** confirm both infra stacks are `up` and on
  the right networks (`docker network inspect shared-db lavalink-net`), and
  that passwords match across stacks.
- **Postgres auth failures after changing `DB_PASSWORD`:** the password is
  baked into the volume at first init. Change it with `ALTER USER`, or drop
  the volume and re-up. See `Infrastructure/postgres/README.md`.
- **No tracks resolve:** check the lavalink stack logs for youtube-source
  errors; YT auth lives in `Infrastructure/lavalink/application.yml`.

## Services Overview

- **raeon-bot** (this stack): the Discord bot — multi-stage `node:24-alpine`,
  non-root, health server on 3000.
- **postgres** (`Infrastructure/postgres`): shared PostgreSQL 16, one DB per
  project.
- **lavalink + yt-cipher** (`Infrastructure/lavalink`): shared Lavalink v4
  audio node and its cipher sidecar.

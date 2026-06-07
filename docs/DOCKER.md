# Docker Setup

## Quick Start

1. **Setup environment:**

   ```bash
   cp .env.example .env
   # fill DISCORD_TOKEN, LAVALINK_PASSWORD, DB_PASSWORD
   ```

2. **Build and run:**

   ```bash
   docker compose up -d --build
   ```

3. **View logs:**

   ```bash
   docker compose logs -f raeon-bot
   ```

The bot starts only after the `lavalink` and `postgres` healthchecks
pass. In-stack `LAVALINK_HOST` and `DATABASE_URL` are injected by
compose — you do not set them in `.env` for the Docker path.

## Environment Variables

Required in `.env`:

```bash
DISCORD_TOKEN=your_discord_bot_token
LAVALINK_PASSWORD=shared_with_the_lavalink_node
DB_PASSWORD=postgres_password_for_the_stack
```

Optional: `LOG_LEVEL` (default `info`). `NODE_ENV` is forced to
`production` in-stack — commands register globally.

## Common Commands

```bash
# View logs
docker compose logs -f raeon-bot
docker compose logs -f lavalink

# Stop services
docker compose down

# Rebuild after changes
docker compose up -d --build

# Run only the services (bot on host)
docker compose up -d lavalink postgres

# Connect to database
docker compose exec postgres psql -U raeon -d raeon

# Backup database
docker compose exec postgres pg_dump -U raeon raeon > backup.sql

# Restore database
docker compose exec -T postgres psql -U raeon raeon < backup.sql
```

## Host port bindings

Both service ports bind to localhost only (for a host-run dev bot and
DB tools):

- Lavalink: `127.0.0.1:2333`
- Postgres: `127.0.0.1:5432`

## Troubleshooting

- **Bot never starts:** check `docker compose ps` — it waits for both
  healthchecks. A failing lavalink healthcheck usually means
  `LAVALINK_PASSWORD` is unset.
- **Postgres auth failures after changing `DB_PASSWORD`:** the password
  is baked into the volume at first init. `docker compose down &&
  docker volume rm raeon_postgres_data` (logs only) and re-up.
- **Port 5432/2333 already allocated:** another stack holds the host
  port — stop it or remove the `ports:` binding (in-stack networking
  does not need it).
- **No tracks resolve:** check `docker compose logs lavalink` for
  youtube-source errors; YT blocking may require auth config in
  `lavalink/application.yml`.

## Services Overview

- **raeon-bot:** the Discord bot (multi-stage `node:24-alpine` image,
  non-root, no exposed ports, no binaries)
- **lavalink:** Lavalink v4 node with the youtube-source plugin —
  resolves and streams all audio
- **postgres:** PostgreSQL 15 log sink with persistent storage
  (`postgres_data` volume)

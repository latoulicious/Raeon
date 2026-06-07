---
title: "Running"
aliases:
  - "Running Raeon"
tags:
  - external-projects
  - personal
  - raeon
  - reference
type: reference
status: active
updated: 2026-06-07
---

# Running

## Environment variables

| Variable | Required | Default | Used by |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | yes (≥50 chars) | — | login; validated at startup |
| `LAVALINK_PASSWORD` | yes (non-empty) | — | bot ↔ node auth; also interpolated into the lavalink compose service |
| `LAVALINK_HOST` | no | `localhost` | node address (compose sets `lavalink` in-stack) |
| `LAVALINK_PORT` | no | `2333` | node port; validated 1–65535 when set |
| `DATABASE_URL` | no | — | PostgreSQL log sink; logging disabled without it (compose sets the in-stack URL) |
| `DB_PASSWORD` | compose only | — | interpolated into the postgres service and the bot's in-stack `DATABASE_URL` |
| `LOG_LEVEL` | no | `info` | pino level |
| `NODE_ENV` | no | — | `development` → pino-pretty + guild command sync; anything else → JSON logs + global sync (compose forces `production`) |
| `DEV_GUILD_ID` | no | — | dev-mode guild for command sync |
| `CLEAR_GUILDS` | no | `false` | `true` → wipe guild commands from all guilds at boot |

No system binaries required — audio is handled by the Lavalink node.
The only host dependency is Docker (for the node) or a reachable
external Lavalink v4 instance.

## Local (bot on host, services in Docker)

```bash
npm install
cp .env.example .env   # fill DISCORD_TOKEN, LAVALINK_PASSWORD; DB_PASSWORD/DATABASE_URL optional
docker compose up -d lavalink          # add postgres for DB logging
npm run build
npm start
```

For DB logging from a host-run bot, start postgres too and set
`DATABASE_URL=postgresql://raeon:<DB_PASSWORD>@localhost:5432/raeon`
(compose binds postgres to `127.0.0.1:5432`, lavalink to
`127.0.0.1:2333`).

Dev loop: `npm run dev` (tsc --watch) in one terminal, `npm start` after
rebuilds. For fast slash-command iteration set `NODE_ENV=development` and
`DEV_GUILD_ID` — commands sync to one guild instantly instead of waiting
on global propagation. If you previously synced guild commands and switch
to global, boot once with `CLEAR_GUILDS=true` to remove duplicates.

## Docker (full stack)

```bash
cp .env.example .env   # fill DISCORD_TOKEN, LAVALINK_PASSWORD, DB_PASSWORD
docker compose up -d --build
docker compose logs -f raeon-bot
```

Compose runs `raeon-bot` + `lavalink` (ghcr v4, youtube-source plugin,
authed `/version` healthcheck) + `postgres:15-alpine` (`postgres_data`
volume, `pg_isready` healthcheck). The bot starts only after both
services are healthy and gets `LAVALINK_HOST`/`DATABASE_URL` injected —
no in-stack values needed in `.env`. Commands register globally
(`NODE_ENV=production` is forced); expect up to ~1h propagation on
first registration.

Verified e2e 2026-06-07: build, stack boot, Discord + node + postgres
connections.

## Releases

`npm run release:patch|minor|major` → `scripts/release.sh`: clean-tree
check, optional tests/build, version bump commit, annotated `vX.Y.Z` tag,
push, optional GitHub release via `gh`. Details: `docs/RELEASE.md`.

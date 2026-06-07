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
| `YTDLP_COOKIES_PATH` | yes (file must exist and be readable) | — | yt-dlp `--cookies`; validated at startup |
| `DATABASE_URL` | no | — | PostgreSQL log sink; logging disabled without it |
| `LOG_LEVEL` | no | `info` | pino level |
| `NODE_ENV` | no | — | `development` → pino-pretty + guild command sync; anything else → JSON logs + global sync |
| `DEV_GUILD_ID` | no | — | dev-mode guild for command sync |
| `CLEAR_GUILDS` | no | `false` | `true` → wipe guild commands from all guilds at boot |
| `DB_PASSWORD` | docker only | — | consumed by docker-compose for the postgres service |

System binaries required on PATH: `yt-dlp`, `ffmpeg` (both checked at
startup; boot fails with a user-friendly message if missing).

## Local

```bash
npm install
cp .env.example .env   # fill DISCORD_TOKEN, YTDLP_COOKIES_PATH; DATABASE_URL optional
npm run build
npm start
```

Dev loop: `npm run dev` (tsc --watch) in one terminal, `npm start` after
rebuilds. For fast slash-command iteration set `NODE_ENV=development` and
`DEV_GUILD_ID` — commands sync to one guild instantly instead of waiting
on global propagation. If you previously synced guild commands and switch
to global, boot once with `CLEAR_GUILDS=true` to remove duplicates.

## Docker

```bash
cp .env.example .env
docker-compose up -d --build
docker-compose logs -f raeon-bot
```

Compose runs `raeon-bot` + `postgres:15-alpine` (`postgres_data` volume).
Inside compose, `DATABASE_URL` host is `postgres:5432` and the cookies
file is mounted to `/app/cookies.txt`.

**Caveat:** the Docker path currently has open findings — image build
(`npm ci --only=production` vs tsc build), the `--health-check` flag,
and missing `cookies.txt` / `init.sql` host files. See
[findings.md](findings.md) F-1..F-3 before relying on it.

## Releases

`npm run release:patch|minor|major` → `scripts/release.sh`: clean-tree
check, optional tests/build, version bump commit, annotated `vX.Y.Z` tag,
push, optional GitHub release via `gh`. Details: `docs/RELEASE.md`.

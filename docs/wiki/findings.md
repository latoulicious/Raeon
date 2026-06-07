---
title: "Findings"
aliases:
  - "Raeon Findings"
tags:
  - external-projects
  - personal
  - raeon
  - review
type: log
status: active
updated: 2026-06-07
---

# Findings

Append-only code-review findings log. Each finding keeps its ID forever;
fixes are recorded in [resolutions.md](resolutions.md) under the same ID.
"Code reading" means verified by reading the source, not by running it.

## 2026-06-07 — wiki bootstrap audit

- **F-1** `Dockerfile` — `npm ci --only=production` installs no
  devDependencies, then `RUN npm run build` invokes `tsc` (a
  devDependency). The image build is expected to fail (code reading; build
  not attempted). Fix direction: multi-stage build or install dev deps for
  the build stage.
- **F-2** `Dockerfile` + `docker-compose.yml` — healthchecks run
  `node dist/main.js --health-check`, but `src/main.ts` implements no such
  flag; the command would boot a second full bot instance instead of a
  cheap check.
- **F-3** `docker-compose.yml` — mounts `./cookies.txt` and `./init.sql`;
  neither file exists in the repo (both gitignored or absent). Docker
  creates *directories* at missing host paths, which then breaks yt-dlp
  cookie reads and the postgres init mount.
- **F-4** Node version drift: `README.md` says Node 21+, `package.json`
  engines says `>=18`, `Dockerfile` uses `node:18-alpine`. One story
  needed.
- **F-5** `docs/DOCKER.md` claimed `YTDLP_COOKIES_PATH` is optional;
  `loadConfig()` and the startup validator hard-require it.
- **F-6** `/skip` stops playback instead of advancing: it calls
  `MusicService.stop()` → `GuildPlayer.stop()` aborts the playback loop;
  the queue survives but the next track only starts on the next `/play`
  (code reading).
- **F-7** `VoiceGateway.play()` rejects after a fixed 300s timeout —
  tracks longer than ~5 minutes are expected to fail mid-play (code
  reading).
- **F-8** Dead code in the logging stack: `DatabaseLogger.cleanupOldLogs()`,
  `AppLogger.getMetrics()`, `AppLogger.logWithContext()` have no callers;
  the `logs` table has no retention.
- **F-9** `Dockerfile` `EXPOSE 3000` — no HTTP server exists; the port is
  meaningless.

## 2026-06-07 — stabilization R0 audit

- **F-10** `npm audit`: 5 high advisories in `tar <=7.5.10` via
  `@discordjs/opus → @discordjs/node-pre-gyp → tar` (also reached through
  `@discordjs/voice → prism-media`). **No fix available upstream.**
  Install-time only (prebuild download/extract), not runtime code.
  Accepted risk until the audio-extraction replacement (which may drop
  @discordjs/opus entirely) lands.

## 2026-06-07 — L0 CodeRabbit review

- **F-11** `docker-compose.yml` (lavalink healthcheck) — CodeRabbit
  (minor) suggested removing the `Authorization` header from the
  `/version` healthcheck, claiming the endpoint is public.

## 2026-06-07 — L2 CodeRabbit review

- **F-12** `domain/guild-player.ts` exception handling — CodeRabbit
  (critical) argued `end(loadFailed)` may not always follow `exception`
  and the queue could hang; suggested treating `exception` as terminal
  and advancing on it.

## 2026-06-07 — UX refresh live smoke (user-reported)

- **F-13** `/queue` failed live with the generic fallback ("There was
  an error while executing this command!"); bot log shows
  `"Received one or more errors"` (discord.js builder validation). The
  queue embed packed up to 10 full track lines into a single field —
  Discord caps field values at 1024 chars, so long titles overflowed
  and embed validation threw. Same latent overflow in the `/search`
  description (4096 cap, up to 20 results).

## 2026-06-08 — persistent queue & playlist CodeRabbit review

- **F-14** `src/commands/play.ts` watch+list notice — CodeRabbit
  (minor): the single-track playlist notice still said "Playlists are
  not supported yet", which became false when Q5 shipped full
  queueing for pure playlist URLs. Misleads users who could paste the
  playlist URL instead. Only finding from the Q0–Q6 review
  (base `3e2fc8e`).

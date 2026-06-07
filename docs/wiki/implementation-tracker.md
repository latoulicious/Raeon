---
title: "Implementation Tracker"
aliases:
  - "Raeon Implementation Tracker"
tags:
  - external-projects
  - personal
  - raeon
  - reference
type: reference
status: active
updated: 2026-06-07
---

# Implementation Tracker

Current implementation snapshot (audited against code 2026-06-07). Use
code as the source of truth when docs drift. Future work belongs in
[nice-to-have.md](nice-to-have.md); historical context in
[deferred-notes.md](deferred-notes.md).

Status legend:

- `done`: implemented enough to use.
- `partial`: usable, but with known gaps or missing hardening.
- `reserved`: wired intentionally but has no behavior yet.
- `deferred`: intentionally not built yet.

## Bot

| Area | Status | Current state | Follow-up source |
| --- | --- | --- | --- |
| Bootstrap / shutdown | done | Composition root in `main.ts`; graceful shutdown on SIGINT/SIGTERM/unhandled errors with 10s force-exit; cleanup order: intervals → music → client → DB pool. | — |
| Config / startup validation | done | dotenv + hard checks: token length, `LAVALINK_PASSWORD` non-empty, `LAVALINK_PORT` range; friendly failure messages. No binaries, no cookies (L4). | — |
| Slash commands (14) | done | ping, play, stop, skip, queue, clear, commands, search, nowplaying, pause, resume, shuffle, remove, prune. Dispatch via `handler/slash.ts`. | — |
| Command registration | done | Global sync by default; dev-guild sync with `NODE_ENV=development` + `DEV_GUILD_ID`; `CLEAR_GUILDS` cleanup flag. | — |
| Audio pipeline | done | Lavalink end-to-end (L2–L4): `GuildPlayer` orchestrates a Shoukaku player via the domain `PlayerPort`; track-end auto-advance (F-6), native pause/resume (position kept), no track ceiling (F-7); queue cap 20. Legacy yt-dlp/ffmpeg code and deps deleted. E2e boot + playback user-verified in-stack 2026-06-07; per-command smoke checklist below. | — |
| Multi-guild playback | partial | Shoukaku players are keyed per guild — the "first live connection" routing bug is structurally gone (L2). Concurrent two-guild playback not yet live-verified (smoke checklist). | — |
| Search | done | `/search` and `/play ytsearchN:query` resolve through Lavalink REST (`ytsearch:`); the legacy N-count syntax is accepted and normalized (L3). | — |
| Idle timeout | done | 5-min inactivity → disconnect + embed notification to last text channel; 30s sweep. | — |
| Presence | done | 30s rotation: current `Track.title` from resolve-time metadata (L3 — subprocess churn gone) or server/channel stats. | — |
| Logging / metrics | partial | pino + optional fire-and-forget Postgres mirror; in-memory counters (`total_commands`, `active_players`, `track_load_failures`, `player_errors`) logged every 5 min. `cleanupOldLogs`, `getMetrics`, `logWithContext` are dead code (F-8). | Log retention + dead-code cleanup in `nice-to-have.md`. |
| Database | partial | `logs` table auto-created at boot; no migrations; no business data. | Unbounded growth — `nice-to-have.md`. |
| Message/reaction handlers | reserved | Events wired, handlers are no-op stubs. | Define a use case first. |
| Dependencies | done | Current as of 2026-06-07: discord.js 14.26.4, shoukaku 4.3.0, pino 10.3.1, TS 5.9.3 + NodeNext, @types/node 24, engines `>=24`. `npm audit` clean — the voice/opus chain and its tar advisories (F-10) are gone (L4). | — |
| Docker | done | Multi-stage `node:24-alpine` Dockerfile (no apk toolchain, non-root `node` user, no EXPOSE/healthcheck); compose = bot + lavalink + postgres, bot gated on both healthchecks, dead `init.sql`/`cookies.txt` mounts gone (L5, e2e-verified 2026-06-07). F-1..F-4, F-9 closed in `resolutions.md`. | — |
| Lavalink node | done | Compose service `lavalink` (ghcr v4.2.2, youtube-source 1.18.1, authed `/version` healthcheck, yml mounted ro). Shoukaku 4.3.0 single node from `LAVALINK_*` env, lifecycle logging, per-guild players, REST resolve. E2e user-verified in-stack 2026-06-07. | YouTube auth hooks unset until blocking observed (`known-constraints.md`). |
| Release tooling | done | `scripts/release.sh` via npm scripts: clean-tree check, bump, tag, push, optional gh release. | — |
| Tests | deferred | No test suite; verification is `npm run build` + live checks. | `nice-to-have.md`. |

## Pending smoke checklist (L6 remainder)

E2e boot + basic playback are user-verified (2026-06-07). Still
unchecked per-command, in Discord:

- [ ] `/play <url>` and `/play <bare query>` (ytsearch)
- [ ] `/pause` → `/resume` keeps position
- [ ] `/skip` auto-advances to the next queued track
- [ ] `/queue` shows title/author/duration metadata
- [ ] playlist URL queues the linked track + info notice
- [ ] idle disconnect after 5 min + timeout embed
- [ ] concurrent playback in two guilds

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
| Config / startup validation | done | dotenv + hard checks: token length, cookies file readable, yt-dlp + ffmpeg on PATH; friendly failure messages. | — |
| Slash commands (14) | done | ping, play, stop, skip, queue, clear, commands, search, nowplaying, pause, resume, shuffle, remove, prune. Dispatch via `handler/slash.ts`. | Behavior caveats in `known-constraints.md` (skip, resume). |
| Command registration | done | Global sync by default; dev-guild sync with `NODE_ENV=development` + `DEV_GUILD_ID`; `CLEAR_GUILDS` cleanup flag. | — |
| Audio pipeline | partial | yt-dlp → ffmpeg (opus 48k/2ch/128k) → @discordjs/voice; abort chain kills subprocesses; queue cap 20. | 5-min track ceiling, no auto-advance on skip, resume restarts track — `known-constraints.md` / `nice-to-have.md`. |
| Multi-guild playback | partial | Per-guild players and queues are correct; `VoiceGateway` resolves the target guild as "first live connection", so concurrent multi-guild playback is unreliable. | `nice-to-have.md`. |
| Search | done | `/search` (1–20 results, dump-single-json) and `/play ytsearchN:query` resolve to first result. | — |
| Idle timeout | done | 5-min inactivity → disconnect + embed notification to last text channel; 30s sweep. | — |
| Presence | done | 30s rotation: current track title (yt-dlp --get-title) or server/channel stats. | Subprocess-per-refresh cost noted in `known-constraints.md`. |
| Logging / metrics | partial | pino + optional fire-and-forget Postgres mirror; in-memory counters logged every 5 min. `cleanupOldLogs`, `getMetrics`, `logWithContext` are dead code. | Log retention + dead-code cleanup in `nice-to-have.md`. |
| Database | partial | `logs` table auto-created at boot; no migrations; no business data. | Unbounded growth — `nice-to-have.md`. |
| Message/reaction handlers | reserved | Events wired, handlers are no-op stubs. | Define a use case first. |
| Dependencies | done | Current as of 2026-06-07 (stabilization R1/R3): discord.js 14.26.4, pino 10.3.1, TS 5.9.3 + NodeNext, @types/node 24, engines `>=24`. Remaining advisory: F-10 (tar, accepted). | `stabilization-plan.md`. |
| Docker | partial | Dockerfile + compose (bot + postgres15) exist; open findings F-1..F-3, F-9 + node:18 base (F-4). Bot-image refactor absorbed into the Lavalink migration (L5). | `lavalink-plan.md` / `findings.md`. |
| Lavalink node | partial | Compose service `lavalink` (ghcr v4, youtube-source 1.18.1, `/version` healthcheck, yml mounted ro) boots healthy standalone (L0, verified 2026-06-07). Bot not wired yet — Shoukaku lands at L1. | `lavalink-plan.md`. |
| Release tooling | done | `scripts/release.sh` via npm scripts: clean-tree check, bump, tag, push, optional gh release. | — |
| Tests | deferred | No test suite; verification is `npm run build` + live checks. | `nice-to-have.md`. |

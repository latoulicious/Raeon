---
title: "Known Constraints"
aliases:
  - "Raeon Known Constraints"
tags:
  - external-projects
  - personal
  - raeon
  - reference
type: reference
status: active
updated: 2026-06-07
---

# Known Constraints

Accepted caveats and behavioral limits, verified by code reading on
2026-06-07 (runtime-verified only where stated). If a constraint stops
being true, update this file in the same change.

History: the pre-Lavalink constraints (single-guild voice routing,
5-minute track ceiling, skip-no-advance, resume-restarts-track,
raw-URL queue, mandatory cookies file, `(global as any).client`) were
all removed structurally by the Lavalink migration (L0–L5, 2026-06-07).
See git history of this file and `lavalink-plan.md` for what they were.

## Runtime topology

- **The Lavalink node is a hard runtime dependency.** All track
  resolution (REST `/loadtracks`) and audio streaming happen on the
  node. If the node is down, every `/play` and `/search` fails and
  active playback dies; the bot itself stays up (Shoukaku reconnects
  with backoff, lifecycle logged). There is no degraded local-playback
  mode — the bot ships no audio code by design.
- **The node WS connects only after Discord `ready`.** The Shoukaku
  connector hooks gateway events, so a node that is up before the bot
  logs in is picked up automatically; a bot that boots while the node
  is down logs reconnect attempts.
- **YouTube blocking is a node-side risk.** youtube-source runs
  unauthenticated; YT may demand poToken/OAuth depending on IP
  reputation. `lavalink/application.yml` keeps the auth hooks unset —
  configure them only if blocking is observed.

## Playback behavior

- **Queue is in-memory and bot-side.** Lavalink has no queue concept;
  `GuildPlayer` holds the `Track[]`. A bot restart loses every queue
  (the node keeps streaming the current track until told otherwise —
  `musicService.cleanup()` disconnects all guilds on graceful
  shutdown).
- **Queue cap 20, idle disconnect 5 minutes** (sweep every 30s). Product
  decisions in `music.service.ts` / `timeout.ts`.
- **Playlists resolve to one track.** `selectedTrack` → `v=` param
  match → playlist head, with an info notice. Full playlist queueing is
  a non-goal (nice-to-have).
- **Exception handling rides `end(loadFailed)`.** Fatal track
  exceptions are followed by an `end(loadFailed)` that auto-advances;
  non-fatal ones leave the track playing. Hung tracks surface as
  `stuck`, which the orchestrator force-stops. Do not "fix" by
  advancing on `exception` — it double-advances or skips a live track
  (findings F-12).

## Wiring

- **Message/reaction handlers are reserved stubs.** Events are wired in
  `main.ts` but `handler/message.ts` and `handler/reaction.ts` only guard
  against bot authors and do nothing.
- **Compose overrides `.env` in-stack.** The bot service sets
  `LAVALINK_HOST=lavalink`, `DATABASE_URL=...@postgres:5432/...`, and
  `NODE_ENV=production` via `environment`, which beats `env_file`
  values. Host-dev values in `.env` apply only to a host-run bot. Note
  `NODE_ENV=production` means compose deployments register commands
  globally (up to ~1h propagation), not per dev guild.

## Logging / persistence

- **PostgreSQL is optional and fire-and-forget.** Without `DATABASE_URL`
  the bot runs with console logs only. With it, log writes are
  non-blocking and silently dropped when the pool is down (max 5
  reconnect attempts, exponential backoff capped at 60s). Do not treat
  the `logs` table as a reliable audit trail.
- **No migration system.** The `logs` table is `CREATE TABLE IF NOT
  EXISTS` at boot. `cleanupOldLogs()` exists but nothing calls it — the
  table grows unbounded (see nice-to-have).
- **Metrics are in-memory only** and reset on restart; they are logged
  every 5 minutes, not exported.
- **Postgres bakes its password at first init.** Changing `DB_PASSWORD`
  after the `postgres_data` volume exists does not change the database
  password — remove the volume (logs only, nothing precious) or `ALTER
  ROLE`.

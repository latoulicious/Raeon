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

## Playback behavior

- **Single-guild voice assumption.** `VoiceGateway.play()` resolves the
  target guild via `getCurrentGuildId()` — the *first* non-disconnected
  connection in the map (`src/infrastructure/voice-gateway.ts:127`).
  Concurrent playback in multiple guilds will route audio unpredictably.
  MusicService and GuildPlayer are per-guild correct; the gateway is the
  bottleneck.
- **Per-track 5-minute ceiling.** `VoiceGateway.play()` rejects with
  `Audio playback timeout` after 300s if the player has not gone Idle
  (`voice-gateway.ts:101`). Tracks longer than ~5 minutes are expected to
  die mid-play (not runtime-verified).
- **Skip does not auto-advance.** `/skip` calls `MusicService.stop()`,
  which aborts the playback loop; the queue is retained but the next
  track does not start until the next `/play` (code reading,
  `src/commands/skip.ts` + `guild-player.ts` loop condition).
- **Resume restarts the track.** Pause aborts the yt-dlp/ffmpeg processes;
  resume re-extracts the paused URL from the beginning — there is no
  seek/position memory (`guild-player.ts resume()`).
- **Queue holds raw URLs only.** No title/duration metadata is stored.
  Presence fetches titles ad hoc by spawning `yt-dlp --get-title` every
  30s while something plays — one subprocess per refresh.
- **Queue cap 20, idle disconnect 5 minutes** (sweep every 30s). Product
  decisions in `music.service.ts` / `timeout.ts`.

## Wiring

- **`(global as any).client`.** `main.ts` stores the discord.js client on
  `global`; `VoiceGateway.join()` reads it back. Any refactor of client
  ownership must keep or replace this handle.
- **Message/reaction handlers are reserved stubs.** Events are wired in
  `main.ts` but `handler/message.ts` and `handler/reaction.ts` only guard
  against bot authors and do nothing.
- **YouTube cookies file is mandatory.** Boot fails without a readable
  file at `YTDLP_COOKIES_PATH`, even though yt-dlp could technically run
  without cookies. Keeping it required is deliberate (age/region-gated
  content, bot-detection mitigation).

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

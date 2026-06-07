---
title: "Lavalink Migration Plan"
aliases:
  - "Raeon Lavalink Plan"
tags:
  - external-projects
  - personal
  - raeon
  - plan
type: plan
status: completed
updated: 2026-06-07
---

# Lavalink Migration Plan (L0–L6)

Goal: replace the spawned yt-dlp → ffmpeg → @discordjs/voice pipeline
with a Lavalink v4 node driven through **Shoukaku 4.3.0**. The bot stops
shipping audio bytes entirely — Lavalink resolves, decodes, and streams;
the bot keeps queueing, command UX, and Discord session state.

Scope decisions (user, 2026-06-07):

- **Lavalink runs in Docker** for local dev and in compose
  (`ghcr.io/lavalink-devs/lavalink:4`); no JVM on the host.
- **YouTube parity only** first cut — `youtube-source` plugin; lavasrc
  (Spotify/Deezer/Apple) stays in nice-to-have.
- Absorbs the deferred stabilization **R4/R5** (Docker refactor) — the
  bot image gets rebuilt here against the new, binary-free runtime.

What this kills (findings/constraints closed on completion):

| Today | After |
| --- | --- |
| F-1 Docker build break | L5 multi-stage rebuild (no native toolchain needed at all — opus/sodium deps gone) |
| F-2 fake `--health-check` | L5 removes it; Lavalink node gets a real `/version` healthcheck |
| F-3 dead compose mounts | L5 compose rewrite |
| F-4 node:18 base | L5 `node:24-alpine` |
| F-6 skip doesn't auto-advance | L2 track-`end` event drives the queue |
| F-7 300s track ceiling | gone with `VoiceGateway.play()` |
| F-9 `EXPOSE 3000` | L5 |
| F-10 tar advisories via @discordjs/opus | L4 removes the whole dependency chain |
| Single-guild voice routing bug | Shoukaku players are keyed per guild |
| Resume restarts track | Lavalink `pause` keeps position |
| Cookies file hard requirement | dropped; youtube-source has its own auth hooks if YT blocks |
| Presence `--get-title` subprocess churn | track metadata arrives at resolve time |

Note: F-6/F-7 were excluded from the *stabilization* plan as
behavior changes; this plan supersedes that exclusion — Lavalink fixes
them structurally, not as patches.

Non-goals: lavasrc sources, playlists (resolve takes first track +
notes the rest), volume/filters (Lavalink supports them — nice-to-have
candidates after parity), persistent queues, health endpoint for the bot.

Rollback model: one commit per phase, `git revert` per phase. L2–L4 are
a cutover (the old pipeline is unusable locally anyway — binaries are
deliberately absent); reverting past L2 restores the yt-dlp pipeline.

## Target architecture

```txt
/play → MusicService → GuildPlayer (queue, cap 20, bot-side)
            │
            ▼
   infrastructure/lavalink.ts (Shoukaku, Connectors.DiscordJS)
            │ WS (player ops, voice state)  +  REST (resolve)
            ▼
   Lavalink v4 node (Docker, youtube-source plugin)
            │
            ▼
   Discord voice (node sends opus directly)
```

- `domain/track.ts` — `Track { encoded, title, author, duration, uri }`
  replaces raw URL strings in the queue; embeds and presence read it.
- `GuildPlayer` becomes a queue orchestrator around a Shoukaku `Player`:
  `end` → shift queue → play next (auto-advance); `exception`/`stuck` →
  metric + skip; pause/resume native.
- `MusicService` public surface stays (commands untouched at L2):
  play/stop/skip/pause/resume/clear/shuffle/remove/getQueue/
  getCurrentTrack/isPlaying/isPaused + idle TimeoutService + text-channel
  notify.
- `domain/audio.ts` interfaces (`AudioExtractor`/`AudioEncoder`/
  `VoiceGateway`) are deleted with the old infrastructure.

## Environment changes

| Variable | Change |
| --- | --- |
| `LAVALINK_HOST` | new, default `localhost` (compose: `lavalink`) |
| `LAVALINK_PORT` | new, default `2333` |
| `LAVALINK_PASSWORD` | new, required (shared with the node container) |
| `YTDLP_COOKIES_PATH` | **removed** (L4) |

## Phases

### L0 — Lavalink node infra

- `lavalink/application.yml`: port 2333, password from env,
  youtube-source plugin enabled, built-in lavaplayer YouTube disabled.
- Compose service `lavalink` (`ghcr.io/lavalink-devs/lavalink:4`,
  `/version` healthcheck, yml mounted read-only). Local dev runs the
  same service standalone: `docker compose up lavalink`.
- Exit: node boots, `GET /version` answers with the password header,
  plugin load visible in logs.

### L1 — Shoukaku wiring

- `npm i shoukaku@^4.3.0`.
- `infrastructure/lavalink.ts`: Shoukaku instance on
  `Connectors.DiscordJS(client)`, single node from `LAVALINK_*` env,
  ready/error/close/reconnect logging through `appLogger`.
- `config/index.ts` + `startup-validator.ts`: add `LAVALINK_*`
  validation; binary/cookies checks stay until L4 (dead but harmless).
- Exit: bot boots, Shoukaku logs node ready; old pipeline untouched.

### L2 — Player/domain refactor

- `domain/track.ts` new; `GuildPlayer` rewritten on Shoukaku `Player`
  (join via Shoukaku's voice-channel join, `playTrack` with the encoded
  track, `end` event auto-advance, native pause/resume, no playback
  timeout). Queue cap 20 and idle timeout preserved.
- `MusicService` keeps its method surface; `play()` signature gains the
  resolved `Track` (resolution moves to L3 commands via REST).
- Exit: build clean; live (dev guild): /play, /pause, /resume keep
  position, /skip auto-advances, two-guild concurrent playback works.

### L3 — Commands + metadata

- `/play`: `rest.resolve(url)` or `ytsearch:` prefix handling;
  loadType switch (track / search → first / playlist → first + notice /
  error / empty).
- `/search`: `rest.resolve('ytsearch:query')`, slice to limit.
- `EmbedService`: now-playing/queue/play embeds take `Track` — real
  titles, authors, durations instead of bare URLs.
- Presence reads current `Track` — `yt-dlp --get-title` subprocess gone.
- Exit: embeds show metadata; `/play ytsearch10:...` parity confirmed.

### L4 — Legacy pipeline removal

- Delete `yt-dlp.ts`, `ffmpeg.ts`, `voice-gateway.ts`,
  `domain/audio.ts`; strip binary/cookies checks from
  `startup-validator.ts` and `config/index.ts`.
- Drop deps: `@discordjs/voice`, `@discordjs/opus`, `sodium-native`,
  `libsodium-wrappers`, `@snazzah/davey`, `@types/sodium-native`
  (resolves F-10 — tar chain disappears; expect `npm audit` clean).
- Metrics: `yt_dlp_failures`/`ffmpeg_failures` →
  `track_load_failures`/`player_errors` (in-memory only; `logs` table
  unaffected).
- `.env.example`, `README.md` env docs updated.
- Exit: build clean, boot without any binaries, audit clean.

### L5 — Docker/compose rebuild (absorbs R4/R5)

- Dockerfile: multi-stage `node:24-alpine`; with native modules gone the
  builder needs **no apk toolchain** — `npm ci`, `tsc`, then
  `npm ci --omit=dev`; runtime copies `dist/` + prod `node_modules`.
  Non-root kept. No `EXPOSE`, no fake `HEALTHCHECK` (F-1, F-2, F-4,
  F-9).
- Compose: `lavalink` + `postgres` + bot; remove `init.sql` and
  `cookies.txt` mounts (F-3); bot gated on both healthchecks
  (`/version`, `pg_isready`); drop the obsolete `version:` key.
- Exit: `docker build` succeeds, full stack boots, bot connects to both
  services.

### L6 — Verify + docs sync

- In-stack smoke: /ping, /play (URL + ytsearch), /pause→/resume
  position check, /skip auto-advance, /queue metadata, idle disconnect,
  two-guild playback.
- Wiki: `architecture.md` (pipeline + module map rewrite),
  `known-constraints.md` (kill resolved constraints; add: Lavalink node
  is a hard runtime dependency, queue remains in-memory/bot-side,
  YouTube blocking may need youtube-source auth config later),
  `running.md`, `implementation-tracker.md`, `findings.md`/
  `resolutions.md` close-outs, `nice-to-have.md` prune + add lavasrc,
  volume/filters, `docs/DOCKER.md`, `README.md`. Session log.
- Exit: docs match implementation; remaining open findings: F-8 only.

## Risks

- **YouTube blocking server-side.** youtube-source generally works
  unauthenticated, but YT may require poToken/OAuth depending on IP
  reputation. The yml keeps the config hooks; credentials are set up
  only if blocking is observed. This risk moves from the bot (cookies)
  to the node (plugin config) — it does not disappear.
- **Shoukaku v4 API drift vs memory.** Exact signatures
  (joinVoiceChannel options, REST loadType shapes) get verified against
  the installed package at L1/L3, not assumed.
- **Live verification needs a token.** L2/L3/L6 exits require a dev
  guild boot — machine currently has no `.env`; the user runs the smoke
  or provides one.

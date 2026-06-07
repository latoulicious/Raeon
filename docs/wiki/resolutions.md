---
title: "Resolutions"
aliases:
  - "Raeon Resolutions"
tags:
  - external-projects
  - personal
  - raeon
  - review
type: log
status: active
updated: 2026-06-07
---

# Resolutions

Fixes for entries in [findings.md](findings.md), same IDs. A finding
without a resolution here is still open.

## 2026-06-07

- **F-5** resolved — `docs/DOCKER.md` env example corrected:
  `YTDLP_COOKIES_PATH` marked required (matches `loadConfig()` and the
  startup validator).
- **F-4** partially resolved (stabilization R2, `a7d035f`) — engines
  `>=24` and README now agree on Node 24; the Dockerfile `node:18-alpine`
  base remains until the deferred R4 Docker refactor.

Open: F-1, F-2, F-3, F-4 (Dockerfile part), F-6, F-7, F-8, F-9, F-10
(accepted). Docker findings wait on the deferred R4/R5 phases; playback
findings are unapproved in [nice-to-have.md](nice-to-have.md).

## 2026-06-07 — L0

- **F-11** rejected — refuted by live test against the running node
  (Lavalink 4.2.2): `GET /version` without the header returns `401`;
  with it, `4.2.2`. v4 secures all REST endpoints (the public
  `/version` was v3 behavior). Removing the header would make the
  healthcheck fail permanently. Header kept, `$$`-escaped so the
  password resolves in-container, not in compose interpolation.
- **F-12** behavior rejected, wording fixed — per the lavaplayer
  contract, fatal exceptions are followed by `end(loadFailed)` (which
  auto-advances) and non-fatal exceptions leave the track playing;
  advancing on `exception` would double-advance or skip a live track.
  The hung-track case CodeRabbit worried about surfaces as `stuck`,
  which the orchestrator force-stops. The PlayerPort comment and the
  session log overclaimed "always follows" — both now state the
  fatal/non-fatal split and the `stuck` coverage explicitly.

## 2026-06-07 — Lavalink migration close-outs (L0–L5)

- **F-1** resolved (L5, `7ee87aa`) — multi-stage `node:24-alpine`
  Dockerfile: full `npm ci` + `tsc` in the builder, `npm ci --omit=dev`
  prune, runtime ships `dist/` + prod `node_modules` only. Build
  verified clean (264MB image).
- **F-2** resolved (L5, `7ee87aa`) — the fake `--health-check` flag is
  gone from both the Dockerfile and compose; the bot has no
  healthcheck (no cheap probe exists without an HTTP server — by
  design). The lavalink and postgres services carry real healthchecks
  and gate the bot's start.
- **F-3** resolved (L5, `7ee87aa`) — dead `cookies.txt` and `init.sql`
  mounts removed from compose; neither file is needed anymore.
- **F-4** fully resolved (L5, `7ee87aa`) — Dockerfile on
  `node:24-alpine`; engines/README were aligned at stabilization R2.
  One Node story everywhere.
- **F-6** resolved (L2, `0bdc948`) — `/skip` advances via the track
  `end` event: `GuildPlayer.skip()` stops the track and the resulting
  `end` auto-starts the next queued track. User-verified in-stack
  playback 2026-06-07; per-command smoke tracked at L6.
- **F-7** resolved (L2, `0bdc948`) — the 300s `VoiceGateway.play()`
  timeout died with the file; Lavalink streams without a bot-side
  ceiling.
- **F-9** resolved (L5, `7ee87aa`) — `EXPOSE 3000` removed; the image
  exposes nothing (no HTTP server exists).
- **F-10** resolved (L4, `170bfdd`) — the entire `@discordjs/voice` /
  `@discordjs/opus` chain (and its `tar` advisories) was dropped;
  `npm audit` reports 0 vulnerabilities.

## 2026-06-07 — UX refresh

- **F-13** resolved (`71af53c`) — track lists are built by
  `EmbedService.formatTrackList`, char-budgeted against Discord's
  limits (field value 1024 for `/queue`, description 4096 for
  `/search`), with titles/authors truncated in the shared
  `formatTrackLine`. Hidden entries surface as "...and N more" in the
  footer. Verified by build + rebuilt image; live `/queue` re-check is
  on the smoke checklist.

## 2026-06-08 — persistent queue & playlist review

- **F-14** resolved — notice copy now reads "queued the linked track
  only. To queue the entire playlist, use the playlist URL
  (youtube.com/playlist?list=...) instead of a video URL." Copy-only
  change, behavior untouched; verified by build.

Open: **F-8 only** (dead logging code / no retention — candidate work
in [nice-to-have.md](nice-to-have.md)).

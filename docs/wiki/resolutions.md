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

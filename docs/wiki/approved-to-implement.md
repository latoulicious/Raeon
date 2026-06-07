---
title: "Approved To Implement"
aliases:
  - "Raeon Approved To Implement"
tags:
  - external-projects
  - personal
  - raeon
  - backlog
type: reference
status: active
updated: 2026-06-07
---

# Approved To Implement

Work the user has explicitly approved, in priority order. Move items here
from [nice-to-have.md](nice-to-have.md) only after explicit approval;
remove them when shipped (and record the change in a session log).

## Stabilization plan R0–R6 (approved 2026-06-07)

[stabilization-plan.md](stabilization-plan.md) — dependency updates,
Node 24 unification, multi-stage Dockerfile refactor, compose fixes,
verification. Playback fixes (F-6/F-7) remain unapproved in
[nice-to-have.md](nice-to-have.md).

Progress: **R0–R3 shipped 2026-06-07** (`3bc5e93`, `a7d035f`,
`4c60d6d`). **R4/R5/R6 superseded** — absorbed into the Lavalink
migration plan's L5/L6 phases (the replacement is now specced).

## Lavalink migration L0–L6 (approved 2026-06-07)

[lavalink-plan.md](lavalink-plan.md) — replace the yt-dlp → ffmpeg →
@discordjs/voice pipeline with a Dockerized Lavalink v4 node driven via
Shoukaku 4.3.0; YouTube parity first (lavasrc stays nice-to-have).
Absorbs the deferred Docker refactor; on completion closes F-1..F-4,
F-6, F-7, F-9, F-10 plus the single-guild voice, resume-restart, and
cookies constraints.

Progress: **shipped 2026-06-07** — L0 `76636b7`, L1 `b89df9b`,
L2 `0bdc948`, L3 `ed37dd4`, L4 `170bfdd`, L5 `7ee87aa`, L6 docs sync.
Closed F-1..F-4, F-6, F-7, F-9, F-10 (see resolutions.md); F-8 is the
only open finding. E2e verified in-stack; the per-command smoke
checklist lives in implementation-tracker.md.

## Embed UX refresh U0–U3 (approved 2026-06-07)

[ux-refresh-plan.md](ux-refresh-plan.md) — palette + single-icon design
system, per-command embed refresh, error-path hardening (ephemeral guard
embeds, deduped handler fallback, plain error copy, throttled
playback-failure notify). Presentation and error-reply scope only.
Discord-native palette chosen at approval.

Progress: **shipped 2026-06-07** — U0 `3f86f9e`, U1 `7a8acab`,
F-13 fix `71af53c`, U2 `d407f51`, U3 docs sync. Closed F-13
(user-reported `/queue` overflow found mid-implementation). Live
screenshot pass + smoke additions tracked in
implementation-tracker.md.

## Persistent queue & playlists Q0–Q6 (approved 2026-06-07)

[persistent-queue-plan.md](persistent-queue-plan.md) — both bands
approved: queue survives bot death via a `guild_sessions` table
(write-through snapshots, lazy restore, restart from 0:00), and full
playlist queueing for pure playlist URLs (fill to cap, "Queued N of
M"). First business table — the AGENTS.md "log sink only" constraint
was rewritten at Q3.

Progress: **Q0–Q3 shipped 2026-06-07** — Q0 `d105feb`, Q1 `be68f77`,
Q2 `f311782`, Q3 docs sync. Crash + graceful drills verified at the
Docker level; live Discord revive smoke tracked in
implementation-tracker.md. Q4–Q6 (playlists) next.

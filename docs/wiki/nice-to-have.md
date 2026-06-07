---
title: "Nice-to-have / Known Gaps"
aliases:
  - "Raeon Nice-to-have"
tags:
  - external-projects
  - personal
  - raeon
  - backlog
type: reference
status: active
updated: 2026-06-07
---

# Nice-to-have / Known Gaps

Unreviewed future work. Nothing here is approved — move items to
[approved-to-implement.md](approved-to-implement.md) only after explicit
user approval. Bugs with concrete evidence live in
[findings.md](findings.md); this list is the candidate-work view.

## Playback correctness

- Auto-advance after `/skip` (today skip aborts the loop; queue is kept
  but playback stops — findings F-6).
- Remove or raise the 5-minute per-track playback timeout in
  `VoiceGateway.play()` (findings F-7).
- True pause/resume (seek/position memory) instead of restarting the
  track from the beginning.
- Route `VoiceGateway.play()` by explicit guildId instead of
  "first live connection" so multi-guild playback is reliable.

## Features

- Track metadata in the queue (title/duration at enqueue time) — would
  also remove the presence `--get-title` subprocess churn.
- Playlist support (`--no-playlist` is currently forced).
- Volume control.
- Health endpoint or real `--health-check` fast path (also fixes
  findings F-2).

## Operations

- Fix the Docker image build (findings F-1) and compose mounts (F-3).
- Wire `cleanupOldLogs()` (exists, never called) or a retention policy —
  the `logs` table grows unbounded.
- Remove or use dead code: `getMetrics()`, `logWithContext()`.
- Reconcile Node version story (README 21+, engines >=18, Dockerfile
  node:18 — findings F-4).

## Quality

- Test suite (none exists; even smoke tests around `GuildPlayer` state
  transitions and the queue would pay off).
- CI (build + lint on push).

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

## Features

- **lavasrc sources** (Spotify/Deezer/Apple Music) — plugin on the
  Lavalink node; deliberately out of the migration's YouTube-parity
  scope.
- **Volume control / filters** — Lavalink supports both natively;
  surface as commands.
- **Full playlist queueing** — playlists currently resolve to a single
  track with an info notice (migration non-goal). Mind the queue cap.
- **Persistent queues** — queue is in-memory and dies with the bot
  process (see known-constraints).
- Health endpoint for the bot (would need an HTTP server — see
  AGENTS.md constraint; needs approval).

## Operations

- Wire `cleanupOldLogs()` (exists, never called) or a retention policy —
  the `logs` table grows unbounded (findings F-8).
- Remove or use dead code: `getMetrics()`, `logWithContext()` (findings
  F-8).
- Persist the Lavalink plugin jar across container recreates (volume) —
  today it re-downloads at node boot.
- youtube-source auth (poToken/OAuth) — configure only if YT blocking
  is observed; hooks are ready in `lavalink/application.yml`.

## Quality

- Test suite (none exists; `GuildPlayer` state transitions and the
  queue logic are prime candidates — the L2 smoke script was throwaway).
- CI (build + lint on push).

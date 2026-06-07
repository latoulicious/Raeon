---
title: "Raeon Wiki"
aliases:
  - "Raeon Wiki"
tags:
  - external-projects
  - personal
  - raeon
  - index
type: index
status: active
updated: 2026-06-07
---

# Raeon Wiki

This wiki captures project memory for Raeon, a standalone Discord music
bot. Treat implementation as the source of truth when this documentation
drifts. Raeon is unrelated to LazyScan and its detached services — sibling
repos are convention precedent only.

Current state:

- TypeScript (ESM) bot on discord.js v14; 14 slash commands registered
  globally (or per-guild in dev mode).
- Audio: a Lavalink v4 node (Docker, youtube-source plugin) resolves
  and streams everything, driven through Shoukaku
  (`infrastructure/lavalink.ts`). The bot keeps queueing, command UX,
  and Discord session state — no audio bytes, no binaries.
- Optional PostgreSQL log sink (`logs` table, auto-created). No business
  data in the database, no migration system.
- Docker: multi-stage `node:24-alpine` image + compose stack
  (bot + lavalink + postgres), e2e-verified 2026-06-07. Open findings:
  F-8 only.
- No test suite.

Start here:

- [Architecture](architecture.md)
- [Running](running.md)
- [Known Constraints](known-constraints.md)
- [Stabilization Plan](stabilization-plan.md)
- [Lavalink Migration Plan](lavalink-plan.md)
- [Embed UX Refresh Plan](ux-refresh-plan.md)
- [Persistent Queue & Playlist Plan](persistent-queue-plan.md)
- [Implementation Tracker](implementation-tracker.md)
- [Nice-to-have / Known Gaps](nice-to-have.md)
- [Approved To Implement](approved-to-implement.md)
- [Deferred Notes / Historical Context](deferred-notes.md)
- [Findings](findings.md)
- [Resolutions](resolutions.md)

`implementation-tracker.md` is a current implementation snapshot. Track
unreviewed future work in [nice-to-have.md](nice-to-have.md), move
user-approved work to [approved-to-implement.md](approved-to-implement.md),
and keep historical caveats in [deferred-notes.md](deferred-notes.md).

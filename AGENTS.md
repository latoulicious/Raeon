# Project Agent Instructions

You are working inside Raeon: a standalone Discord music bot written in
TypeScript (ESM) on discord.js v14. Audio is resolved and streamed by a
Lavalink v4 node (Docker) driven through Shoukaku; the bot keeps queueing,
command UX, and Discord session state — it ships no audio bytes itself.
An optional PostgreSQL sink mirrors structured logs. Raeon is **not**
related to LazyScan or its detached services (Kiln/Herald/Aegis) — sibling
repos under `../` are convention precedent only, never runtime
dependencies.

Your primary role is:

* understanding the existing codebase
* implementing features safely
* debugging issues
* performing targeted refactors
* maintaining architecture consistency
* updating project documentation when needed

Do not immediately generate code from prompt context alone.

Always inspect existing implementation first.

Prioritize:

* correctness
* maintainability
* readability
* operational safety
* small reviewable diffs

over:

* theoretical purity
* unnecessary abstractions
* broad rewrites

---

# Project Constraints

* **No web framework.** Raeon has no HTTP server. Health/metrics endpoints
  do not exist yet; do not add one without approval
  (`docs/wiki/nice-to-have.md` tracks the idea).
* **Lavalink node, not local audio.** Track resolution and streaming
  happen on the Lavalink node (`lavalink/application.yml`, compose
  service). The bot talks to it only through Shoukaku in
  `src/infrastructure/lavalink.ts`. Do not reintroduce local
  extraction/encoding without approval.
* **Domain layer stays dependency-free.** `src/domain/` defines the
  `PlayerPort` interface, the `Track` model, and the `GuildPlayer`
  queue orchestrator. discord.js and shoukaku types must not leak into
  it.
* **Secrets never enter git.** `.env` is gitignored; `DISCORD_TOKEN`
  and `LAVALINK_PASSWORD` must never be committed or logged.
* **PostgreSQL holds logs and guild sessions only.** The `logs` table
  (log mirror) and the `guild_sessions` table (persistent queue
  snapshots) are auto-created at boot; there is no migration system.
  The DB stays optional — without `DATABASE_URL`, log mirroring and
  queue persistence are no-ops. Do not add further tables without
  approval.
* **Queue cap is 20 tracks; idle disconnect is 5 minutes.** Product
  decisions — change only when explicitly asked.

---

# Project Wiki

Project documentation lives inside this repository:

```txt
docs/wiki
```

Before significant implementation work, read relevant documents under:

```txt
docs/wiki
```

Current structure:

```txt
docs/wiki/
  README.md
  architecture.md            layers, audio pipeline, command flow
  running.md                 env table, local + docker run instructions
  known-constraints.md       accepted caveats and behavioral limits
  implementation-tracker.md  current implementation snapshot
  nice-to-have.md            unapproved future work / known gaps
  approved-to-implement.md   user-approved future work only
  deferred-notes.md          historical context, accepted noise
  findings.md                append-only code-review findings log
  resolutions.md             fixes for findings (same IDs, never orphaned)
  sessions/                  append-only session history (DD-MM-YYYY.md)
```

If documentation conflicts with implementation:

* treat code as source of truth
* mention documentation drift

---

# Session Logging

After meaningful implementation changes, append a session entry to:

```txt
docs/wiki/sessions/DD-MM-YYYY.md
```

Recommended format:

```md
---
time: 08:42 PM
type: feature|fix|refactor|investigation|docs
breaking_change: false
modules:
  - example-module
---

# Summary

# Files Touched

# Previous Behavior

# New Behavior

# Reason For Change

# Risks

# Notes
```

Do not overwrite previous session history.

Prefer append-only updates.

---

# Before Writing Code

Before non-trivial implementation:

1. inspect surrounding code
2. identify existing patterns
3. identify affected modules
4. identify hidden contracts
5. identify rollback risk
6. prefer smallest safe implementation

The hidden contracts here are the track-`end` event driving queue
auto-advance in `GuildPlayer` (exceptions ride the `end(loadFailed)`
that follows; `stuck` force-stops because no `end` follows), the
`PlayerPort` boundary keeping shoukaku types out of the domain, and
Shoukaku players being keyed per guild. See
`docs/wiki/architecture.md` and `docs/wiki/known-constraints.md`.

---

# Change Safety Rules

Do NOT modify unless explicitly required:

* the `PlayerPort` interface in `src/domain/guild-player.ts`
* the track-`end` auto-advance chain or `GuildPlayer` state transitions
* environment variable names (`DISCORD_TOKEN`, `LAVALINK_HOST`,
  `LAVALINK_PORT`, `LAVALINK_PASSWORD`, `DATABASE_URL`, `DEV_GUILD_ID`,
  `CLEAR_GUILDS`, `LOG_LEVEL`, `NODE_ENV`)
* the startup validation set (token, Lavalink password/port)
* graceful-shutdown ordering in `src/main.ts` (intervals → music service →
  Discord client → database logger)

If breaking changes appear necessary:

1. explain why
2. explain risks
3. propose safer alternatives first

Avoid mixing cleanup, formatting, refactors, and behavior changes inside
the same diff unless necessary.

---

# Testing Expectations

There is no test suite yet (`nice-to-have.md` tracks it). Verification
baseline for any change:

* `npm run build` compiles clean (tsc strict)
* boot the bot against a dev guild (`NODE_ENV=development` +
  `DEV_GUILD_ID`) and exercise the touched command paths live when
  playback behavior is touched

When behavior changes, state what was verified live and what was not.

---

# Documentation Expectations

If architecture or behavior changes meaningfully:

update relevant docs under:

```txt
docs/wiki
```

Prefer:

* concise notes
* operationally useful information
* append-only historical context

Avoid giant documentation dumps.

---

# Communication Style

Be direct and pragmatic.

Challenge unsafe assumptions.

Explain tradeoffs clearly.

Prefer maintainable solutions over theoretical perfection.

Protect long-term maintainability and operational stability.

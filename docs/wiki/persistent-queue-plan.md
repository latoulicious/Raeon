---
title: "Persistent Queue & Playlist Plan"
aliases:
  - "Raeon Persistent Queue Plan"
tags:
  - external-projects
  - personal
  - raeon
  - plan
type: plan
status: in-progress
updated: 2026-06-07
---

# Persistent Queue & Playlist Plan (Q0–Q6)

Two queue features in one plan: persistence across bot death (Q0–Q3)
and full playlist queueing (Q4–Q6). The bands are independent — either
can land first; playlist is the smaller diff.

> **Progress (2026-06-07):** Q0–Q3 shipped — Q0 `d105feb`, Q1
> `be68f77`, Q2 `f311782`, Q3 docs sync. Crash + graceful drills
> verified at Docker level; live `/resume` revive smoke tracked in
> implementation-tracker.md. One deviation: `MusicService.cleanup()`
> was split from `disconnect()` (teardown without row deletion) so
> graceful shutdown preserves sessions — the plan implied it but the
> shared code path made it an explicit change.

## Part 1 — Persistent queue (Q0–Q3)

Goal: the queue survives a bot death. Today the queue is in-memory and
dies with the process (known-constraints); a crash mid-playback loses
the current track and everything queued behind it.

Decisions taken at drafting (user, 2026-06-07):

- **Lazy restore** — on boot, persisted sessions load into memory only;
  playback waits for the next `/play` or `/resume` in that guild. No
  auto-rejoin.
- **Restart from 0:00** — the interrupted track replays from the start.
  No position tracking, so writes happen only on queue mutations.
- **Preserve on graceful shutdown too** — deploys/restarts keep the
  session; only `/stop` and the idle timeout clear it.

## Constraint change (approved in principle)

AGENTS.md: "PostgreSQL is a log sink only. No business data lives in
the database." A `guild_sessions` table is the first business table.
AGENTS.md and known-constraints.md are updated at Q3. The DB stays
**optional** — without `DATABASE_URL` persistence degrades to a no-op
(logged once at boot); the Docker stack always has postgres.

Per the standing convention: raw SQL on the existing `pg` driver, no
ORM, no migration system — `CREATE TABLE IF NOT EXISTS` at boot, same
pattern as the `logs` table.

## Target design

### Schema

```sql
CREATE TABLE IF NOT EXISTS guild_sessions (
  guild_id         VARCHAR(50) PRIMARY KEY,
  voice_channel_id VARCHAR(50) NOT NULL,
  text_channel_id  VARCHAR(50) NOT NULL,
  current_track    JSONB,
  queue            JSONB NOT NULL DEFAULT '[]',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

One row per guild, upserted whole (queue cap is 20 — rows are tiny).
`current_track`/`queue` store serialized `Track` objects; the
Lavalink `encoded` blob replays as-is.

### Write path (write-through)

- `GuildPlayer` gains an optional `onChange?: () => void` ctor callback
  (additive, same pattern as `onTrackFailed`), fired after any mutating
  operation including the internal auto-advance shift.
- `MusicService` debounces `onChange` (~1s) into an upsert snapshot of
  `[currentTrack, queue]`. Fire-and-forget — a dead DB can never block
  playback.
- Row deleted on `/stop` (user intent) and idle-timeout disconnect.
  Graceful shutdown does **not** delete — write-through means the row
  is already current, so shutdown needs no write at all.

### Restore path (lazy)

- Boot: after DB init, load all rows into a `pendingSessions` map in
  `MusicService`. Rows older than 24h are deleted instead of loaded
  (default; revisit if it annoys).
- `/play` in a guild with a pending session: restored
  `[current_track, ...queue]` enqueues first, the requested track
  appends after it. Queue-cap note: if the restore alone fills the cap,
  the new track is rejected with the normal queue-full message.
- `/resume` in a guild with a pending session and no live player:
  revives the session — joins the **requester's** current voice channel
  (not the stale saved one; needs the same voice-channel guard `/play`
  has) and starts playback from the restored queue head.
- Either revive path posts a short info embed ("Restored N tracks from
  the previous session") and consumes the pending entry.

## Phases

### Q0 — Queue store

- `infrastructure/queue-store.ts`: small `pg` Pool from `DATABASE_URL`
  (separate from `DatabaseLogger`, which stays untouched), table
  auto-create at boot, `upsert`/`load all`/`delete` with raw SQL,
  connected/no-op modes.
- Exit: build clean; manual SQL round-trip against the compose postgres
  verified.

### Q1 — Write-through persistence

- `GuildPlayer.onChange` (additive ctor param; advance chain and state
  transitions untouched).
- `MusicService`: debounced snapshot upsert; delete on `/stop` and
  idle timeout; wiring in `main.ts` (shutdown ordering untouched).
- Exit: build clean; play/skip/clear against the dev stack shows the
  row tracking the live queue; `/stop` removes it.

### Q2 — Lazy restore

- Boot load + 24h stale sweep; `pendingSessions` in `MusicService`.
- `/play` merge semantics; `/resume` revive (voice guard + restore
  embed); pending entry consumed on first revive, deleted on `/stop`
  before any revive.
- Exit: `docker kill` the bot mid-playback → `docker compose up` →
  `/resume` rejoins and replays the interrupted track from 0:00 with
  the queue intact.

### Q3 — Verify + docs

- Crash/restart drill (above) plus graceful-restart drill
  (`docker compose restart raeon-bot`).
- Docs: AGENTS.md (constraint rewrite), known-constraints.md
  (queue-in-memory entry replaced), architecture.md (store + restore
  flow), implementation-tracker.md row, README env note if any,
  session log.
- Exit: docs match; both drills pass.

## Part 2 — Full playlist queueing (Q4–Q6)

Today a playlist-resolving URL queues only the linked video plus a
"Playlists are not supported yet" field (L3 behavior). The resolver
already receives **every** playlist track from Lavalink and discards
them (`lavalink.ts` PLAYLIST branch keeps one + a count) — full
playlist support is plumbing, not new resolution work.

Decisions taken at drafting (user, 2026-06-07):

- **Pure playlist URLs only.** The whole list queues only for real
  playlist links (path `/playlist`, e.g.
  `youtube.com/playlist?list=...`). Watch URLs that merely carry a
  `&list=` param (the casually-copied case) keep today's behavior:
  queue the linked video only. `youtu.be/<id>?list=...` counts as a
  watch URL.
- **Cap stays 20, fill to cap.** Longer playlists queue the first
  tracks until the queue is full; the reply says "Queued N of M".

### Target design

- `ResolveResult` playlist variant gains the full `tracks: Track[]`
  (selected track and `playlistName` stay; `totalTracks` becomes
  `tracks.length` at the call site).
- Intent rule lives in `play.ts` next to the existing `ytsearchN:`
  normalization: identifier path contains `/playlist` → bulk, else
  single (current selection logic untouched).
- `MusicService` gains a bulk enqueue path that respects the cap and
  returns `{ queued, dropped }` — the existing single-track `play()`
  contract is untouched.
- Play embed for the bulk case: title "Queued Playlist", playlist name
  + "Queued N of M tracks" field (replaces the not-supported notice for
  pure playlist URLs; watch+list URLs keep the current notice). The
  F-13 list clamps already cover `/queue` display.
- Persistence interplay: bulk enqueue fires the same `onChange`
  write-through — nothing extra.

### Q4 — Resolver carries playlist tracks

- `ResolveResult` + `lavalink.ts` PLAYLIST branch return the full
  track array; `play.ts`/`music.service.ts` compile against the new
  shape with behavior unchanged.
- Exit: build clean; live REST check shows a pure playlist URL
  resolving with all tracks present.

### Q5 — Bulk enqueue + embeds

- Intent rule in `play.ts`; `MusicService` bulk path (cap-aware);
  "Queued N of M" embed copy.
- Exit: live dev-guild — pure playlist URL fills the queue to cap with
  honest copy; watch+list URL still queues one track + notice.

### Q6 — Verify + docs

- Smoke: playlist > 20 tracks (fill to cap), playlist ≤ cap remainder,
  watch+list single, `youtu.be` + list single, mix-list URLs
  (`selectedTrack: -1` case from L3).
- Docs: architecture.md (resolve pipeline note), known-constraints or
  nice-to-have prune, implementation-tracker.md, session log.
- Exit: docs match; smoke set passes.

## Non-goals

- Position resume (decided out — restart from 0:00).
- Auto-rejoin on boot (decided out — lazy restore).
- Queue persistence without PostgreSQL (no file fallback; no-DB mode
  simply has no persistence).
- Any change to playback semantics, the queue cap, or `PlayerPort`
  (the lazy + from-zero decisions mean the interface needs nothing
  new; playlist fill-to-cap keeps the cap at 20).
- Cap raise, playlist pagination/continuation ("queue the next 20"),
  and YouTube *mixes* as full lists (infinite/generated — they stay on
  the single-track path via the watch-URL rule).

## Risks

- `guild-player.ts` is a protected file — the change is one additive
  optional callback, same shape as U2's `onTrackFailed`; the advance
  chain is not touched.
- `/resume` gains a second meaning (revive a dead session vs unpause a
  live one). The two states are disjoint (no live player vs paused
  player), but the command copy must make the revive case obvious.
- Stale `encoded` blobs after a Lavalink major upgrade could fail to
  decode — they ride the existing `loadFailed` → advance + notify
  path, so the failure mode is graceful.
- Restored-then-rejected `/play` (cap full from restore) may surprise —
  the queue-full message already names `/clear` as the out.
- Debounced writes lose at most ~1s of mutations on a crash —
  acceptable for a music queue.
- `ResolveResult` is an internal contract but typed across three
  modules — Q4 changes its playlist shape; all consumers are
  compile-checked in the same commit.
- Bulk enqueue of a 20-track restore *plus* a 20-track playlist meets
  the cap logic in two places — the `{ queued, dropped }` return must
  be honest in both paths so the embed never overclaims.

---
title: "Architecture"
aliases:
  - "Raeon Architecture"
tags:
  - external-projects
  - personal
  - raeon
  - reference
type: reference
status: active
updated: 2026-06-07
---

# Architecture

Standalone Discord music bot. TypeScript, ESM (`"type": "module"`,
NodeNext-style `.js` import specifiers), compiled with `tsc` to `dist/`.
No HTTP server, no web framework. Audio is resolved and streamed by a
Lavalink v4 node (Docker) — the bot ships no audio bytes itself.

## Layers

```txt
src/
  main.ts                    composition root (Application class), event wiring,
                             command registration, graceful shutdown
  config/index.ts            dotenv + loadConfig (DISCORD_TOKEN, LAVALINK_*)
  domain/
    track.ts                 Track { encoded, title, author, duration, uri }
                             + ResolveResult discriminated union
    guild-player.ts          PlayerPort interface + GuildPlayer queue
                             orchestrator (cap 20, end-event auto-advance)
  application/services/
    music.service.ts         per-guild player registry, resolve proxy,
                             idle timeout, user-friendly error mapping
    ping.service.ts          trivial ping
  infrastructure/
    discord-client.ts        discord.js Client wrapper (intents: Guilds,
                             GuildMessages, GuildVoiceStates)
    command-manager.ts       REST v10 slash-command sync (global/guild/clear)
    lavalink.ts              LavalinkClient (Shoukaku wrapper): node lifecycle
                             logging, join/leave, REST resolve, and the
                             ShoukakuPlayerAdapter implementing PlayerPort
    embed.ts                 EmbedService: every user-facing embed
    logger.ts                pino singleton + in-memory metrics + DB mirror
    database-logger.ts       pg Pool sink, logs table auto-create, fire-and-forget
    queue-store.ts           guild_sessions persistence: own small pg Pool,
                             raw SQL, no-op without DATABASE_URL
    startup-validator.ts     token + Lavalink password/port checks
    timeout.ts               TimeoutService: 5-min idle disconnect, 30s sweep
  handler/
    slash.ts                 command dispatch map + error reply fallback
    message.ts               stub (bot-author guard only, no behavior)
    reaction.ts              stub (bot-user guard only, no behavior)
  commands/                  14 slash commands (one file each)
  presence/index.ts          rotating presence, 30s interval
```

The domain layer is dependency-free: `GuildPlayer` sees only the
`PlayerPort` interface and the `Track` model. discord.js and shoukaku
types must not leak into `src/domain/`; the Shoukaku adapter in
`infrastructure/lavalink.ts` implements `PlayerPort`.

## Audio pipeline

```txt
/play <url|query>
  → command: MusicService.resolve(identifier)        Lavalink REST /loadtracks
      ResolveResult: track | search | playlist | empty (LavalinkError on error)
  → MusicService.play(guildId, voiceChannelId, textChannelId, track)
      queue cap check (20) → LavalinkClient.join (Shoukaku joinVoiceChannel,
      players keyed per guild) → GuildPlayer.enqueue → start()
  → GuildPlayer.start: shift queue → PlayerPort.playTrack(encoded)
      Lavalink node decodes + streams opus to Discord voice directly
  → track `end` event → handleTrackEnd → start() next   (auto-advance)
```

Event contract (the hidden contract — see AGENTS.md):

- `end(finished | loadFailed)` → auto-advance to the next queued track.
  Fatal exceptions are followed by `end(loadFailed)`, so exceptions ride
  the same path; non-fatal exceptions leave the track playing.
  `loadFailed` (and a `stuck` force-stop) additionally fires the optional
  `onTrackFailed` callback — notification only, never affects advance.
- `end(stopped)` after `stop()` → `suppressAdvance` halts with the queue
  intact; after `skip()` → advances.
- `stuck` → no `end` follows, so the orchestrator force-stops the track
  (which produces the `end` that advances).
- `replaced` / `cleanup` → no advance.

`GuildPlayer` states: `IDLE → PLAYING ⇄ PAUSED`. Pause/resume are native
Lavalink `setPaused` — position is preserved. No per-track timeout.

### Queue persistence (Q0–Q3, 2026-06-07)

Write-through: `GuildPlayer`'s optional `onChange` callback fires after
every queue/current-track mutation (including the auto-advance shift);
`MusicService` debounces it (~1s per guild) into a whole-row upsert of
`[currentTrack, queue]` to the `guild_sessions` table via
`QueueStore` (own small pg Pool, raw SQL, table auto-created at boot —
no-op without `DATABASE_URL`). Writes are fire-and-forget; a dead DB
never blocks playback.

Restore is lazy: boot stages persisted rows into a `pendingSessions`
map (rows >24h old or empty are deleted instead); no auto-rejoin. The
next `/play` in that guild enqueues the restored tracks first and the
requested track after them; `/resume` with no live player revives the
session into the requester's current voice channel. Both paths post a
"Session Restored" info embed, replay the interrupted track from 0:00
(no position tracking), and consume the pending entry. `/stop` and the
idle timeout delete the row; graceful shutdown flushes pending
snapshots and preserves it (`cleanup()` tears players down without
deleting sessions).

Playlist URLs resolve to a single track: `selectedTrack` if set, else
the `v=` param match, else the playlist head (`/play` sends an info
notice; full playlist support is a non-goal).

## Commands

`ping, play, stop, skip, queue, clear, commands, search, nowplaying,
pause, resume, shuffle, remove, prune` — wired in `main.ts` into a
`Map<string, SlashCommand>`, dispatched by `handler/slash.ts`.

`/play` accepts URLs and bare queries (`ytsearch:` prefix; the legacy
`ytsearchN:` count syntax is normalized). `/skip` advances via the end
event; `/stop` disconnects. Embeds show `Track` metadata (title, author,
duration) resolved at load time.

`/resume` has two disjoint meanings: with a paused live player it
unpauses; with no live player and a pending persisted session it
revives that session (see queue persistence above).

### Embed and error conventions (UX refresh U0–U2, 2026-06-07)

- **Palette** lives once in `EmbedService.COLORS` (ACCENT `#5865F2`,
  SUCCESS `#57F287`, ERROR `#ED4245`, WARNING `#FEE75C`, INFO
  `#3498DB`). No one-off hex codes in helpers.
- **Status icons** are prefixed only by the
  `createSuccessEmbed`/`createErrorEmbed`/`createInfoEmbed` helpers;
  descriptions passed in never carry their own (the double-emoji bug
  class is structurally dead).
- **Track lines** come from the shared `formatTrackLine`
  (`[title](uri) — author (duration)`, title/author truncated); track
  lists go through `formatTrackList`, char-budgeted against Discord's
  limits (field value 1024, description 4096) so long queues can't
  break embed validation.
- **Guard failures** (not-in-guild, no voice channel, wrong channel
  type) reply *before* the defer as ephemeral error embeds
  (`MessageFlags.Ephemeral`); the public defer happens only after
  guards pass. The deprecated `ephemeral` option is not used.
- **`MusicServiceError.userFriendlyMessage`** is a plain sentence — the
  embed layer owns all presentation. Raw error messages never reach the
  channel (logs only).
- **Playback-failure notify**: `GuildPlayer.onTrackFailed` →
  `MusicService.notifyTrackFailure` (throttled 30s per guild,
  fire-and-forget) → `main.ts` sends an error embed to the guild's last
  text channel. A dead channel cannot break queue advancement.

Registration (`main.ts → CommandManager`):

- `NODE_ENV=development` + `DEV_GUILD_ID` set → sync to that guild and
  clear global commands.
- otherwise → sync globally.
- `CLEAR_GUILDS=true` → wipe guild-scoped commands from every guild first.

## Logging and metrics

`AppLogger` (singleton) wraps pino. `getLogger(module)` returns a child
logger whose `info/warn/error/debug` are monkey-patched to also mirror
into PostgreSQL when `DATABASE_URL` is set (fire-and-forget; silently
dropped when the DB is down). In-memory counters
(`total_commands`, `active_players`, `track_load_failures`,
`player_errors`) are logged every 5 minutes. Nothing is exported —
no Prometheus, no HTTP.

Database: single `logs` table auto-created at boot by
`DatabaseLogger.createLogsTable()`. No migration system.

## Lifecycle

Boot (`bootstrap()` in `main.ts`):

1. `appLogger.initializeDatabaseLogger()` (soft — warns and continues
   without `DATABASE_URL`)
2. `loadConfig()` → startup validation (token length, Lavalink
   password/port) — hard fail
3. construct Application — `LavalinkClient` before login so the
   Shoukaku connector hooks gateway events; node WS connects after the
   Discord client is ready
4. `queueStore.init()` (guild_sessions auto-create; no-op warning
   without `DATABASE_URL`) → `musicService.loadPendingSessions()`
   (stale/empty rows swept, rest staged for lazy restore)
5. `client.login`, register slash commands, start presence (30s) and
   metrics (5 min) intervals

Shutdown (SIGINT/SIGTERM/unhandledRejection/uncaughtException, 10s force
exit): clear intervals → `musicService.cleanup()` (flush pending
snapshots, tear down all guilds *without* deleting their sessions) →
destroy Discord client → close DB pool → close queue store pool.

## Deployment

Multi-stage `node:24-alpine` Dockerfile (builder: `npm ci` → `tsc` →
`npm ci --omit=dev`; runtime: `package.json` + prod `node_modules` +
`dist/`, non-root `node` user, no exposed ports). Compose runs
`raeon-bot` + `lavalink` (ghcr v4, youtube-source plugin) + `postgres`;
the bot is gated on both services' healthchecks and receives in-stack
`LAVALINK_HOST`/`DATABASE_URL` via compose `environment`. See
[running.md](running.md) and `docs/DOCKER.md`.

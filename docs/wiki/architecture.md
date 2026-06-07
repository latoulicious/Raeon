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
No HTTP server, no web framework.

## Layers

```txt
src/
  main.ts                    composition root (Application class), event wiring,
                             command registration, graceful shutdown
  config/index.ts            dotenv + loadConfig (DISCORD_TOKEN, YTDLP_COOKIES_PATH)
  domain/
    audio.ts                 AudioExtractor / AudioEncoder / VoiceGateway interfaces
    guild-player.ts          per-guild playback state machine + queue
  application/services/
    music.service.ts         per-guild player registry, queue cap, idle timeout,
                             user-friendly error mapping
    ping.service.ts          trivial ping
  infrastructure/
    discord-client.ts        discord.js Client wrapper (intents: Guilds,
                             GuildMessages, GuildVoiceStates)
    command-manager.ts       REST v10 slash-command sync (global/guild/clear)
    yt-dlp.ts                YtdlpExtractor: stream(url) + search(query, limit)
    ffmpeg.ts                FfmpegEncoder: stdin → opus 48kHz stereo 128k → stdout
    voice-gateway.ts         @discordjs/voice join/play/disconnect
    embed.ts                 EmbedService: every user-facing embed
    logger.ts                pino singleton + in-memory metrics + DB mirror
    database-logger.ts       pg Pool sink, logs table auto-create, fire-and-forget
    startup-validator.ts     token / cookies file / yt-dlp / ffmpeg checks
    timeout.ts               TimeoutService: 5-min idle disconnect, 30s sweep
  handler/
    slash.ts                 command dispatch map + error reply fallback
    message.ts               stub (bot-author guard only, no behavior)
    reaction.ts              stub (bot-user guard only, no behavior)
  commands/                  14 slash commands (one file each)
  presence/index.ts          rotating presence, 30s interval
```

The domain layer is dependency-free: `GuildPlayer` only sees the three
interfaces from `audio.ts`. Infrastructure implements them.

## Audio pipeline

```txt
/play url
  → MusicService.play(guildId, voiceChannelId, textChannelId, url)
      queue cap check (20) → VoiceGateway.join → GuildPlayer.enqueue → start()
  → GuildPlayer loop: shift queue → playTrack(url, signal)
      YtdlpExtractor.stream(url)   spawn yt-dlp --format bestaudio -o -
      FfmpegEncoder.encode(...)    spawn ffmpeg → opus/48k/2ch/128k
      VoiceGateway.play(stream)    createAudioResource → player.play
                                   resolves on AudioPlayerStatus.Idle
```

Abort chain: one `AbortController` per playback run. `stop()`/`pause()`
abort the signal → listeners SIGTERM the yt-dlp and ffmpeg processes →
voice player goes Idle → loop exits. Skip is implemented as `stop()` (see
known-constraints: no auto-advance).

`GuildPlayer` states: `IDLE → PLAYING ⇄ PAUSED`, `STOPPING` transient.
The queue holds raw URL strings only — no track metadata is stored;
titles are fetched ad hoc (presence spawns `yt-dlp --get-title`).

## Commands

`ping, play, stop, skip, queue, clear, commands, search, nowplaying,
pause, resume, shuffle, remove, prune` — wired in `main.ts` into a
`Map<string, SlashCommand>`, dispatched by `handler/slash.ts`.

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
(`total_commands`, `active_players`, `stream_failures`, `yt_dlp_failures`,
`ffmpeg_failures`) are logged every 5 minutes. Nothing is exported —
no Prometheus, no HTTP.

Database: single `logs` table auto-created at boot by
`DatabaseLogger.createLogsTable()`. No migration system.

## Lifecycle

Boot (`bootstrap()` in `main.ts`):

1. `appLogger.initializeDatabaseLogger()` (soft — warns and continues
   without `DATABASE_URL`)
2. `loadConfig()` → startup validation (token length, cookies file
   readable, `yt-dlp --version`, `ffmpeg -version`) — hard fail
3. construct Application, wire events, `client.login`
4. register slash commands, start presence (30s) and metrics (5 min)
   intervals

Shutdown (SIGINT/SIGTERM/unhandledRejection/uncaughtException, 10s force
exit): clear intervals → `musicService.cleanup()` (disconnect all guilds)
→ destroy Discord client → close DB pool.

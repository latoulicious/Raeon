---
title: "Embed UX Refresh Plan"
aliases:
  - "Raeon UX Refresh Plan"
tags:
  - external-projects
  - personal
  - raeon
  - plan
type: plan
status: draft
updated: 2026-06-07
---

# Embed UX Refresh Plan (U0–U3)

Goal: modernize every user-facing embed and harden the command error
paths. Presentation and error-reply changes only — no playback,
queueing, or command-surface behavior changes.

Trigger (user, 2026-06-07, with live screenshot): duplicated emoji in
the play embed ("✅✅ Song added to queue!"), dated emoji-dense layout,
red search embed, noisy per-result `/play <url>` codeblocks, separate
playlist-notice message.

## Audit — what's wrong today

### Design (`infrastructure/embed.ts`)

- **Double-emoji bug (the screenshot).** `createPlayEmbed`,
  `createSkipEmbed`, `createPauseEmbed`, `createResumeEmbed` write a
  status emoji into their description, then route through
  `createSuccessEmbed`, which prepends another `✅`. Play shows "✅ ✅",
  pause shows "✅ ⏸️", etc. Same pattern at the error layer:
  `MusicServiceError.userFriendlyMessage` carries its own `🎵`/`🔊`/`❌`
  prefix and `createErrorEmbed` prepends `❌` again.
- **Color chaos.** Neon `#00FF00` success, `#FF0000` search (reads as
  error), one-off hardcoded colors in remove (`#E74C3C`) and shuffle
  (`#9B59B6`), Spotify-green primary. No coherent palette.
- **Search embed wall.** One field per result with "Click to play" link
  + raw `/play <uri>` codeblock × 10; footer suggests the legacy
  `ytsearch1:"..."` syntax.
- **Generic/wrong titles.** Play says "Music Player"; the
  nothing-playing embed is titled "Now Playing" with error color.
- **Playlist notice is a second message** instead of a line/field on
  the play reply.
- **Ping embed** has a redundant Timestamp field (embeds already carry
  a timestamp) and a "Pong! 🏓" title.
- **Bot-avatar thumbnails** on generic embeds where track art (or
  nothing) would be cleaner.
- **Dead code:** `createYouTubeThumbnail`, `createShortYouTubeUrl`
  (no callers); `EMojis` constant casing.

### Error handling (commands + handler)

- **Plain-text guard replies** ("This command can only be used in a
  server!", "You must be in a voice channel…") — 13 occurrences, not
  embeds, not ephemeral, sent after a public defer.
- **`handler/slash.ts` fallback**: dead conditional (both branches
  identical), plain text, deprecated `ephemeral` option instead of
  flags.
- **Raw error leak**: `play.ts` catch sends `error.message` verbatim
  to the channel for non-`MusicServiceError` errors.
- **Brittle mapping**: `handleServiceError` matches
  `error.message.includes('voice')`.
- **Silent mid-queue failures**: `handlePlaybackError` only logs +
  increments a metric — the text channel is never told when a track
  dies and the queue advances (the idle-timeout notify path already
  exists and can be reused).

## Phases

### U0 — Embed design system

- One palette: accent (brand), success, error, warning, info — defined
  once, no hardcoded one-off colors in helpers.
- One emoji policy: the status icon comes from the
  success/error/info/warning helper only; descriptions never carry
  their own. Kills the double-emoji bug class structurally.
- Shared track-line formatter (title link — author, duration) used by
  play/queue/nowplaying/search.
- Footer convention: requester + avatar everywhere a user triggered it.
- Drop dead helpers; fix `EMojis` casing.
- Exit: build clean; no helper prepends onto a description that
  already has an icon (grep-verifiable).

### U1 — Per-command embed refresh

- `/play`: title "Queued" / "Now Playing" (not "Music Player"), track
  art thumbnail, queue position field; playlist notice becomes a field
  on the same reply (one message, not two).
- `/search`: neutral/info color, results as a compact numbered
  description list (no per-result fields, no `/play <url>` codeblocks,
  no legacy `ytsearch1:` footer tip).
- `/queue`, `/nowplaying`: keep the structure, align colors/footers;
  nothing-playing embed gets an honest title.
- `/ping`: drop the redundant timestamp field.
- `/skip`, `/pause`, `/resume`, `/stop`, `/clear`, `/remove`,
  `/shuffle`, `/commands`: align to the system (single icon, palette
  colors, consistent footers).
- Exit: live dev-guild screenshot pass over every command; no embed
  shows a doubled icon or off-palette color.

### U2 — Error-path hardening

- Guard replies become ephemeral error embeds (`MessageFlags.Ephemeral`
  on the defer where the command can fail guards; plain `ephemeral`
  option is deprecated).
- `handler/slash.ts`: dedupe the fallback, reply with an error embed,
  flags instead of `ephemeral`.
- `play.ts`: stop leaking raw `error.message`; unknown errors get the
  generic friendly message (the raw error stays in logs).
- `MusicServiceError.userFriendlyMessage`: plain sentences, no
  emoji/markdown prefixes (the embed layer owns presentation).
- Playback-failure notify: `MusicService.handlePlaybackError` pushes a
  short error embed to the guild's last text channel (reuses the
  timeout-notification callback wiring in `main.ts`); throttled to
  avoid spam on cascading failures.
- Exit: build clean; live checks — guard reply is ephemeral, a dead
  track posts one error embed and the queue advances.

### U3 — Verify + docs

- Dev-guild smoke over all 14 commands (combined with the open L6
  checklist).
- Wiki: architecture.md (embed/error conventions note),
  implementation-tracker.md rows, session log.
- Exit: docs match; screenshot set captured.

## Non-goals

- Buttons/components (skip/pause controls under now-playing) and
  Components V2 layouts — separate candidate, see nice-to-have.
- Per-user permission/DJ-role checks on playback commands (today any
  member can skip/stop; noted as a candidate, not in scope).
- Any change to MusicService/GuildPlayer playback semantics.

## Risks

- `MessageFlags.Ephemeral` on deferred replies changes reply
  visibility for guard failures — intended, but users who relied on
  public errors will notice.
- Playback-failure notify adds a channel send on the error path —
  must be throttled and fire-and-forget so a dead channel can't break
  advancement.
- Embed copy changes are user-visible everywhere at once; rollback is
  one revert per phase (one commit per phase, as before).

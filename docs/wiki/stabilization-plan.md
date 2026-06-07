---
title: "Stabilization Plan"
aliases:
  - "Raeon Stabilization Plan"
tags:
  - external-projects
  - personal
  - raeon
  - plan
type: plan
status: active
updated: 2026-06-07
---

# Stabilization Plan (R0–R6)

Goal: dependable builds and runs — current dependencies, one Node story,
a Docker image that actually builds, and a compose file without dead
mounts. Resolves findings **F-1, F-2 (by removal), F-3, F-4, F-5 (done),
F-9** from [findings.md](findings.md).

**Status (2026-06-07): R0–R3 done** (`3bc5e93`, `a7d035f`, `4c60d6d`).
**R4/R5 deferred** (user decision 2026-06-07): yt-dlp/ffmpeg will be
replaced by something else (no spec yet); the Docker refactor waits for
that plan so the image isn't built twice. F-1/F-2/F-3/F-9 stay open
until then; F-4 is half-closed (engines + README on Node 24, Dockerfile
still node:18). R0 deviations: local machine deliberately has no
yt-dlp/ffmpeg/.env/cookies — baseline and all verification this round
were build-level plus a pino-10 logger runtime smoke, not a bot boot.
R3 deviation: TypeScript 6.0 is out; stayed on latest 5.x (5.9.3) per
plan. New accepted finding F-10 (tar advisory chain) logged during R0.

Scope decisions (user, 2026-06-07):

- **Node 24** is the single target (engines, README, Docker base image).
  Node 18 is EOL; local dev machine runs v24.16.0.
- **Deps + Docker only.** Playback behavior fixes (F-6 skip
  no-auto-advance, F-7 300s track timeout) are explicitly out of scope —
  they stay in [nice-to-have.md](nice-to-have.md) for a separate plan.

Non-goals: playback behavior changes, log retention wiring (F-8), health
endpoint, tests/CI, new features, business DB tables.

Rollback model: one commit per phase, rollback is `git revert` of that
phase's commit. No feature flags.

## Dependency snapshot (npm outdated, 2026-06-07)

| Package | Pinned range | Wanted (in-range) | Latest | Jump |
| --- | --- | --- | --- | --- |
| discord.js | ^14.14.1 | 14.26.4 | 14.26.4 | minor (R1) |
| @discordjs/voice | ^0.19.0 | 0.19.2 | 0.19.2 | patch (R1) |
| @discordjs/opus | ^0.10.0 | 0.10.0 | 0.10.0 | current |
| @snazzah/davey | ^0.1.9 | 0.1.11 | 0.1.11 | patch (R1) |
| dotenv | ^17.3.1 | 17.4.2 | 17.4.2 | patch (R1) |
| pg | ^8.18.0 | 8.21.0 | 8.21.0 | minor (R1) |
| libsodium-wrappers | ^0.8.2 | 0.8.4 | 0.8.4 | patch (R1) |
| sodium-native | ^5.0.10 | 5.1.0 | 5.1.0 | minor (R1) |
| pino | ^8.17.2 | 8.21.0 | **10.3.1** | major ×2 (R3) |
| pino-pretty | ^13.1.3 | 13.1.3 | 13.1.3 | current — verify pino-10 compat at R3 |
| @types/pg | ^8.16.0 (in deps!) | 8.20.0 | 8.20.0 | move to devDeps (R1) |
| typescript / @types/node | ^5.3.3 / ^20 | — | check at R3 | major-ish (R3) |

`node_modules` is not currently installed — R0 establishes the baseline
before anything is touched.

## Phases

### R0 — Baseline

- `npm install` (or `npm ci` if the lockfile resolves clean), then
  `npm run build`.
- Boot against the dev guild (`NODE_ENV=development` + `DEV_GUILD_ID`),
  exercise `/ping` and a short `/play`.
- Record what is green/red in the session log. **No code changes.**
- Exit: build clean + bot boots, baseline documented.

### R1 — In-range dependency updates

- `npm update`: discord.js → 14.26.4, @discordjs/voice → 0.19.2,
  davey → 0.1.11, dotenv → 17.4.2, pg → 8.21.0, libsodium-wrappers →
  0.8.4, sodium-native → 5.1.0, pino → 8.21.0 (stays v8 here).
- Move `@types/pg` from dependencies to devDependencies.
- Exit: build clean, boot + `/ping` + `/play` smoke pass.
- Risk: discord.js 14.14 → 14.26 is a wide minor span; watch deprecation
  warnings (e.g. ephemeral reply options) at boot and in command paths.

### R2 — Node 24 story (manifests/docs)

- `package.json` engines → `>=24`.
- `README.md` prerequisites → Node 24+ (currently says 21+; F-4).
- Dockerfile base bump intentionally deferred to R4 so all Docker changes
  land as one reviewable diff.
- Exit: docs/manifests agree on Node 24; F-4 closes when R4 lands.

### R3 — Major dependency bumps

- pino 8 → 10. Audit `infrastructure/logger.ts` first: the child-logger
  method monkey-patching and `transport: pino-pretty` config must survive;
  verify pino-pretty 13 is compatible with pino 10 (check release notes —
  if not, hold pino at 9.x and note it here).
- typescript → latest 5.x, @types/node → 24, @types/sodium-native refresh.
- tsconfig modernization in the same phase (compiler-only, no runtime
  effect): `module`/`moduleResolution` → `NodeNext` (matches the existing
  `.js` ESM specifiers), `target` → ES2023.
- Exit: build clean under new TS, boot with `DATABASE_URL` set and confirm
  log rows still land in `logs` (the monkey-patch is the regression risk).

### R4 — Dockerfile refactor (resolves F-1, F-2*, F-9)

Multi-stage build on `node:24-alpine`:

- **builder**: apk build toolchain (`make g++ python3` for native modules:
  @discordjs/opus, sodium-native), `npm ci` (full, with devDeps),
  copy `src/` + `tsconfig.json`, `npm run build`, then
  `npm ci --omit=dev` to produce the production `node_modules`.
- **runtime**: `apk add --no-cache ffmpeg yt-dlp libstdc++`, copy `dist/`
  + production `node_modules` from builder, non-root user (kept),
  `CMD ["node", "dist/main.js"]`.
- yt-dlp via apk (alpine community repo) instead of pip — newer alpine
  blocks global pip (PEP 668). If the apk version proves too old for
  YouTube, fall back to downloading the static binary release.
- Drop: `EXPOSE 3000` (F-9, no HTTP server), `sqlite` + `curl` apk
  packages (nothing uses them), and the `HEALTHCHECK` line — the
  `--health-check` flag was never implemented (F-2); a real healthcheck
  needs a health endpoint, which stays in nice-to-have. Removing the fake
  check is the F-2 resolution for now.
- Exit: `docker build .` succeeds (F-1), container boots with a valid
  `.env` + cookies file.

### R5 — Compose fixes (resolves F-3)

- Remove the `./init.sql` mount — the file never existed; the `logs`
  table is auto-created at boot by `DatabaseLogger`.
- Keep the `./cookies.txt` mount but document in `running.md` that the
  file must exist before `docker-compose up` (missing host path → Docker
  creates a directory and yt-dlp breaks).
- Remove the bot service's fake healthcheck (same reasoning as R4);
  keep `pg_isready` on postgres and gate the bot with
  `depends_on.condition: service_healthy`.
- Drop the obsolete `version: '3.8'` top-level key.
- Exit: `docker-compose config` clean, `docker-compose up -d` brings up
  postgres healthy → bot boots (logs show startup validation passing).

### R6 — Verification + docs sync

- In-container smoke: `/ping`, short `/play`, idle disconnect.
- Wiki sync: close F-1, F-2, F-3, F-4, F-9 in
  [resolutions.md](resolutions.md); update
  [implementation-tracker.md](implementation-tracker.md) (Docker →
  done, deps current), [running.md](running.md) (Node 24, compose
  caveat removal), [known-constraints.md](known-constraints.md) if any
  constraint shifted; prune the shipped items from
  [nice-to-have.md](nice-to-have.md).
- Append session log entry.
- Exit: docs match implementation; only intended findings remain open
  (F-6, F-7, F-8).

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
`4c60d6d`). **R4/R5/R6 deferred** pending the user's yt-dlp/ffmpeg
replacement plan — Docker refactor would otherwise be built twice.
Approval stands; execution resumes when the replacement is specced.

# Last Orbit Changelog

## v1.17.8 — reward icon sizing + corner cleanup

- Fixed material reward icons in offline/boss reports inheriting the reward-label flex rule and stretching across the row.
- Locked material reward artwork to a fixed square slot so ore/bar icons match the other reward icons.
- Removed the bright cyan corner-bracket accents from all normalized runtime icon slices while preserving the central pixel art and dark tile frame.
- Kept the source/reference atlas unchanged; runtime continues to use individual slices with visible glyph fallback on load failure.
- Save schema remains 12 and onboarding schema remains 5.

## v1.17.7 — icon rendering recovery

- Switched runtime pixel-art icons from shared CSS atlas offsets to the packaged normalized slice PNGs.
- Prevented a single atlas load failure from blanking all game icons.
- Added a visible glyph fallback for an individual slice load failure.
- Strengthened icon regression coverage for runtime slice paths.
- Preserved v1.17.6 click-through interaction hardening and save/onboarding schemas.

## Unreleased — agent documentation/tooling pass

- Added a Cromwell-style agent entrypoint (`AGENTS.md`), routing index (`AI_INDEX.md`) and subsystem ownership map (`CODEMAP.md`).
- Added architecture, current-state, gameplay-system, balance, save/offline, UI/rendering and release-workflow documentation.
- Added `tools/agent_context.py` for task-based context routing.
- Added `tools/run_release_gates.py` for one-command syntax + regression validation.
- Added the previously referenced but missing `docs/BALANCING.md`.
- Established the existing v1.17.6 source as the documented baseline; no gameplay behavior or save schema changed in this documentation/tooling pass.

## v1.17.6 — interaction recovery / click-through hardening

- Restored reliable clicking after the v1.17.5 interaction regression.
- Decorative icon/material artwork is explicitly click-through.
- Closed modal backdrop no longer owns pointer input; open modal does.
- Modal inert/background tracking self-recovers and always releases interaction on close.
- Added source-level interaction regressions alongside the existing gameplay/UI suites.

For release-specific details, see `BUILD_NOTES.md`.
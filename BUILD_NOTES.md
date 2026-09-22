# Last Orbit v1.17.7

Built from v1.17.6. Save schema remains **12** and onboarding schema remains **5**.

## Icon rendering recovery
- Fixed the observed failure mode where the pixel-art game icons could all disappear together.
- The packaged atlas and mappings in v1.17.6 were intact, but runtime rendering depended on one shared CSS atlas image and background-position offsets. A failed/blocked atlas request could therefore leave every mapped icon blank at once.
- Runtime game icons now use the already-packaged normalized per-icon PNG slices. This also removes sprite-offset alignment drift.
- If an individual icon asset cannot load, that icon now degrades to its visible text glyph instead of silently rendering an empty slot.
- Decorative icon wrappers/images remain click-through, preserving the v1.17.6 interaction fix.

## Verification
- Strengthened `tests/icon-atlas-regression.mjs` to validate every runtime slice path and the generated image element path.
- Focused icon regression passes.
- Full release gate passes.
- Second-pass source/package review completed with version/docs synchronized.

## Run source build
Serve this directory over HTTP (for example, `python3 -m http.server 8000`) and open `index.html`.

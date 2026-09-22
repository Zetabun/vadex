# Last Orbit v1.17.8

Built from v1.17.7. Save schema remains **12** and onboarding schema remains **5**.

## Offline / reward icon sizing
- Fixed the offline report material rows where the icon wrapper was a `<span>` and accidentally inherited `.gain span { flex: 1 }`.
- Reward labels now target only non-icon spans, and direct material icons are explicitly fixed to a 30px square flex slot.
- The same rule also protects boss-loot material rows because they share the `.gain` component.

## Runtime icon cleanup
- Removed the bright cyan corner-bracket accents from all 64 normalized runtime icon slices.
- Central pixel artwork and the dark navy tile/frame remain intact.
- `icon-atlas.png` remains the untouched source/reference atlas; runtime still loads the individual named slices.

## Verification
- Added a regression assertion for fixed-size material reward icons so the stretch bug cannot silently return.
- Focused icon/UI/offline regressions pass.
- Full release gate passes.
- Second-pass source/package review completed with version/docs synchronized.

## Run source build
Serve this directory over HTTP (for example, `python3 -m http.server 8000`) and open `index.html`.
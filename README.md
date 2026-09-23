# Last Orbit

Last Orbit is a browser orbital-defence and incremental game. The live page is [zetabun.github.io/vadex](https://zetabun.github.io/vadex/).

## Source layout

`index.html` contains the page shell and CSS. Its import map points to the readable ES modules in `modules/`. The pixel artwork is embedded in `modules/ui/icons.js`, so the published page does not need a separate asset directory. GitHub Pages serves the repository root from `main`.

## Run locally

From the repository root, start a static server and open its URL:

```bash
python -m http.server 8000
```

Three.js and fonts load from CDNs. The game needs a network connection for its normal visual build. The Upgrades view uses a mobile ship-console layout while keeping the live battle visible.

## Test

```bash
python tools/run_release_gates.py
```

The gate checks every module's syntax and runs skill, industry and UI progression regression tests, including drone fitting, passage gating, weapon DPS and save migration. Current gameplay build: **v1.21.0**; save schema **14**; onboarding schema **6**.

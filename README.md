# Last Orbit

Last Orbit is a browser-based orbital defence / incremental action game built as native ES modules with a Three.js battlefield, persistent progression, offline simulation and an RPG-style ship loadout.

Current gameplay build: **v1.17.8**.

## Run locally

Serve the repository root over HTTP and open the shown local URL:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` in a browser. Opening `index.html` directly with `file://` is not the supported development path because the game uses ES modules/import maps.

Three.js and Google Fonts are loaded from the network by `index.html`, so an online connection is currently expected for the normal visual build.

## Agent entry point

AI/code agents must start with:

1. [`AGENTS.md`](AGENTS.md)
2. [`AI_INDEX.md`](AI_INDEX.md)
3. [`CODEMAP.md`](CODEMAP.md) only as needed by the routed task

A compact route helper is available:

```bash
python3 tools/agent_context.py --list
python3 tools/agent_context.py ui
```

## Validation

```bash
python3 tools/run_release_gates.py
```

See [`TESTING.md`](TESTING.md) for the regression matrix and [`docs/AGENT_RELEASE_WORKFLOW.md`](docs/AGENT_RELEASE_WORKFLOW.md) for the full change/release workflow.

## Documentation

[`AI_INDEX.md`](AI_INDEX.md) is the canonical documentation index. The deeper docs intentionally stay split by concern so agents can load relevant context without flooding their working context.
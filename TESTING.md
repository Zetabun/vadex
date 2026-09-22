# Testing

Run `python tools/run_release_gates.py` from the repository root. It checks all 76 JavaScript modules with `node --check`, then runs `tests/skills-regression.mjs` through the alias loader. That regression covers points, branch prerequisites, stat effects, lifesteal, free respec, and migration of an active schema 12 tutorial.

For browser verification, serve the root over HTTP. Confirm the page boots, Loadout opens across the viewport, empty slots have no icons, Back to game returns to combat, Wave 8 unlocks Skills, and buying a rank updates available points. Use `?debug=1` only in its isolated sandbox when accelerating progression.

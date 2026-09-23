# Build notes — v1.18.0

Published from `main` as a static GitHub Pages site. `index.html` imports the 76 readable modules under `modules/`; its import map uses a release version query so browsers pick up changed modules after deployment. The old inline base64 bundle is no longer the deployed source of truth. Existing saves migrate from schema 12 to 13. New runs learn Skills after the Wave 8 unlock; completed older tutorials stay completed. Run Skills reset with Ship XP on Rewind. The test gate is `python tools/run_release_gates.py`.

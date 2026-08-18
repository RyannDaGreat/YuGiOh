#!/usr/bin/env bash
# Builds the static (GitHub Pages) flavour of the web UI into web/build/.
# The Node flavour is just `cd web && npm run build`; see web/vite.config.js.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# The in-browser AI player reads PLAYER.md the way the CLI does. Static hosting has
# no repo to read from, so the file rides along as a static asset (gitignored — it
# is a build product, the source of truth stays at the repo root).
cp PLAYER.md web/static/PLAYER.md

cd web
VITE_STATIC=1 npx vite build

# GitHub Pages: no Jekyll processing, and the site root must answer 200 — the
# fallback page IS the app shell, so it serves as index.html too.
touch build/.nojekyll
cp build/404.html build/index.html
echo "static build -> web/build ($(du -sh build | cut -f1))"

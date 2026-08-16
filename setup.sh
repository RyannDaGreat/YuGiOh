#!/usr/bin/env bash
# Recreates every external dependency of this dump from scratch.
# Idempotent: safe to re-run. All paths are relative to the repo root.
#
# Requires: git, node >= 22.13 (for the built-in node:sqlite module), npm.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Project Ignis card data. Pinned so the Lua scripts, the card database, and the
# ocgcore version in package.json stay a known-good triple. Bump deliberately.
CARDSCRIPTS_REPO=https://github.com/ProjectIgnis/CardScripts.git
CARDSCRIPTS_COMMIT=9a5738639924bbbf3b86c4599f3f7e70ea8711a6
BABELCDB_REPO=https://github.com/ProjectIgnis/BabelCDB.git
BABELCDB_COMMIT=172462f1e7405c7544cc256471d3310df6e6b7c3

# Command. Clones a repo at an exact commit into vendor/, or fast-forwards an
# existing checkout to that commit.
fetch_pinned() {
  local repo="$1" commit="$2" dest="$3"
  if [ ! -d "$dest/.git" ]; then
    git clone --progress "$repo" "$dest"
  fi
  git -C "$dest" fetch --progress origin "$commit"
  git -C "$dest" checkout --quiet "$commit"
  echo "$dest @ $(git -C "$dest" rev-parse --short HEAD)"
}

# EDOPro's system strings (selection prompts, phase names, victory reasons).
# Single file, so fetched raw rather than cloning the whole Distribution repo.
DISTRIBUTION_COMMIT=54a6e2395c532648ff762540e9615319fac4f51b
STRINGS_URL="https://raw.githubusercontent.com/ProjectIgnis/Distribution/$DISTRIBUTION_COMMIT/config/strings.conf"

mkdir -p vendor
fetch_pinned "$CARDSCRIPTS_REPO" "$CARDSCRIPTS_COMMIT" vendor/CardScripts
fetch_pinned "$BABELCDB_REPO"    "$BABELCDB_COMMIT"    vendor/BabelCDB
curl -fSL --progress-bar "$STRINGS_URL" -o vendor/strings.conf
echo "vendor/strings.conf $(wc -l < vendor/strings.conf) lines"

npm install

# Greppable card list for agents: one line per card with full effect text.
node bin/ygo.js dump-cards

# Card art for the web UI (cached locally; only the decks/duels present).
node bin/ygo.js fetch-pics

# Web UI (SvelteKit) — a client of the same engine; optional for CLI-only use.
(cd web && npm install)

echo "setup complete"
echo "CLI:    node bin/ygo.js --help"
echo "web UI: cd web && npm run dev   (then open the printed URL)"

#!/usr/bin/env bash
#
# Download the Dueling Nexus duel-client sound effects into vendor/nexus/sfx/.
#
# The assets themselves are never committed (vendor/ is gitignored) - this script
# is the reproducible way to recreate the folder on a fresh checkout.
#
# Source: https://duelingnexus.com/assets/sounds/<name>.wav
# The directory has autoindex disabled, so the file list below was established by
# probing candidate names; see vendor/nexus/sfx/manifest.json for the event mapping.
#
# Usage: bin/fetch-nexus-sfx.sh [--force]
#          --force  re-download files that already exist
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
OUT_DIR="$REPO_ROOT/vendor/nexus/sfx"
BASE_URL="https://duelingnexus.com/assets/sounds"

# Nexus serves the SPA's index.html (~1694 bytes of HTML) instead of a 404 for
# missing files, so a size/type check is the only way to detect a bad download.
MIN_BYTES=4096

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

SOUNDS=(
    activate.wav
    attack.wav
    button-press.wav
    chain.wav
    chat-message.wav
    coin-flip.wav
    counter.wav
    dice-roll.wav
    draw.wav
    equip.wav
    life-damage.wav
    life-recover.wav
    negate.wav
    next-phase.wav
    next-turn.wav
    player-ready.wav
    set.wav
    shuffle.wav
    summon-flip.wav
    summon-special.wav
    summon.wav
)

mkdir -p "$OUT_DIR"
echo "Fetching ${#SOUNDS[@]} sound effects into $OUT_DIR"

for name in "${SOUNDS[@]}"; do
    dest="$OUT_DIR/$name"
    if [ "$FORCE" -eq 0 ] && [ -s "$dest" ]; then
        echo "  skip     $name (already present)"
        continue
    fi

    curl --fail --silent --show-error --location \
         --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
         --output "$dest" "$BASE_URL/$name"

    size=$(wc -c < "$dest" | tr -d ' ')
    if [ "$size" -lt "$MIN_BYTES" ] || [ "$(head -c 4 "$dest")" != "RIFF" ]; then
        rm -f "$dest"
        echo "  FAILED   $name (server returned $size bytes of non-WAV data)" >&2
        exit 1
    fi
    echo "  ok       $name ($size bytes)"
done

echo "Done. $(ls -1 "$OUT_DIR"/*.wav | wc -l | tr -d ' ') wav files in $OUT_DIR"

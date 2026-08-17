#!/usr/bin/env bash
#
# Re-downloads the Dueling Nexus duel-client visual-effect assets into
# vendor/nexus/fx/ (gitignored). Idempotent: re-running overwrites in place.
#
# Why this exists: vendor/ is never committed, so this script is the committed
# record of *what* was collected and *where each file came from*. The catalogue
# describing the effects themselves is docs/nexus-visual-effects.md.
#
# Two origins are involved:
#   duelingnexus.com/assets/  -> UI + field art, sounds, engine bundle
#   ygopro.online/assets/     -> the shared YGOPro profile CDN the client points
#                                IMAGE_ASSETS_PATH at (playmats, sleeves, ...)
#
# Card artwork is deliberately NOT fetched (we already have card art), nor are
# the 22 background music tracks or the ~250 MB of remaining playmats.
#
# Usage:
#   bin/fetch-nexus-fx.sh              # default: 25 playmats
#   PLAYMAT_COUNT=286 bin/fetch-nexus-fx.sh   # every playmat (~250 MB)

set -euo pipefail

readonly ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
readonly OUT="$ROOT/vendor/nexus/fx"
readonly NEXUS="https://duelingnexus.com"
readonly PROFILE_CDN="https://ygopro.online/assets/profile"

# Playmats run 0..285 at ~900 KB each; 25 is a representative sample.
readonly PLAYMAT_COUNT="${PLAYMAT_COUNT:-25}"

# Plain curl is served the SPA shell for some paths; a desktop UA is not.
readonly UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

# Fetches $1 to $2, keeping the file only if it is a real asset. Prints one
# status line per attempt. Never aborts the run: a single missing asset upstream
# should not stop the rest, but it is always reported.
#
# The site answers some unknown paths with HTTP 200 and its Vue SPA shell rather
# than a 404, so a 200 alone does not mean the asset exists -- the response must
# also not be HTML. (Size is not a usable test: close.png is only 1451 bytes.)
fetch() {
  local url="$1" dest="$2" code mime size
  mkdir -p "$(dirname "$dest")"
  # The trailing newline matters: without it `read` returns 1 at EOF and set -e
  # would abort the whole run on the first asset.
  read -r code mime < <(curl -sS -A "$UA" -o "$dest.part" -w '%{http_code} %{content_type}\n' "$url" || echo "000 -")
  size=$(wc -c < "$dest.part" | tr -d ' ')
  if [ "$code" = 200 ] && [[ "$mime" != text/html* ]]; then
    mv "$dest.part" "$dest"
    printf '  ok   %8s  %s\n' "$size" "${dest#"$OUT"/}"
  else
    rm -f "$dest.part"
    printf '  MISS %8s  %s  (http %s, %s)\n' "$size" "${dest#"$OUT"/}" "$code" "$mime" >&2
  fi
}

echo "==> Dueling Nexus FX -> $OUT"

# --- engine bundle: the source of every timing quoted in the catalogue -------
echo "--> engine bundle"
fetch "$NEXUS/script/engine.min.js" "$OUT/raw/engine.min.js"
fetch "$NEXUS/style/engine.css"     "$OUT/raw/engine.css"
fetch "$NEXUS/script/fireworks.js"  "$OUT/raw/fireworks.js"

# --- effect + UI sprites ----------------------------------------------------
# Discovered from engine.min.js/engine.css string literals plus the Wayback
# CDX index for duelingnexus.com/assets/images/*.
echo "--> assets/images"
IMAGES=(
  # duel effects
  attack.png chain.png negated.png equip.png target.png
  manual-target-player.png manual-target-opponent.png
  counter.png counters.png act.svg
  # duel start / end
  first.png second.png hidden.png rock.png paper.png scissors.png
  end-screen-victory.png end-screen-defeat.png end-screen-draw.png
  # card backs / placeholders
  cover.png unknown.png set-card.png
  # card-frame colour swatches
  normal.png effect.png spell.png trap.png ritual.png
  fusion.png synchro.png xyz.png link.png
  # status + chrome
  beta.png errata.png legend.png ocg.png tcg.png rush.png
  banlist-banned.png banlist-limited.png banlist-semilimited.png banlist-illegal.png
  eye.png lock.png close.png select_arrow.png
  logo-full.png logo-abbreviated.png avatar_upload.png sleeve_upload.png
)
for f in "${IMAGES[@]}"; do fetch "$NEXUS/assets/images/$f" "$OUT/assets/images/$f"; done

# --- field / zone art -------------------------------------------------------
# engine.css uses assets/field/*; the "3d-mode" option swaps in assets/field3d/*.
echo "--> assets/field + assets/field3d"
FIELD_SVGS=(
  mobsterzone.svg spelltrapbacknew.svg linkzone.svg spellzonenew.svg
  gy.svg banished.svg bns.svg
  pend1new.svg pend2new.svg pend1opnew.svg pend2opnew.svg
  MZdisabled.svg STBdisabled.svg
)
for dir in field field3d; do
  for f in "${FIELD_SVGS[@]}"; do fetch "$NEXUS/assets/$dir/$f" "$OUT/assets/$dir/$f"; done
done
fetch "$NEXUS/assets/background/bg.jpg" "$OUT/assets/background/bg.jpg"

# --- sounds -----------------------------------------------------------------
# Exact list from Engine.Audio.prototype.loadGame + .loadRoom. All are .wav;
# the trailing number in the source is the pool size (how many simultaneous
# copies are preloaded), not part of the filename.
echo "--> assets/sounds"
SOUNDS=(
  activate attack chain counter draw equip
  life-damage life-recover negate next-phase next-turn
  set shuffle summon summon-flip summon-special
  coin-flip dice-roll
  chat-message player-ready player-enter-lobby player-leave-lobby
)
for s in "${SOUNDS[@]}"; do fetch "$NEXUS/assets/sounds/$s.wav" "$OUT/assets/sounds/$s.wav"; done

# --- profile CDN: playmats (field mats), sleeves (card backs), borders -------
echo "--> ygopro.online profile assets"
for i in $(seq 0 $((PLAYMAT_COUNT - 1))); do
  fetch "$PROFILE_CDN/Playmats/$i.png" "$OUT/profile/Playmats/$i.png"
done
for i in 0 1 2; do fetch "$PROFILE_CDN/Sleeves/$i.jpg" "$OUT/profile/Sleeves/$i.jpg"; done
for i in 0 1;   do fetch "$PROFILE_CDN/Borders/$i.png" "$OUT/profile/Borders/$i.png"; done
fetch "$PROFILE_CDN/Avatars/0.jpg" "$OUT/profile/Avatars/0.jpg"

echo "==> done: $(find "$OUT/assets" "$OUT/profile" -type f 2>/dev/null | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"

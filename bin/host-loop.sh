#!/usr/bin/env bash
# bin/host-loop.sh — a NOTIFIER for the host Claude, NOT an autoplayer.
#
# Runs `ygo wait ... --wake-on-chat` in a forever loop and prints each result,
# so the shell itself keeps the chat/turn watch alive between the host Claude's
# tool calls. It NEVER plays a move — only Claude decides moves. All it does is
# surface, to stdout, one of three things so the host notices and acts:
#   (a) "it's your turn"          — a real decision + the menu; Claude plays it
#   (b) "the human said something" — new table chat; Claude answers it
#   (c) "still waiting on P<n>"    — a timeout with nothing for you; re-arm
# --auto-pass here only auto-declines pointless optional "respond?" chain
# prompts (a decline, never a real move), exactly as the host's own wait does;
# a genuine decision, a card you named in [ask-for], or fresh chat all STOP the
# wait and print so YOU decide. This script is a convenience the host MAY use;
# the host's own backgrounded `ygo wait` is the primary, always-armed watch.
#
# Usage: bin/host-loop.sh <duel-id> <seat> [ask-for]
#   <duel-id>  the duel to watch
#   <seat>     your seat, 0 or 1 (you only ever watch your own seat)
#   [ask-for]  comma-separated card names to stop for (traps you hold), optional
#
# Loops until the duel is over; re-arms on every timeout. Ctrl-C to stop.
# Env: YGO_HOST_WAIT_TIMEOUT — seconds per wait before it re-arms (default 5).
#      Short so state surfaces promptly; raise it to reduce process churn.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

DUEL="${1:?usage: host-loop.sh <duel-id> <seat> [ask-for]}"
SEAT="${2:?usage: host-loop.sh <duel-id> <seat> [ask-for]}"
ASK_FOR="${3:-}"
WAIT_TIMEOUT="${YGO_HOST_WAIT_TIMEOUT:-5}"

wait_args=(--as "$SEAT" --auto-pass --ask-at summon,attack --wake-on-chat --timeout "$WAIT_TIMEOUT")
[ -n "$ASK_FOR" ] && wait_args+=(--ask-for "$ASK_FOR")

echo "[host-loop] watching duel '$DUEL' as seat $SEAT (NOTIFIER only — Claude plays). Ctrl-C to stop."
while true; do
  echo "[host-loop $(date +%H:%M:%S)] arming wait (timeout ${WAIT_TIMEOUT}s)…"
  out="$(node bin/ygo.js wait "$DUEL" "${wait_args[@]}" 2>&1)" && rc=0 || rc=$?
  printf '%s\n' "$out"
  if printf '%s' "$out" | grep -q "DUEL OVER"; then
    echo "[host-loop] duel over — watch loop done. Offer a rematch in chat and re-arm on the new duel."
    break
  fi
  [ "$rc" -ne 0 ] && echo "[host-loop] (no decision for you before timeout — re-arming)"
done

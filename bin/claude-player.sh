#!/usr/bin/env bash
# Boots a headless Claude Code as the player of one seat.
#
#   bin/claude-player.sh <duel-id> <seat> [strategy.md]
#
# Runs `claude -p` with the seat brief (PLAYER.md + strategy + duel facts) and
# lets it play through the ygo CLI until the duel is over. If Claude stops early
# (its brief caps play calls), the loop starts it again from the current
# position — the duel record is the only state, so nothing is lost.
# Logs go to .claude_logs/bot-<id>-<seat>.log.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DUEL="$1"; SEAT="$2"; STRATEGY="${3:-strategies/control.md}"
mkdir -p .claude_logs
LOG=".claude_logs/bot-$DUEL-$SEAT.log"
echo "[bot] duel=$DUEL seat=$SEAT strategy=$STRATEGY pid=$$" | tee -a "$LOG"
until node bin/ygo.js list 2>/dev/null | grep -q "^$DUEL: .* over:"; do
  BRIEF="$(node bin/ygo.js brief "$DUEL" --as "$SEAT" --strategy "$STRATEGY" --max-plays 150)"
  YGO_BOT=1 claude -p "$BRIEF" --dangerously-skip-permissions --model opus 2>&1 | tee -a "$LOG"
  echo "[bot] claude exited; checking whether the duel is over" | tee -a "$LOG"
  sleep 2
done
echo "[bot] duel $DUEL is over; bot for seat $SEAT exiting" | tee -a "$LOG"

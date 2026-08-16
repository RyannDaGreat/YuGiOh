#!/usr/bin/env bash
# Starts the web UI (and prints where to open it). Seats can be taken by a
# browser (open the URL as P0/P1), by Claude Code on the CLI (`ygo wait/play`),
# or by a headless Claude bot — press "Summon Claude" on an offline seat in the
# UI, or run: bin/claude-player.sh <duel-id> <seat> [strategies/x.md]
#
#   ./runserver.sh            # dev server on 0.0.0.0:5178 (LAN reachable)
#   PORT=8080 ./runserver.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT="${PORT:-5178}"
mkdir -p .claude_logs
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 127.0.0.1)"
echo "YuGi web UI: http://localhost:$PORT  |  LAN: http://$LAN_IP:$PORT"
echo "logs: .claude_logs/web-dev.log"
cd web && exec npm run dev -- --host 0.0.0.0 --port "$PORT" 2>&1 | tee ../.claude_logs/web-dev.log

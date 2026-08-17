#!/usr/bin/env bash
# Starts the web UI plus the browser-terminal daemon, and prints where to open
# them. Seats can be taken by a browser (open the URL as P0/P1), by Claude Code
# on the CLI (`ygo wait/play`), or by a Claude bot — press "Summon Claude" on an
# offline seat in the UI (or run bin/claude-player.sh <duel-id> <seat>). Bots run
# inside tmux; the UI's "terminal" panel attaches to them through ttyd so you
# can watch and talk to that Claude in a full terminal.
#
#   ./runserver.sh                 # UI on 0.0.0.0:5178, terminal daemon on 7681
#   PORT=8080 TTYD_PORT=7700 ./runserver.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT="${PORT:-5178}"
TTYD_PORT="${TTYD_PORT:-7681}"
mkdir -p .claude_logs
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 127.0.0.1)"
command -v ttyd >/dev/null || { echo "ttyd not installed (brew install ttyd / apt install ttyd) — bot terminals will be unavailable"; }
if command -v ttyd >/dev/null; then
  # -a: the page passes the tmux session name as ?arg=...; -W: writable (you can type to Claude).
  ttyd -p "$TTYD_PORT" -a -W -t fontSize=13 -t 'theme={"background":"#120c08"}' tmux attach -t 2>&1 | tee .claude_logs/ttyd.log &
  echo "terminal daemon: http://localhost:$TTYD_PORT/?arg=<tmux-session>"
fi
echo "YuGi web UI: http://localhost:$PORT  |  LAN: http://$LAN_IP:$PORT"
echo "logs: .claude_logs/web-dev.log"
cd web && exec env PUBLIC_TTYD_PORT="$TTYD_PORT" npm run dev -- --host 0.0.0.0 --port "$PORT" 2>&1 | tee ../.claude_logs/web-dev.log

#!/usr/bin/env bash
# Just the web server (SvelteKit dev server), LAN-reachable. Prints the URLs.
# runserver.sh launches Claude Code, which runs this in the background.
#   bin/serve.sh            # 0.0.0.0:5178
#   PORT=8080 bin/serve.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT="${PORT:-5178}"
mkdir -p .claude_logs
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 127.0.0.1)"
echo "YuGi web UI: http://localhost:$PORT  |  LAN: http://$LAN_IP:$PORT"
cd web && exec npm run dev -- --host 0.0.0.0 --port "$PORT" 2>&1 | tee ../.claude_logs/web-dev.log

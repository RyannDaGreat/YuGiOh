#!/usr/bin/env bash
# The one-command way to play against Claude:
#   ./runserver.sh
# launches ONE interactive Claude Code session in THIS terminal with HOST.md as its first
# instruction. That Claude starts the web server in the background, opens the browser for
# you, sits at seat P1 of a duel, plays through the ygo CLI, and chats with you here while
# you play in the browser. No tmux, no daemons: when you quit Claude, `bin/serve.sh` (the
# server it started) is the only thing left, and Ctrl-C there stops it.
#
# Just the server, no Claude:  bin/serve.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
command -v claude >/dev/null || { echo "claude CLI not found — install Claude Code (https://claude.com/claude-code)"; exit 1; }
MODEL="${YGO_HOST_MODEL:-opus}"
exec claude --model "$MODEL" "$(cat HOST.md)"

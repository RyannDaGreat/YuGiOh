#!/usr/bin/env bash
# The one-command way to play against Claude:
#   ./runserver.sh
# launches ONE interactive Claude Code session in THIS terminal with HOST.md as its first
# instruction. That session is the HOST: per HOST.md it keeps exactly one chat/turn watch
# (`ygo wait … --wake-on-chat`) armed at all times for the whole session — a NEVER-IDLE
# contract — so anything you type in the browser chat, and every one of its turns, is
# answered without you waiting. It starts the web server in the background, opens the
# browser, sits at seat P1, plays through the ygo CLI, and chats with you here while you
# play in the browser. No tmux, no daemons: when you quit Claude, `bin/serve.sh` (the server
# it started) is the only thing left, and Ctrl-C there stops it.
#
# NOTE: only THIS session is the host. A separate Claude session (e.g. one building the app)
# is NOT the host and will NOT keep the watch armed — start the host with this script.
#
# Just the server, no Claude:  bin/serve.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
command -v claude >/dev/null || { echo "claude CLI not found — install Claude Code (https://claude.com/claude-code)"; exit 1; }
MODEL="${YGO_HOST_MODEL:-opus}"
exec claude --model "$MODEL" "$(cat HOST.md)"

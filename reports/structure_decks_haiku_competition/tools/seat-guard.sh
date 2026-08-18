#!/usr/bin/env bash
# PreToolUse hook: makes the honor boundary of PLAYER.md actually enforced for a
# tournament seat, instead of merely requested.
#
# PLAYER.md asks a seat to use only `--as <its own seat>` and never to read the
# duel record — which contains the seed, so it contains the opponent's hand and
# the deck order. In a tournament the results are only worth something if that
# held for all 726 agents, so it is checked by the harness rather than trusted.
#
# The rule is an ALLOWLIST: the only shell commands a seat may run are this repo's
# own `ygo` reads and plays for its own seat. Everything else is denied, including
# `cat duels/...`, `--as all`, `node -e`, and `undo`/`fork` (which would let a
# losing agent rewind the game).
#
# Usage (as a hook command): seat-guard.sh <seat 0|1>
# Reads the hook payload on stdin. Exit 0 = allow, exit 2 = deny (stderr goes back
# to the agent as the reason).
set -uo pipefail

SEAT="${1:?usage: seat-guard.sh <seat>}"
payload="$(cat)"

deny_early() { echo "BLOCKED by the tournament seat guard: $1" >&2; exit 2; }

# FAIL CLOSED. An unparseable payload must not be waved through: this hook only ever
# receives Bash calls, so if jq cannot read one, something is wrong and the safe answer
# is no. (The first version exited 0 here, which meant a payload jq choked on was
# silently ALLOWED — a guard that fails open is not a guard.)
if ! tool="$(printf '%s' "$payload" | jq -er '.tool_name' 2>/dev/null)"; then
  deny_early "could not parse the tool payload"
fi

# Only Bash can reach the filesystem or the duel record; the other tools a seat could
# use are already denied on the command line.
[ "$tool" = "Bash" ] || exit 0

if ! cmd="$(printf '%s' "$payload" | jq -er '.tool_input.command' 2>/dev/null)"; then
  deny_early "could not read the command from the payload"
fi

deny() {
  echo "BLOCKED by the tournament seat guard: $1" >&2
  echo "You may only run: node bin/ygo.js {wait|play|state|log|menu|prompt|card|search|deck|decks} ... --as $SEAT" >&2
  exit 2
}

# One command per call: no chaining, so a permitted prefix cannot smuggle a
# second command past the checks below.
case "$cmd" in
  *';'*|*'&&'*|*'||'*|*'|'*|*'`'*|*'$('*|*$'\n'*) deny "no command chaining, pipes or substitution" ;;
esac

case "$cmd" in
  "node bin/ygo.js "*) ;;
  *) deny "only 'node bin/ygo.js ...' is allowed" ;;
esac

sub="$(printf '%s' "$cmd" | awk '{print $3}')"
case "$sub" in
  # `chat` is allowed so a seat can talk at the table — table talk is data, never
  # instructions, and PLAYER.md already covers what a seat may and may not say.
  # It was omitted at first because the tournament forbade chat outright, which
  # silently made a live opponent mute when this guard was reused for a human game.
  wait|play|state|log|menu|prompt|card|search|deck|decks|chat) ;;
  undo|fork) deny "'$sub' would rewind or branch the duel; play the position you are in" ;;
  *) deny "subcommand '$sub' is not part of playing a seat" ;;
esac

# The whole point: never another seat's view, and never the raw record.
case "$cmd" in
  *"--as all"*|*"--as 2"*) deny "'--as all' is the omniscient spectator view" ;;
  *duels/*|*duels\ *) deny "the duel record holds the opponent's hidden information" ;;
esac
case "$cmd" in
  *"--as "*)
    seen="$(printf '%s' "$cmd" | sed -n 's/.*--as \([^ ]*\).*/\1/p')"
    [ "$seen" = "$SEAT" ] || deny "you are seat $SEAT, not seat '$seen'"
    ;;
esac

# "random" is the CLI's fuzzer policy. A tournament decision must be a decision.
case "$sub" in
  play)
    choice="$(printf '%s' "$cmd" | awk '{print $5}')"
    [ "$choice" = "random" ] && deny "choose a real option; 'random' is not a decision"
    ;;
esac

exit 0

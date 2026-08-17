# YuGi — concerns.md

Historical record of how this came to be: mistakes, wrong turns, lessons. Append-only; never
delete. The manifest says WHAT the project is; this says HOW it got here, including every misstep.

## 2026-08-16 — session 1 (build from scratch, then play a game)

### Engine bring-up
- ocgcore-wasm gotchas cost two iterations each, both now in code comments: `createCore` is the
  DEFAULT export (not named); `constant.lua` + `utility.lua` MUST be preloaded via
  `core.loadScript()` before adding cards or every card script dies at `GetID`.
- Messages arrive as TYPED JS objects, not raw binary — the binary parser budgeted for "Phase 2"
  was never needed.
- Deck was not shuffling: `sequence: 2` to `duelNewCard` left decks in insertion order (both
  players drew identical hands). Fix: shuffle passcodes ourselves with a seeded RNG before insert —
  which also made duels reproducible (a feature, not just a fix).
- `OcgQueryFlags.TYPE` mis-parses in ocgcore-wasm 0.1.2 (returns null for the whole card); we read
  card type from cards.cdb instead.
- cards.cdb `setcode` and `race` columns exceed 2^53; node:sqlite refuses them as numbers. Read as
  TEXT and BigInt/Number them. Latent crash in the card reader; caught before it mattered.
- Negative LP printed as 4294966246 (uint32 wrap of -1050); the binding reads the core's int32 LP
  as uint32. Fixed with `| 0` in state.js. Found by an eval agent, not by me.

### Masking / correctness
- Selection lists (`SELECT_CARD`/`TRIBUTE`/`UNSELECT`) leak: the core includes the opponent's cards
  with real codes. The real server zeroes every entry the selecting player doesn't control (even
  face-up ones) and the client re-derives names it legitimately knows. We matched that; the
  consistency test's leak-detector is what guards it.
- `SELECT_PLACE` field mask: a SET bit means UNAVAILABLE (inverse of the intuition), and the mask is
  relative to the asking player (low 16 bits = own zones). Two wrong guesses before reading the
  core's own validator.
- `ANNOUNCE_NUMBER` response must be the INDEX into the announced options, not the number itself.
  This surfaced live, mid-game, on Ancient Telescope — a real bug the eval agents never hit. Fixed
  and committed while the human waited.

### Response-prompt noise
- The engine asks the non-turn player at every timing window where a set card could activate. One
  eval agent spent ~94 of ~141 "plays" on forced "0". Fix: `wait --auto-pass --ask-for --ask-at`,
  each pass a real recorded response. Later found the engine already computes the right predicate
  (`spe_count`) — the "smart" mode is the standard EDOPro/Nexus default, not a heuristic to invent.
- `play` didn't honor `--auto-pass`, so post-move respond prompts cost extra calls; added it.
- Chain-prompt title showed a stale phase (persisted HINT_EVENT); now taken from the field model's
  authoritative turn/phase. A stale "Standby Phase" on a Main Phase prompt is actively misleading.

### The tmux disaster (do not repeat)
- To make the in-browser/terminal bot "talkable", I ran the bot inside tmux and, during cleanup,
  ran `tmux kill-server`. That killed the USER'S ENTIRE tmux server — their claude_bash mirror and
  everything else they had running, not just my session. The user revoked tmux entirely.
- Lesson (saved to memory `feedback-never-use-tmux`): never touch tmux in any form; for
  persistent/attachable processes use node-pty+WebSocket, background processes with logs, or
  run_in_background. `kill-server` is global — never a cleanup step.

### Browser-Claude dead end
- Explored running Claude Code in the browser (leaningtech BrowserCode/BrowserPod). Their
  Apache-2 repo is only a UI shell; the WASM runtime is proprietary, API-keyed, CDN-loaded, and
  metered. User refused to use their API or pay. No fully-open in-browser Node runtime exists that
  can host Claude Code. Reverted to the original plan: `runserver.sh` launches an interactive host
  Claude in the terminal (HOST.md) that runs the server and plays P1. All browser-Claude / BrowserPod
  / node-pty / xterm / ttyd code and deps removed; a sweep agent confirmed the tree clean.

### Live-game play mistakes (Claude as P1 vs the human)
- Activated Castle Walls (a DEF-boost trap) with no monster of mine in defense — a pointless play
  the human immediately questioned. Root cause: I fired a blind menu INDEX from a stale menu snapshot
  instead of re-reading the current menu before each play. Lesson added to PLAYER.md: never batch
  `play` calls, always read the menu after each play (menu numbering shifts).
- Flip-summoned my own set Hane-Hane forgetting its own text bounces a monster back to the owner's
  hand — bounced itself. Harmless (cost a tempo), owned it in chat. Read the card before acting;
  "legal" is not "useful".
- Chat didn't notify me of the human's messages mid-turn. Added `wait --wake-on-chat` so a message
  from the other seat returns the wait so I can answer.

### Process notes
- Concurrent-subagent cap (20) briefly blocked one eval agent; it launched when a slot freed.
- Multiple presence/duel files churn while the server + host play; agents editing web/ must do so in
  worktrees (or accept a hot-reload) and never touch duels/.
- Sonnet/low-effort model was accidentally set at one point; the user asked for a re-audit. Opus
  agents were used for research/eval/UI work thereafter.

### Data / records
- Duel records + chat are committed to git, so nothing played is lost. Gap identified by the user:
  responses weren't timestamped, so chat couldn't be aligned to moves on a timeline. Being fixed by
  adding a parallel `times` array (replay untouched) + chat-on-timeline + a history home page.

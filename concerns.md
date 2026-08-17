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
- 2026-08-16, done (worktree branch, merged main in): `times` shipped. Decisions and the reasoning
  behind them:
  - `times` is a PARALLEL array, not a field on each response, so `responses` keeps its exact shape
    and a replay stays byte-identical. It is never handed to the core.
  - Old records lack `times` entirely. Naively appending to them would have written `times[0]` for
    response #11 — a silent off-by-N that would have mis-dated every future move on every existing
    duel. `store.alignTimes(times, count)` pads/truncates to one entry per response, and every
    writer (playChoice, forkDuel, `ygo undo`) goes through it. Verified live on `t1` (10 untimed
    moves): the record became `[null ×10, "…T01:31:06Z"]`.
  - Playback cutoff is `at <= atTime` (inclusive), and a null cutoff means []: at move 0, or on a
    record with no clock, nothing is *known* to have been said, so nothing is shown rather than
    leaking the whole log. Confirmed end to end on a throwaway duel: a line sent between move 2 and
    move 3 appears from `?at=3` onward and not before.
  - Filtering lives in `engine.duelPayload`, not in `session.viewDuel`: the session layer takes a
    record, not an id, and must not do chat I/O. viewDuel only exposes `atTime`.
  - Manifest-first was violated here: this agent started before the manifest existed on its base
    commit and only received it by merging main mid-task, so the manifest was updated after the
    code. Sections 2/3/5/7/9 now describe what shipped.

---

## 2026-08-16 — Visual overlay layer (animations) workstream START

**What / why:** User asked (green-lit "go build everything") for: unified card-movement animations (any zone→any zone, flip mid-flight), smooth hand/zone reflow, life-point tween with the anime tick/settle sound, and dashed equip relationship lines. Design discussion first (they explicitly wanted to avoid "whack-a-mole / patching a sinking ship").

**Design decisions recorded (see claude_instructions.md §11):**
- Chose "interpolate the delta between state N and N+1" as the ONE abstraction, so all zone permutations share a single flyer instead of N² hand-written transitions. This directly answers the user's whack-a-mole concern.
- Grounded it in EXISTING infra rather than greenfield: `centerOf`/`data-zone` anchors, the `dagger` overlay pattern, `play(ev)` dispatcher, `fx` map — all already in Table.svelte (daggers already fly between two zones).
- Backend unifying primitive: a generic `move {from,to,…}` event on every T.MOVE (both coords already present in the core MOVE message). Existing semantic events keep driving sounds.

**Divvy decision (user asked me to manage/divvy agents):** Table.svelte is the shared hinge for flyer + reflow + equip lines + LP-mount, so parallel worktree agents on it would collide badly. Therefore I serialize the Table-coupled work MYSELF (one owner, no merge conflicts) and hand the ONE genuinely-independent + slow chunk — sourcing the anime LP tick/settle sounds + a self-contained LPCounter component + sound.js cues — to a single worktree agent. Honest engineering over parallelism theatre. (Prior architecture Q&A: rejected swapping SQLite for a DB server — SQLite is in-process/µs, a server adds socket round-trips; the real cost was replay, fixed by memoizing card lookups (immutable data, not a fragile cache) and caching finished-duel summaries keyed on move-count (self-invalidating). Recorded here so the "why not a second server" reasoning isn't lost.)

**Risks to watch:** (1) coord() zone names vs zoneId() names must line up for slot lookup (spot-checked: both use m/s/hand/grave/removed/deck/extra). (2) masking — flyer/lines must ride the masked stream only. (3) scrubber: must NOT fire flyers on multi-move jumps. (4) pile anchors (deck/GY) have a single data-zone rect, which is the intended source/dest for cards entering/leaving a stack. Append snags below as they occur.

# YuGi — Yu-Gi-Oh! for LLM agents

A headless, text-first Yu-Gi-Oh! duel harness. The player is expected to be an
LLM (Claude Code, its subagents, or a script) driving a CLI; humans get a web
UI over the same engine. Every rule of the real game applies — the harness sits
on **ocgcore**, the engine behind EDOPro/YGOPro — and every card ever printed
is available offline.

## What it does

- Runs full-rules duels headlessly (`ygo` CLI). No browser, no server process.
- Emits a compact text log ("YGN") and a full text state, **per player
  perspective**: you never see the opponent's hand, face-downs, or deck order.
- Hands each player an enumerated menu of **legal** actions at every decision;
  illegal moves are impossible by construction.
- Ships an offline, greppable card database (14,700+ cards, full effect text).
- Records a duel as `seed + decklists + responses`, so any duel is exactly
  reproducible and can be rewound.

## Setup

```sh
./setup.sh          # clones pinned card scripts + database, fetches strings.conf, npm install
npm test            # cross-checks masking + client model over random duels (~1 min)
```

Requires Node ≥ 22.13 (uses the built-in `node:sqlite`).

## Playing

```sh
node bin/ygo.js new --id g1 --p0 yugi --p1 kaiba --seed 42 --players ryan,claude
node bin/ygo.js state g1 --as 1          # board, your hand, opponent's public info, and your menu
node bin/ygo.js play  g1 3 --as 1        # answer option 3; prints what happened next
node bin/ygo.js log   g1 --as 1 --last 40
node bin/ygo.js card  "Trap Hole"        # rules text, offline
node bin/ygo.js search "Blue-Eyes"
node bin/ygo.js deck  kaiba
node bin/ygo.js undo  g1 --n 2           # time travel (experiments)
node bin/ygo.js list
```

`--as` is who you are: `0`, `1`, or `all` (spectator/omniscient — for judging,
never for playing). P0 always takes turn 1.

Menu answers: `3` one option · `1,4` several · `0` the pass/cancel/no option
when offered · `name:<card>` for "declare a card name" · `random` a random legal
move.

## The text formats

**Log (YGN)** — one line per event, absolute player labels, zone tokens
`m0..m6` (monster), `s0..s4` (spell/trap), `field`, `pz0/1`, `hand`, `GY`,
`banished`, `deck`, `extra`; `?` = a card you may not identify.

```
== Turn 2 (P1) ==
-- Main Phase 1
P1 normal summons Ryu-Kishin Powered at m0 ATK
-- Battle Phase
Ryu-Kishin Powered (P1 m0) attacks ? (P0 m0)
Man-Eater Bug (P0 m0): fd DEF -> DEF
  battle: Ryu-Kishin Powered 1600 ATK vs Man-Eater Bug 600 DEF: Man-Eater Bug destroyed
P0 activates Man-Eater Bug (m0) [chain 1]
  targets Ryu-Kishin Powered (P1 m0)
>> chain 1 resolves: Man-Eater Bug
Ryu-Kishin Powered: P1 m0 (ATK) -> P1 GY
```

**State** — LP, every zone with current ATK/DEF (and base if modified), your
hand, both graveyards, and — because both decklists are public — the sorted
multiset of cards you have *not* seen: your own deck (order withheld), and for
the opponent "hand + deck + face-downs" as one pool.

## Architecture

```
bin/ygo.js        CLI (thin)
src/session.js    replay a duel record → views/menus for one viewer; apply a choice
src/duel.js       ocgcore-wasm wrapper: build duel from seed+decks, replay responses
src/view.js       per-player masking — port of YGOPro's server fan-out rules
src/field.js      client-side field model rebuilt from the masked stream (names things in the log)
src/log.js        YGN log renderer
src/state.js      full state renderer (core query + masking + viewer's memory)
src/menu.js       decision menus ⇄ OcgResponse
src/cards.js      cards.cdb access (engine data, names, text, search)
src/strings.js    strings.conf + effect-description decoding
src/store.js      duel records (duels/*.json), decklists (src/decks/*.json)
src/rng.js        seeded shuffle
vendor/           pinned Project Ignis CardScripts + BabelCDB + strings.conf (setup.sh)
```

**Replay, not persistence.** A duel record is `{seed, decks, responses}`. Every
command rebuilds the WASM duel from scratch and re-applies the responses
(milliseconds). Deterministic seeds → identical shuffles across strategy
comparisons; truncating `responses` rewinds time; no daemon to keep alive, so
any number of agents can drive any number of duels concurrently.

**Legal actions come from the engine.** The core stops at each decision with an
explicit list of options (`MSG_SELECT_IDLECMD`, `MSG_SELECT_CARD`, ...). We
render the list; the player picks an index; the core validates. Nobody writes
rules logic here.

## Hidden information

`view.js` masks the core's single omniscient message stream per viewer using
the same rules as YGOPro's server (`single_duel.cpp` `Analyze`) — e.g. a card
moving to the graveyard is public even if it was face-down; moving to hand or
arriving face-down is private; a set card's identity is known only to its
controller; selection lists zero the opponent's cards and the client re-derives
what it legitimately knows from its own field model. `npm test` cross-checks the
model against the masked core query at hundreds of decision points and flags
any card the model knows without a legitimate reveal.

**Honor system:** the duel file contains the seed, from which everything
follows. A player who reads `duels/<id>.json` or uses `--as all` can see the
opponent's hand. Agents play honestly by using only `--as <their id>`. This was
chosen over a token-authenticated daemon because all participants share one
machine; the daemon can wrap `session.js` later without changing anything else.

## Decks

`src/decks/yugi.json` and `kaiba.json` are the 50-card North-American Starter
Deck Yugi / Starter Deck Kaiba lists (SDY/SDK), verified against Yugipedia and
YGOPRODeck. Any JSON `{name, main: [[cardName, count], ...]}` works; names must
match cards.cdb exactly (`ygo search` to check).

## Known limitations / next

- Duel format is Master Rule 5, 8000 LP, 5-card hand, no side deck, no match play.
- `ocgcore-wasm@0.1.2` quirks: `createCore` is the default export; `constant.lua`
  and `utility.lua` must be preloaded; `OcgQueryFlags.TYPE` mis-parses (we take
  type from cards.cdb); MSG_MOVE's `reason` is not exposed (log lines say where a
  card went, not why — the surrounding lines make it clear).
- The core keeps running after `MSG_WIN`; the harness treats WIN as terminal.
- Web UI (Svelte) not yet built; it will be a client of `session.js`.

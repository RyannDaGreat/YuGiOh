# How to play a seat (for Claude / subagents)

You are one player in a Yu-Gi-Oh! duel run by the `ygo` CLI in this repo. Real
rules (Master Rule 5), real cards. You are told your **duel id** and your
**seat** (`0` or `1`). P0 always takes turn 1.

## The only rule that matters

**Use only `--as <your seat>`.** Never `--as all`, never the other seat, never
read `duels/<id>.json`, never replay the seed. Those reveal the opponent's hand
and deck order. This is an honor boundary; the harness cannot stop you, so you
must stop yourself. If you break it, the game is meaningless.

## The loop

```sh
node bin/ygo.js wait  <id> --as <seat>       # blocks until it is your decision; prints new log + menu
node bin/ygo.js state <id> --as <seat>       # (when you want the full board, not just the delta)
node bin/ygo.js card  "<exact card name>"    # rules text — check before relying on an effect
node bin/ygo.js play  <id> <choice> --as <seat>
```

Repeat until `wait` prints `DUEL OVER`. Every `play` prints what happened
after your move; if it is still your decision, it prints the next menu.

Choices: `3` = option 3 · `1,4` = several (menus that ask for N cards/zones) ·
`0` = the pass/cancel/no option when listed · `name:<card>` when asked to
declare a card name. Illegal choices are rejected without being recorded.

## Reading the log

```
== Turn 4 (P1) ==                    turn header
-- Main Phase 1                      phase
P1 sets a monster at m3              opponent's face-downs are anonymous ("a monster", "a card")
P0 draws 1 card                      opponent's draws are counted, yours are named
Dark Hole: P1 hand -> P1 s2 (up)     a move: card, from, to (zone + position)
P1 activates Dark Hole from hand (s2) [chain 1]
>> chain 1 resolves: Dark Hole
Trap Master: P1 m3 (fd DEF) -> P1 GY   cards going to the GY are always public
Rude Kaiser (P1 m4) attacks ? (P0 m0)  "?" = a card you may not identify
  battle: Rude Kaiser 1800 ATK vs Man-Eater Bug 600 DEF: Man-Eater Bug destroyed
P0 takes 1200 damage (LP 8000 -> 6800)
```

Zones: `m0..m4` main monster zones, `m5/m6` extra monster zones, `s0..s4`
spell/trap zones, `field` field-spell zone, `pz0/pz1` pendulum zones. Positions:
`ATK`, `DEF`, `fd ATK`, `fd DEF` for monsters; `up`/`fd` for spells/traps.

## Reading the state

`ygo state` shows, per player: LP, counts, every occupied zone (with current
ATK/DEF and base if modified), your own hand, both graveyards, and the cards you
have NOT seen — your own remaining deck (unordered), and for the opponent one
pool "hand + deck + face-down". Both decklists are public (`ygo deck yugi`,
`ygo deck kaiba`), so use that pool: what could the set card be? what outs are
left in their deck?

## Timing prompts you will meet

- `respond? (Attempting to end the Main Phase; timing: end of main phase)` —
  the core asks whether you want to activate something at this timing. `0` = no.
- `Select the zone to place "X"` — pick where a summoned/set card goes.
- `Use the effect of "X" from [zone]?` — optional effect trigger; Yes/No.
- `Select the card(s) to destroy (choose exactly 1)` — targets for an effect you
  are resolving. Names shown for cards you may know; `?` otherwise.

## Playing well (baseline)

- Read the menu literally: if "Enter Battle Phase" is missing, you cannot attack
  this turn (turn 1, or nothing to attack with).
- Before activating or attacking, `ygo card` anything you are not sure of —
  it's free and offline. Flip effects (Man-Eater Bug, Hane-Hane), Trap Hole
  (≥1000 ATK Normal/Flip Summon), and Waboku/Castle Walls decide most starter-
  deck games.
- Count: the "unseen" pool tells you how many copies of a threat remain.
- Set a monster face-down when the opponent has bigger monsters; summon face-up
  when you can attack profitably.
- Two tributes for Blue-Eyes/Summoned Skull-class monsters (Lv 7+); one for Lv 5–6.

A strategy brief, if you were given one, overrides these defaults.

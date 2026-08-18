# Which structure deck is best? — an all-play-all Haiku tournament

Every official Konami product in this repo (`category: "structure"`) plays every
other one, and itself, in a best-of-three. Both seats of every duel are played by
a **Claude Haiku agent** through the repo's own CLI, under the real rules
(ocgcore, Master Rule 5). Same model on both sides of every table, no strategy
briefs, no human input: **the only thing that differs between two seats is the
decklist**, which is what makes the win matrix a statement about decks.

## Result

**363 of 363 duels finished**, every one by the rules engine declaring `LP reached 0` — no deck-outs,
no draws, no duel resolved by anything but play. 121 cells, exactly 3 games each, 66,563 decisions.

| # | deck | W–L | win rate |
| --- | --- | --- | --- |
| 1 | **SD2 Zombie Madness** | 48–12 | **80.0%** |
| 2 | SD4 Fury from the Deep | 42–18 | 70.0% |
| 3 | SD3 Blaze of Destruction | 36–24 | 60.0% |
| 4 | SD6 Spellcaster's Judgment | 35–25 | 58.3% |
| 5 | SD1 Dragon's Roar | 33–27 | 55.0% |
| 6 | SDY Yugi | 32–28 | 53.3% |
| 7 | SDMP Master of Pendulum | 28–32 | 46.7% |
| 8 | SDSC Spellcaster's Command | 25–35 | 41.7% |
| 9 | SDK Kaiba | 22–38 | 36.7% |
| 10 | SD10 Machine Re-Volt | 19–41 | 31.7% |
| 11 | **SDP Starter Deck: Pegasus** | 10–50 | **16.7%** |

**Going first is worth nothing here: 178 wins on the play vs 185 on the draw.** Read every cell in the
matrix against that baseline — a 2–1 is noise, and the spread between SD2 at 80% and SDP at 16.7% is
not.

The ordering broadly matches these products' reputations among human players, which is worth noting
only as an external sanity check on the harness: no deck was given a strategy brief, and no agent was
told anything about which decks are supposed to be good.

## Glossary

- **cell** — one square of the grid: an ordered pairing (who goes first is fixed),
  played as a best-of-three.
- **on the play / on the draw** — going first (seat P0, takes turn 1) / going
  second. In this repo P0 always takes turn 1.
- **seat guard** — the `PreToolUse` hook (`tools/seat-guard.sh`) that restricts a
  playing agent's shell to `ygo` commands for its own seat, so the honor boundary
  of `PLAYER.md` is enforced by the harness rather than trusted.
- **nudge** — the forcing mechanism: a fresh single-decision Haiku agent sent in to
  answer one menu when a pair of agents left a duel unfinished. See "No abandoned
  duels" below.
- **duel record** — `duels/<id>.json`; replaying it deterministically reproduces
  the whole game, so every result in this report is re-derivable from the records
  rather than from any log this tournament happened to write.

## The field (11 decks)

Rows and columns are in Konami release order.

| set | deck |
| --- | --- |
| SDY | Yugi (Starter Deck: Yugi, 2002) |
| SDK | Kaiba (Starter Deck: Kaiba, 2002) |
| SDP | Starter Deck: Pegasus (2003) |
| SD1 | Dragon's Roar (2004) |
| SD2 | Zombie Madness (2004) |
| SD3 | Blaze of Destruction (2004) |
| SD4 | Fury from the Deep (2004) |
| SD6 | Spellcaster's Judgment (2005) |
| SD10 | Machine Re-Volt (2006) |
| SDSC | Spellcaster's Command (2010) |
| SDMP | Master of Pendulum (2015) |

Curated and user decks are deliberately excluded: this is a contest between
printed products. All eleven are `format: "classic"`, so every pairing is legal
without deck edits.

## How the grid is read

**The row deck goes first (seat P0). The column deck goes second (P1).**

That single rule is what makes the two triangular halves meaningful: an unordered
pairing {A, B} appears twice — once at (A, B) with A on the play, once at (B, A)
with B on the play — so the grid measures each matchup from both seatings. On the
diagonal both seats hold the same deck, and seating is irrelevant by construction.

- 11 x 11 = **121 cells**
- best-of-three, all three games always played = **363 duels**
- two agents per duel = **726 Haiku agents**
- 100 matches in flight = 200 concurrent agents (raised from 10/20 during the run)

Each cell in `matrix.md` reads `row wins–column wins`, bolded when the row deck
took the match.

## Conditions, identical for all 726 agents

- Model: `haiku`, one agent per seat, launched headless (`claude -p`). Every agent in the
  tournament is Haiku — seat agents and nudge agents alike; nothing here ever runs a costlier model.
  Each agent also carries a hard `--max-budget-usd` ceiling, so a runaway agent stops instead of
  spending: it is then replaced by a fresh agent that resumes the same board, which bounds cost
  without ever abandoning a duel.
- Prompt: `ygo brief <id> --as <seat>` — i.e. `PLAYER.md` plus the seat facts —
  with a tournament addendum about playing briskly and never quitting early.
  **No strategy brief is passed to either side.**
- Seeds are fixed and distinct per duel (`SEED_BASE` in `tools/schedule.mjs`), so
  the entire tournament is reproducible.
- Every decision is a Haiku decision. `--auto-pass` answers the engine's optional
  "respond?" prompts (recorded as the seat's own responses, exactly as `PLAYER.md`
  describes) so that agent attention goes to real choices.

## No shortcuts, and no abandoned duels

A duel counts **only when the rules engine declares it over**. Nothing in this
report is decided by comparing life points, by random play, or by assumption.
Two mechanisms make that hold across 363 duels:

1. **Relaunch.** If a pair of agents stops early, crashes, or is killed on
   timeout, a fresh pair is launched on the same record. The CLI is stateless, so
   they pick the game up mid-board.
2. **Nudge** — the forcing mechanism. A relaunched pair could in principle stall
   the same way twice, so after any pair round that fails to finish the duel the
   driver forces at least one move: it finds the seat the engine is waiting on and
   runs a single-decision Haiku agent whose entire job is to answer that one menu
   and exit. Every menu has at least one legal answer (passing is an answer;
   refusing to decide is not), so the board always moves — and the decision is
   still made by a Haiku agent, never by the driver. Then a fresh pair resumes.

A board that survives six consecutive single-decision agents is logged as `stuck`
in `progress.jsonl` and left for the next run: a bug to look at, never a result to
invent. `tools/autoplay.mjs` (random legal moves) exists only to size and fuzz the
harness and refuses to touch any `sdc-*` id.

## Hidden information is enforced, not trusted

`PLAYER.md` asks a seat to use only `--as <its own seat>` and never to read the
duel record — which stores the seed, and therefore the opponent's hand and the
deck order. Over 726 agents, "asked" is not good enough for the results to mean
anything, so `tools/seat-guard.sh` is installed as a `PreToolUse` hook and
allowlists each seat's shell down to its own `ygo` calls. Blocked: `--as all`, the
other seat, anything touching `duels/`, `undo`/`fork` (which would let a losing
agent rewind), `play … random`, and command chaining. Verified live before the run.

**But the enforcement had a hole, found afterwards and measured.** The seat guard stopped a
player *reading the record*; it could not stop the engine layer *handing* a player something
it shouldn't. `src/view.js` decided whether a Deck reveal was private from `msg.player` — the
player being SHOWN the cards — instead of from who owns them. Nobleman of Crossout makes both
players search their Decks, so each seat could receive the other's full deck list, and from it
their hand by elimination. Fixed (privacy now keys on the cards' controller; see manifest §17,
tests in `test/confirm-cards-privacy.test.js`), and the exposure was audited rather than
assumed — `tools/audit-leak.mjs` replays the raw core stream and applies the old rule:

- **11 of 363 duels (3.0%)**, across 10 of 121 cells; **89 card names total, 71 of them in a
  single duel**; the other ten leaked 1–5 names each. 7 of the 11 involve SDK, whose decklist
  carries the trigger card.
- **The seat holding the leaked information won 4 and lost 6** — no measurable edge.
- **Removing all 11 duels leaves the standings in the identical order**, every deck within
  ~2 points. The matrix below stands.

Stated plainly because the alternative is worse: the first version of that audit reported
"0 of 363 affected", which was a false negative caused by iterating a field `viewDuel` does not
return. A negative audit result is worth nothing without a positive control.

## Files

| file | what it is |
| --- | --- |
| `matrix.md` | the win matrix, standings, and the going-first split |
| `matrix.json` | the same numbers, machine-readable |
| `results.jsonl` | one line per duel: winner, victory reason, final LP, move count |
| `schedule.json` | the 121 cells and the 363 duel ids + seeds |
| `progress.jsonl` | append-only history of every agent-pair attempt |
| `index.html` | the readable report |
| `pilot-experiment.md` | follow-up: the same decks with a stronger pilot on the weaker one |
| `reseeds.jsonl` | every duel replayed from a fresh shuffle, and why |
| `tools/` | roster, schedule, driver, seat guard, collector, calibrator, triage, leak audit |

## Reproducing it

```sh
bash setup.sh                                                     # card data + deps
node reports/structure_decks_haiku_competition/tools/schedule.mjs # 363 duels
node reports/structure_decks_haiku_competition/tools/run-tournament.mjs --matches 100
node reports/structure_decks_haiku_competition/tools/collect.mjs   # matrix + standings
```

The driver skips duels that are already finished, so it can be stopped and
restarted at any point; `collect.mjs` can be run mid-tournament for a partial
matrix (unfinished cells are marked `*`).

## What this measures, and what it does not

It measures **how these eleven printed decklists perform against each other when
piloted by equally weak, equally uninformed players**. That is a real and specific
question, and the answer is not the same as a human-tournament answer: a deck whose
strength depends on subtle sequencing will underperform here, and a deck that wins
by having bigger numbers will overperform. Small samples matter too — three games
per cell is enough to rank decks, not enough to trust any single cell. The
going-first split at the bottom of `matrix.md` is the honest scale for reading the
rest of the table.

**And the pilot matters more than this table does.** A follow-up (`pilot-experiment.md`) replayed
the most lopsided pairing in the tournament — SD2 beat SDSC 6-0 — with SDSC handed to a stronger
model and SD2 left on Haiku. SDSC won 5-0 (4-0 discarding one leak-contaminated game), from both
seats, with the decklists untouched. So read this ranking as "how well does this deck perform at a
fixed, low pilot strength", which compresses skill-hungry decks downward and rewards forgiving
ones. It is a real measurement of decks; it is not a measurement of their ceilings.

# Does the pilot matter more than the deck?

A follow-up to the 363-duel tournament, run 2026-08-17 at the user's request.

## The question

In the tournament every seat was played by a **Haiku** agent. Zombie Madness (SD2)
finished **1st of 11 at 80.0%**; Spellcaster's Command (SDSC) finished **8th at 41.7%**,
and head-to-head over all six games **SD2 beat SDSC 6-0** - a clean sweep.

So: is that a deck gap, or a piloting gap? Five duels were run with the SAME two
decklists, changing exactly one thing - **SDSC piloted by an Opus agent, SD2 still
piloted by Haiku**.

## Setup

- Duel ids `opus-sdsc-vs-sd2-g1..g5`, fresh seeds 77000001-77000005 (outside the
  tournament's range, so these are new games and not replays).
- **Seats alternate** so neither pilot gets a systematic first-player edge: SDSC is
  P0 in g1/g3/g5, SD2 is P0 in g2/g4. (Measured in the tournament: going first is
  worth nothing - 178 wins vs 185.)
- Both sides get the same baseline brief (PLAYER.md), no strategy file.
- Both sides were told the matchup's known shape; neither was told how to play it.

## Result: SDSC 5-0 (4-0 discarding a contaminated game)

| duel | SDSC seat | winner | moves | final LP |
| --- | --- | --- | --- | --- |
| g1 | P0 (first) | **SDSC (Opus)** | 353 | 5800 vs -400 |
| g2 | P1 (second) | SDSC (Opus) - **DISCARDED, see below** | 110 | 7500 vs -350 |
| g3 | P0 (first) | **SDSC (Opus)** | 31 | 8000 vs 0 |
| g4 | P1 (second) | **SDSC (Opus)** | 141 | 8000 vs -1000 |
| g5 | P0 (first) | **SDSC (Opus)** | 113 | 9000 vs -1800 |

A 6-0 deficit became a 4-0 clean sweep the other way, with the decklists untouched.
**In this environment the pilot dominates the deck.**

### g2 is discarded, and why

g2 was played before the `MSG_CONFIRM_CARDS` privacy bug was found (manifest §17):
both seats were shown each other's entire deck - 32 cards to SDSC, 34 to SD2 - and
the Opus agent's own report says it used that to deduce the opponent's exact hand by
elimination. That makes g2 worthless as evidence regardless of who it favoured. The
other four duels are clean (audited: zero cross-owner deck reveals). The conclusion
does not depend on g2.

## What the winning pilot actually did - the interesting part

All four clean winners independently reported that **the deck's advertised engine
never appeared**: no Magical Citadel of Endymion, no Endymion, no six-Spell-Counter
payoff. In two duels Citadel was never even drawn. They won with the shell the deck's
own manual treats as a footnote:

- **Breaker the Magical Warrior + equips** (Mage Power counting the other equips and a
  set trap; Mist Body making it unattackable) as a 3100-3800 ATK beater.
- **Effect-based removal instead of battle**, specifically to deny Pyramid Turtle its
  death trigger - and to dodge **Ryu Kokki**, which auto-destroys any Spellcaster it
  battles. Never destroying a face-down by combat was a deliberate rule.
- **Magic Cylinder** reflecting a 2800 attacker for 35% of a life total.
- **Keeping everything face-down** against Dark Dust Spirit, which only hits face-up
  monsters.
- **Tower of Babel as a one-sided lock** (g2): the Zombie deck is 16 Spells, and the
  SDSC pilot controls whether it ever casts a 4th Spell itself.

One agent's summary is worth quoting as a hypothesis for the tournament number:
SDSC's 41.7% is probably *pilots forcing the slow Citadel plan*, when the deck's real
line is equip-beatdown plus Magic Cylinder.

## What this does and does not show

It shows that for these two decks, **a stronger pilot beats a two-tier deck gap** -
comfortably, and from both seats. It does NOT show the tournament's ranking is wrong:
that ranking is a statement about decks *at a fixed pilot strength*, which is exactly
what makes it a deck comparison. What it does suggest is that the ranking compresses
skill-hungry decks (SDSC, SDMP Pendulum) downward and rewards decks that win on raw
resilience (SD2's recursion), so the ordering should be read as "how forgiving is this
deck" as much as "how strong is this deck".

Sample size is five duels, one of them discarded. Treat it as a strong signal, not a
measurement.

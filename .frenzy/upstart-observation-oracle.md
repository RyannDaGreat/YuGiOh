# Upstart Goblin expected-observation oracle

Date: 2026-08-22

Purpose: a concise black-box oracle for a no-response activation of **Upstart Goblin** from the turn player's hand. It specifies external observations, not internal implementation. No production code was changed.

## Authorities

- Local printed database text (`node bin/ygo.js card 'Upstart Goblin'`): **“Draw 1 card, then your opponent gains 1000 LP.”** Passcode 70368879.
- Konami Official Rulebook v9, Normal Spell Cards (PDF p. 27 / printed p. 24): announce activation, place the card face-up on the field, resolve its effect, and after resolution send it to the GY: <https://www.yugioh-card.com/eu/wp-content/uploads/2022/07/Rulebook_v9_en.pdf>
- Same rulebook, Chains (PDF pp. 43–45 / printed pp. 40–42): the opponent gets a response opportunity before the effect changes the game; links resolve newest-to-oldest.
- Konami's official database independently prints the same Upstart text: <https://www.db.yugioh-card.com/yugiohdb/member_deck.action?cgid=cdd8519b27f74190555f8df272462cfc&dno=238&request_locale=en>

## Ordered externally visible steps

Assume player A activates from hand, player B adds no response, the draw succeeds, and no replacement effect changes LP or destination.

| Step | Required observation |
|---:|---|
| 0 | Upstart Goblin is identifiable in A's hand; it is not yet in the field or GY. A's hand has `H`, A's deck `D`, B's LP `L`. |
| 1 | The card is disclosed and travels **hand -> one face-up Spell & Trap Zone**. It visibly comes to rest on the field. A's hand is now `H-1`; GY is unchanged. |
| 2 | Activation emphasis is attached to that field card. The card remains in the same zone while B's response opportunity passes. No effect result has happened yet. |
| 3 | Resolution begins with the card still on the field. A card visibly travels **A's deck -> A's hand**. State becomes deck `D-1`, hand `H`; B's LP is still `L`. |
| 4 | Only after the draw is perceptible, B gains 1000 LP: `L -> L+1000`. The activating card is still represented on the field throughout this effect operation. |
| 5 | After both printed operations finish, Upstart travels **field -> A's GY** as a spent Normal Spell. It does not shake/explode as though destroyed. |
| 6 | Settled state: Upstart is face-up in A's GY; A has one fewer deck card and the same hand count as before activation; B has 1000 more LP. |

A cinematic enlargement at the Step 0→1 disclosure boundary is allowed but not rules-mandated. It must not substitute for the hand-to-field placement.

## Invariants

1. **Zone order:** `hand < field < GY`. No frame may first disclose Upstart in the GY and later resurrect a visual copy onto the field.
2. **Effect order:** `draw < opponent gain 1000 < spent movement`. The word **then** forbids presenting LP gain before or simultaneous with a successfully completed draw.
3. **Identity:** the drawn card originates at A's deck and lands in A's hand; the LP recipient is B, not A.
4. **Field persistence:** from placement through the draw and LP gain, the activation representation stays anchored to the chosen field zone.
5. **Chain truth:** the activation is Chain Link 1 internally and a legal response pause exists. With no added link, a large multi-card `CHAIN` stack/banner is unnecessary and must not imply another effect joined; activation emphasis is sufficient.
6. **No redundant narration:** readable motion/state is authoritative. A compulsory `DRAW` text popup is not part of the oracle; a deck-to-hand flight is. A `+1000` LP affordance may accompany the visibly counting LP because the amount is otherwise not spatially self-evident.
7. **No overlap:** each numbered semantic observation must become legible before the next begins. Persistent board objects may remain visible, but draw flight, LP-change emphasis, and GY flight do not execute concurrently.
8. **Stepability:** forward/back one-animation-step controls must stop on at least the boundaries after placement, activation/response, draw, LP gain, and GY cleanup. Reversing restores the exact preceding visible state; it does not replay an arbitrary tail of events over the later settled board.

## Predicted divergence from current program

Inspection was limited to existing fixtures/tests and presentation code; no separate backend audit was read.

### Certain fixture defect

`test/events.test.js`'s `spellFromHand` fixture is not an Upstart oracle. It emits no `DRAW` message at all and emits `RECOVER` to the activating player `p`, whereas Upstart draws for `p` and gives 1000 LP to `1-p`. Its asserted digest is therefore:

```text
move -> activate -> resolve -> recover(activator) -> move -> tograve
```

The necessary Upstart digest is at minimum:

```text
move(hand->field) -> activate(CL1) -> resolve(CL1)
-> draw(activator, 1) -> recover(opponent, 1000)
-> move(field->GY, spent) -> tograve(spent)
```

The existing test proves generic placement and cleanup ordering, but cannot catch either the missing draw animation or wrong LP recipient in an Upstart-specific path.

### Likely presentation divergences

- `Table.svelte` renders the already-settled board and reconstructs the activated Spell with a temporary `ghost`. This makes correctness timer-dependent: the true card is already in the GY at animation start, so a queue skip, initial render, long jump, or ghost timeout can expose `GY first` and/or an empty activation zone.
- First render intentionally marks all existing events seen and plays nothing. Opening/reloading at the post-activation move cannot satisfy the observation oracle; it shows only settled state.
- Long bursts retain only the last `MAX_BURST` events. A sufficiently busy move can discard the early hand->field/activation observations while retaining later effect/GY observations.
- Backward scrubbing replays only the last `REWIND_BEATS` over the destination replay state. That is not semantic reversal and cannot guarantee the oracle's intermediate states.
- The scheduler advances on fixed offsets (`STEP_MS` or `FAST_STEP_MS`) rather than animation completion. It prevents the normal card flight from exceeding a beat, but longer activation glow, float text, LP count animation, tosses, and ghost lifetime can overlap later steps. Thus “ordered event dispatch” does not imply “ordered perceptible observations.”
- The draw renderer correctly uses deck->hand flight and no draw text. `recover` uses a `+amount` float and LP counter animation, which is compatible by itself; correctness depends on receiving `player: 1-p` and waiting until draw motion is legible.
- Chain sound is already suppressed for `chainLink === 1`; this matches the oracle. The main remaining chain risk is any separate overlay not keyed to total link count.

## Minimal regression shape (future implementation)

A real or faithfully captured Upstart stream should be asserted at two levels:

1. Digest contract: exact event order and actors/destinations, especially `draw.player === A`, `recover.player === B`, and spent movement after both.
2. Presentation contract under a controllable clock: snapshots at each semantic boundary confirm the field card remains present; no draw/LP/GY overlap; one-step back/forward restores each snapshot exactly.

The test must use passcode `70368879` and name the card. Reusing an unrelated passcode plus a generic recovery-only fixture cannot establish Upstart behavior.

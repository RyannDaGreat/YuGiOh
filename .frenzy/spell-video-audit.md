# Master Duel spell/effect presentation audit

## Method and evidence limits

Independent inspection of Konami Master Duel footage:
<https://www.youtube.com/watch?v=-m8iv16PsH8> (16:45, "Endymion - Magical Citadel of
Endymion / Ranked Gameplay"). I formed the conclusions below before consulting any other agent's
analysis. Production code was not inspected or changed.

The opening was examined from the available 1080p partial stream at four frames/second. The full
recording was independently surveyed through YouTube's 320x180 storyboard at one frame per
3.547 seconds. Consequently, timestamps through 00:58 are quarter-second observations; later
timestamps are approximate to +/-1.8 seconds. The reference is edited gameplay and sometimes
retains the player's ordinary left-side card-information panel; that persistent panel is not an
activation banner.

## Timestamped observations

### Unchained Normal Spell: Upstart Goblin

- **00:35.00-00:35.75:** the hand card is inspected/selected; it is still in the hand and the
  ordinary card-information panel shows Upstart Goblin.
- **00:36.00-00:36.50:** the card leaves the hand and lands face-up in a Spell/Trap Zone. The
  field visibly dims only after placement.
- **00:36.75-00:37.50:** the face-up card in that zone emits the cyan/white activation pulse. It
  remains physically on the field. There is no full-screen `CHAIN` montage for this lone link.
- **about 00:38.00-00:38.75:** the deck-to-hand result occurs visually. No large `DRAW`,
  `DRAW CARD`, or prose result banner appears.
- **00:39.00-00:40.00:** only after the draw, the opponent's LP animates upward from 8000 to
  9000, with the compact `1000` delta above the LP display. Upstart remains face-up in its zone
  throughout both consequences.
- **00:40.25-00:41.00:** after the last consequence finishes, Upstart leaves the zone for the GY.
  This establishes that activation, resolution consequences, and destination are distinct visual
  steps, not one movement.

### Other activations in the opening

- **about 00:42-00:45 (Mythical Institution):** a Spell is placed face-up, then pulses on the
  field. Unlike Upstart, it remains after resolution because its rules make it a persistent card.
  Destination is therefore driven by the card/rules event, not by a generic "Spell resolved" cue.
- **about 00:47-00:50 (Spell Power Mastery):** another Normal Spell repeats the same spatial
  grammar: hand -> face-up zone -> activation pulse -> effect/result animation -> GY. Existing
  face-up cards receive compact in-world feedback rather than explanatory prose banners.
- **about 00:52-00:55 (Magister of Endymion and counter activity):** the affected card/zone glows
  and its small counter badge changes in place. The client does not cover the board with a sentence
  such as `+1 Spell Counter`; the changed object communicates the result.

### Real chain presentation

- **about 00:55.50-00:57.25:** two responding cards are shown as a deliberately staged pair of
  enlarged card faces, followed by the metallic linked-chain transition. This is qualitatively
  different from Upstart's lone activation.
- **about 01:46 (storyboard sample):** the recording clearly displays the large `2 CHAIN` graphic
  for a multi-link chain. The number belongs to the actual chain depth; it is not shown merely
  because any card activated.
- The chain presentation occupies its own beat. Card/result animations resume after it rather
  than being allowed to collide with it. Chain-linked cards are visually identified first; the
  resolution then proceeds one link at a time in reverse order, with each link's concrete board
  consequences visible before the next destination/change.

## General presentation contract inferred from the footage

1. **Commit/reveal before activation.** If a Spell/Trap is activated from hand or Set position,
   first reveal it and put/turn it face-up in its actual field zone. Activating an already face-up
   card/effect starts from that existing object instead. A card cannot visually begin in the GY.
2. **Activate at the source.** Pulse/highlight the real field card (or the monster/GY/banished
   source of an effect). An enlarged card face may briefly reinforce identity, but it does not
   replace the source's field state.
3. **Open a response window without inventing a chain spectacle.** Chain Link 1 can exist in the
   rules engine while receiving only the activation treatment. Reserve `CHAIN`, linked-card
   montage, chain count, and resolution transition for an actual multi-link chain or a moment where
   chain structure must be explained.
4. **Resolve causally and serially.** For each resolving link, show costs that were already paid,
   then each effect clause/result in engine order: movement, draw, LP delta, counter change,
   destruction, summon, and so on. Consequences must not be reordered for convenience.
5. **Move to the rules-defined destination last.** A one-shot Spell/Trap normally remains face-up
   through all of its resolution and moves to the GY afterward. Continuous/Equip/Field/Pendulum
   cards remain where the rules say; replacements, negation, destruction, and banishment can alter
   the destination. This must come from engine events/state, not card-type guesswork in the UI.
6. **Use object-level feedback for ordinary results.** Deck-to-hand motion means draw; LP numbers
   animate at the LP meter; counters change on their card; affected cards glow. Avoid redundant
   prose such as `DRAW CARD`, `+1 SPELL COUNTER`, `ACTIVATED`, or `SENT TO GRAVEYARD` when motion and
   state already communicate it.
7. **One major visual beat at a time.** Reveal/cut-in, chain montage, resolve cue, concrete result,
   and destination are queued beats. Major banners must replace/finish before the next starts, not
   overlap. Small persistent state indicators may coexist because they are attached to objects.

## What the back end must expose

The presentation can generalize if it consumes an ordered semantic event stream rather than
diffing snapshots or special-casing Upstart Goblin. At minimum each atomic event needs:

- stable action/chain identity, chain-link number, source card and source zone;
- reveal/placement/flip/activation events and response-window/chain-built boundaries;
- ordered cost and resolution-result events (draw, move, LP, counter, summon, destroy, negate,
  target, etc.);
- chain-solving/chain-solved/chain-end boundaries;
- the engine-confirmed final destination/reason for every moved card.

If the current bridge only exposes before/after board snapshots or coarse log strings, the UI
cannot reliably reconstruct clause order, distinguish a cost from an effect, know whether a real
multi-link chain exists, or delay the activated card's GY movement until its last consequence. The
appropriate fix is to preserve ocgcore's ordered messages as atomic replay steps, then let both
automatic playback and the requested step-forward/step-back controls traverse that same sequence.

# Independent Spell / Trap lifecycle audit

Date: 2026-08-22

Scope: rules and renderer semantics only. No production code was changed. This audit was made independently from other agents' conclusions.

## Finding

The general lifecycle is not `hand -> Graveyard -> activation display`. For a Normal Spell activated from the hand, the rules-visible order is:

1. The player announces activation and places the card face-up in an available Spell & Trap Zone.
2. Activation conditions, costs, targets, and other activation-time choices are handled as required by the card.
3. The activation becomes Chain Link 1 and both players receive the legal response opportunities. If nobody adds another link, it remains a one-link Chain for rules/engine purposes.
4. The Chain resolves in reverse link order. Within each resolving card text, distinct operations occur in the printed Problem-Solving Card Text order.
5. Only after its effect finishes resolving is a single-use Normal Spell sent from the field to the GY, unless another rule/effect changed its destination or removed it earlier.

This is a reusable contract, not an Upstart Goblin exception. Normal/Ritual Spells and Normal Traps are single-use; Continuous, Equip, Field, Pendulum-as-Spell, and Continuous Traps normally remain face-up after successful activation. Quick-Play describes activation timing, not an alternative zone lifecycle: a successfully resolved one-shot Quick-Play Spell is put away after resolution. A card/effect whose activation is negated, whose effect is negated, that leaves the field while resolving, or whose text gives a special destination needs to follow the actual engine messages rather than a guessed happy path.

## Authoritative evidence

- Konami's official Rulebook v9 says Spell/Trap Cards are placed face-up in a Spell & Trap Zone to activate; because activation occupies that zone, a Spell cannot be activated when all five spaces are occupied (PDF p. 7, printed p. 4): <https://www.yugioh-card.com/eu/wp-content/uploads/2022/07/Rulebook_v9_en.pdf>
- For a Normal Spell specifically, the rulebook says to announce activation and place it face-up on the field, resolve its written effect if activation succeeds, and **after resolving** send it to the GY (PDF p. 27, printed p. 24). This directly disproves presentation that moves it to the GY before activation/resolution.
- Normal Traps follow the same post-resolution GY rule (PDF p. 29, printed p. 26). Continuous Spells, Equip Spells, Field Spells, and Continuous Traps instead remain on the field after activation (PDF pp. 28 and 30, printed pp. 25 and 27).
- The chain chapter says an opponent must be offered a chance to respond before the first effect changes the game; links accumulate in activation order and resolve newest-to-oldest (PDF pp. 43–45, printed pp. 40–42). Thus Chain Link 1 exists even when no Chain Link 2 is added.
- Konami's official card database gives Upstart Goblin's current English text as `Draw 1 card, then your opponent gains 1000 LP.`: <https://www.db.yugioh-card.com/yugiohdb/member_deck.action?cgid=cdd8519b27f74190555f8df272462cfc&dno=238&request_locale=en>

## Upstart Goblin, derived without special-casing

Applying the generic lifecycle and the card's conjunction:

1. Reveal/presentation may enlarge the card as it leaves the hand (presentation choice).
2. Move hand -> chosen Spell & Trap Zone face-up (rules-visible state).
3. Show activation emphasis while the card remains in that zone.
4. Open/pass the response window. No second link means no multi-link chain ceremony is needed.
5. Resolve Chain Link 1.
6. Animate deck -> hand for the draw.
7. After the `then` boundary, animate opponent LP +1000.
8. After resolution completes, move Upstart Goblin field -> GY as spent.

The draw and LP gain should not overlap. They are ordered semantic sub-events, even though they belong to one resolving effect. A draw needs no redundant `Draw` caption when the deck-to-hand motion is legible. Likewise, a counter change can be conveyed by a glow/pulse and the updated counter display rather than compulsory explanatory text.

## Chain presentation policy

Rules semantics and presentation should remain separate:

- Always model an activation as a link, including a lone Chain Link 1, because response timing, negation, resolution, and debugging depend on it.
- Reserve a prominent `CHAIN` stack/banner for two or more links. A one-link activation can use the card's activation glow and response pause without claiming that no chain exists internally.
- Never emit or animate `chain resolved` before effect sub-events. `CHAIN_SOLVING(link)` begins that link's resolution; card movements, draws, LP changes, counters, summons, etc. belonging to the link follow; `CHAIN_SOLVED(link)` closes it.
- Resolve links newest-to-oldest, but preserve source-message order inside each link.

## Proposed renderer semantic state machine

The animation timeline should be a sequence of **semantic steps**, not timers attached independently to a final board snapshot.

```text
idle
  -> disclose_source              optional cinematic reveal; no state mutation
  -> place_or_flip_on_field       MOVE/POS_CHANGE into the activation slot
  -> activation_declared         CHAINING(link, source, slot)
  -> response_window              engine prompt/pass decisions; may append links
  -> chain_committed              links known; show chain UI iff linkCount >= 2
  -> resolving_link(N)            CHAIN_SOLVING(N)
       -> effect_substep*          ordered MOVE/DRAW/RECOVER/DAMAGE/COUNTER/etc.
  -> link_finished(N)             CHAIN_SOLVED / CHAIN_NEGATED / CHAIN_DISABLED
       -> resolving_link(N-1)*
  -> cleanup                      spent card MOVE field -> destination
  -> chain_end                    CHAIN_END
  -> idle / next decision
```

Required semantic step fields:

- stable `stepId`, source message index/range, and owning recorded move index;
- `kind`, `actor`, `sourceCard`, `sourceLocation`, `chainId`, `chainLink`;
- exact pre-state and post-state (or deterministic deltas), plus visibility/masking metadata;
- effect operation (`draw`, `gainLP`, `addCounter`, `moveCard`, etc.), not prose inferred from card name;
- disposition reason (`spent`, `destroyed`, `banished`, `returned`, `negated`) when known;
- presentation policy (`cinematic`, `glow`, `flight`, `silent`, `caption`) as a renderer concern layered over semantics.

The timeline owns sequencing: begin the next step only after the prior step's animation promise completes (or immediately in reduced-motion mode). This prevents overlapping captions, flights, and chain overlays. Forward/back micro-step controls move exactly one semantic-step boundary; existing previous/next-move controls continue to move one recorded engine response. Backward stepping should restore the saved pre-state and replay that step, not guess an inverse animation.

## Backend accessibility

The engine already exposes enough ordered facts for most of this. `src/events.js` receives masked ocgcore messages including `MOVE`, `POS_CHANGE`, `CHAINING` with `chain_size`, `CHAIN_SOLVING`, `CHAIN_SOLVED`/negation, `CHAIN_END`, `DRAW`, LP recovery/damage, counter mutations, summons, and other movements. Its own Normal Spell example already extracts:

`move -> activate -> resolve -> recover -> move -> tograve`

Therefore the main confusion is not that ocgcore lacks ordering. It is that the current digest/render layer flattens messages into independently timed animations while drawing the already-final board, then reconstructs a temporary activation card with a ghost. The raw message stream should be grouped into explicit chain/link/substep transactions before presentation.

Limits do remain: the core often reports ordered state mutations rather than human-language causal labels. `src/events.js` already infers reasons such as `spent` from chain windows. Where exact causality is ambiguous, preserve `unknown` rather than inventing it; semantic animation can still show the literal movement/state change. Do not parse arbitrary card text to drive core ordering—the engine message order is authoritative.

## General acceptance checks

- A Normal Spell visibly occupies its activation zone from placement through its effect sub-events and only then travels to the GY.
- Set Traps/Quick-Play Spells flip in place before activation; they do not teleport through the GY.
- Persistent Spell/Trap types remain on field after resolution unless an actual engine move removes them.
- A lone link gets an activation/readable response beat but no oversized multi-link chain banner.
- Two-plus-link chains visibly build in activation order and resolve in reverse order.
- Distinct engine operations never overlap unless a specifically authored presentation declares them simultaneous.
- Micro-step backward/forward traverses placement, activation, each link, each meaningful effect mutation, cleanup, and chain end deterministically.
- Hidden information remains masked in both semantic step snapshots and cinematics.


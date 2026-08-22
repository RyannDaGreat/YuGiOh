# Independent spell/effect backend audit

Date: 2026-08-22  
Scope: read-only audit; no behavior was implemented.

## Bottom line

The rules engine is not withholding the ordering needed for a correct generic spell/effect presentation. `ocgcore-wasm` emits an authoritative ordered message stream containing card placement, activation identity, chain-link identity, resolution boundaries, draws, LP changes, counters, targets, later movement, and chain end. The current backend preserves that stream only transiently, then gives the table (a) one fully settled board and (b) a lossy cosmetic digest. The table consequently animates earlier events over the board from after the entire response finished. The ghost-card workaround cannot make that model generally correct.

The robust fix is a presentation timeline derived from the masked core stream: ordered semantic steps with stable step IDs, explicit grouping/causality, and a visual state before and after each step. The scrubber can then address `(response position, semantic step)` instead of only a response count. Backward stepping renders the previous snapshot; it does not attempt to reverse timers or mutate the duel record.

## Actual data path

1. `src/duel.js::replayDuel` reconstructs the duel and appends every decoded core message to one ordered `messages` array. A stored "move" is actually one answer to a pending core question; one answer can yield many messages and may stop partway through an effect when another answer is required.
2. `src/session.js::viewDuel` truncates **responses**, not messages, replays that prefix, masks the resulting stream for the viewer, and computes:
   - a final `collectState(...)` board from the core handle;
   - a text log from the masked stream;
   - `extractEvents(masked, ...)`, whose `i` is the index in that viewer's post-mask message stream.
3. `web/src/lib/engine.js::duelPayload` returns the one settled `state` plus the complete digest `events`. It returns no intermediate visual snapshots, no response-to-message boundaries, and no semantic-step cursor.
4. `Table.svelte` remembers only the last event index. On a later payload it diffs `i`, schedules events with `setTimeout`, and draws all of them over the newly settled board. Poll batches queue, but lag, long bursts, backwards scrubs, and the final-state mismatch can still skip or falsify intermediate presentation.
5. The page scrubber addresses response prefixes (`at = 0..responses.length`). Its previous/next buttons therefore mean previous/next engine answer, not previous/next activation/effect/cleanup step.

## What the core authoritatively provides

For generic activations, the decoded schemas already expose:

- `MOVE`: card code and exact `from`/`to` coordinates and positions. The wrapper does **not** expose the core MOVE reason.
- `CHAINING`: activating card code; physical coordinate; triggering controller/location/sequence; effect-description ID; and `chain_size`.
- `CHAINED`, `CHAIN_SOLVING`, `CHAIN_SOLVED`, `CHAIN_NEGATED`, `CHAIN_DISABLED`, `CHAIN_END`: authoritative chain/link boundaries.
- Consequences in stream order: `DRAW` (player and each drawn card code/position, subject to masking), `RECOVER`, `DAMAGE`, `PAY_LPCOST`, `LPUPDATE`, `ADD_COUNTER`, `REMOVE_COUNTER`, `BECOME_TARGET`, `CARD_TARGET`, `EQUIP`, `POS_CHANGE`, `MOVE`, summons, reveals, shuffles, coin/dice results, etc.

A typical uncontested Upstart Goblin therefore has enough information to present: hand to S/T zone, activation/reveal, link resolving, draw, opponent LP recovery, card leaving for the graveyard, chain end. The precise core order is the authority; card text should not be parsed to invent the sequence. A response window may divide that sequence across stored responses, which is why response count cannot double as animation-step count.

The core calls even an uncontested activation a one-link chain internally. That is useful protocol data, but it does not require a visible "CHAIN 1" ceremony. Visible chain presentation should begin only when a second link exists; link 1 may simply read as activation/resolution.

## Information the current digest loses or guesses

- `resolve` retains only `chainLink`; it drops the activating card code, coordinate, controller, triggering coordinate, and effect-description ID that `CHAINING` supplied.
- Draw extraction reduces `DRAW.drawn[]` to `{player, count}`, losing visible card identities and the exact message payload.
- Consequence events (`draw`, `recover`, `counter`, moves, targets) are not linked to the resolving chain link/effect. Stream adjacency is available during extraction but discarded.
- Events have no stable semantic-step ID, response boundary, group ID, `causedBy`, or before/after state.
- `MOVE.reason` is unavailable from the wrapper. `effect`, `battle`, `tribute`, and `spent` are heuristic window classifications. These are useful presentation annotations, not rules authority, and must be labelled as such in the model.
- `move` plus `tograve` currently produces two scheduled beats for one physical relocation. Similar dual raw/semantic events risk duplicate or contradictory visuals. They should be coalesced into one semantic relocation step with tags/cues, not independently scheduled.
- `extractEvents` ignores many decoded messages (`CHAINED`, `CHAIN_SOLVED`, targets, hints, relation changes, LPUPDATE, and others), so "last event index" is not a complete progress cursor. A payload may advance meaningfully while the digest tail does not.
- Indices are after viewer masking. They are deterministic for one viewer/replay, but they are not global message identities and must not be shared across perspectives.
- Persistent physical-card identity is not supplied. Coordinates plus code work for many moves, but duplicate hidden cards and list reordering are ambiguous. A presentation projection needs viewer-local synthetic instance tokens carried forward through message application; those tokens are presentation-only and reveal no extra information.

## Why current scheduling produces the reported nonsense

`Table.svelte` receives the board after the spell has resolved and reached the graveyard, then attempts to replay "move onto field" and "activate" over it. The source hand slot may already be gone, the S/T slot is empty, LP/counters/hand already show their final values, and later reflow has already occurred. `standIn` manufactures a temporary card only for activation and `anchorRect` falls back for missing pile/hand slots. Those patches improve a narrow Normal Spell case but cannot synchronize all effects with their intermediate state.

Other concrete scheduling problems:

- A six-event activation is timed as six equally spaced cosmetic events even though `move` + `tograve` can describe one action and `resolve` may be only a boundary.
- `resolve` always plays a cue, even for a single uncontested link; combined with activation text and final-state visuals this reads as a fictitious chain event.
- Draw uses a generic deck-to-hand flyer and a draw sound, while the settled hand already contains the card. Text/log and floating labels can overlap because independent durations (`FLOAT_MS`, `ACTIVATE_MS`, LP tween duration, beat delay) are not governed by one clock.
- `MAX_BURST`, fast mode, lag flushing, and backwards-tail replay deliberately discard or replay subsets. Those are incompatible with a debugging control that promises exact semantic steps.
- Auto-play advances response positions every 1100 ms while a normal activation's queue can exceed that duration, so the scrubber can replace/queue state faster than the prior position visually finishes.

## Recommended presentation-timeline contract

Derive this only from the **masked** message stream so it preserves the existing information boundary. Keep rules state and presentation state separate.

Each step should minimally carry:

```text
id: viewer-local deterministic ID (response index + source-message range + ordinal)
response: stored response whose processing emitted it
source: inclusive masked-message range
kind: reveal | relocate | activate | resolve | draw | lp | counter | target | summon | ...
group: activation/chain ID, when applicable
link: chain-link number, when applicable
actor/sourceCard/effectDescription: retained from CHAINING
causedBy: resolving link/group when authoritative from the open resolution window
annotations: inferred fields such as moveReason, explicitly non-authoritative
before, after: viewer-safe visual projections (or a reversible patch plus checkpoints)
cues: presentation suggestions, not extra timeline steps
```

Build it in one pass while applying masked messages to an expanded presentation field model. Coalesce messages that describe the same physical action: for example S/T-zone-to-GY `MOVE` plus the derived `tograve` cue is one relocation step tagged `spent`. Conversely, preserve ordered independent consequences: Upstart's draw and opponent LP gain are separate steps. Counter additions are separate state changes but normally need only a restrained card glow/pulse, not explanatory `+1 counter` text.

Chain grouping should be structural:

- Open a group on the first `CHAINING`, retain every link's full identity.
- A second `CHAINING` turns on visible chain presentation for the group.
- `CHAIN_SOLVING(n)` opens authoritative causality for subsequent consequence messages until `CHAIN_SOLVED(n)`/negation/disable.
- Cleanup movement after the solved boundary but before `CHAIN_END` remains associated with the activation group and activating card; it is not an effect consequence.
- If the core pauses for a response, persist the open group/link context in the derived timeline across the next response batch. Re-deriving from the full prefix makes this deterministic without storing new duel data.

Do not parse card text to determine effect order. The decoded messages already supply actual realized consequences, including replacement effects, negations, optional branches, and unusual destinations.

## Reversible semantic-step navigation

Use a UI-only cursor `(responseAt, stepOrdinal)`, with canonical ordering across the full derived timeline. `responseAt` remains the forkable game position; `stepOrdinal` is a presentation position inside the messages emitted while reaching it.

- Step forward: cancel/settle any running tween, select the next step, render its `before`, play exactly that transition, then hold its `after`.
- Step backward: cancel/settle, select the previous step, and render that step's `after` (or the current step's `before`) directly. Do not play an inverse sound or infer an inverse core action.
- Move previous/next: retain their existing response-prefix meaning and land on the first/last semantic boundary by a documented rule.
- Manual semantic stepping must never use `MAX_BURST`, lag dropping, polling replacement, or tail replay. It is lossless and deterministic.
- At live, newly derived steps append by stable ID. Polling cannot replay existing steps; a backward/fork/reload derives the same IDs again.
- Forking remains legal only at a stored response boundary, never at an intra-response visual step, because no additional engine response exists there.
- If a response ends at a pending prompt mid-chain, that is a real stable step boundary and its derived visual `after` state is shown.

Full snapshots are simplest and likely cheap for this two-player board. If memory later matters, store reversible presentation patches with periodic full checkpoints; the API contract should still expose deterministic `before`/`after` semantics.

## One animation clock and compact speed control

Introduce one presentation `AnimationClock` used by both scheduled beat delays and every tween/effect duration. Store unscaled base durations in semantic steps/cues; the clock applies the time scale. Remove component-local timing authority (`STEP_MS`, LP tween timing, flyer/float/flash timeouts, CSS animation durations) by routing them through the clock or clock-controlled CSS variables.

Recommended toolbar control:

- compact logarithmic slider, `0.1×` to `4×`, with detents at `0.25×`, `0.5×`, `1×`, `2×`, and `4×`;
- a separate pause/play button (pause is clearer than overloading slider value zero);
- persist speed in `localStorage` as a presentation preference, not in the duel record, URL, backend, or replay state;
- default `1×`; validate the persisted finite value and fail visibly/reset with an explicit report if malformed, consistent with the project's no-silent-failure rule.

Changing speed affects only wall-clock interpolation and deliberate dwell. It must never change ordering, grouping, snapshots, semantic cursor, response cursor, or fork position. When paused, manual step buttons should still deterministically settle exactly one selected step; they may show the transition at the chosen slow speed or provide a separate "settle immediately" behavior, but they must not depend on a timer completing. A practical clock API is `schedule(baseDelay, callback)`, `duration(baseMs)`, `pause/resume`, `setRate`, and `cancelGroup`; rescaling an in-flight animation uses elapsed **logical** time rather than restarting it.

## Backend answer to the user's question

Yes: the engine/backend already knows most of what is needed, and it knows it generically. It emits the actual consequence order rather than merely card text. The confusion is introduced after decoding because the backend collapses all intermediate states into one settled snapshot and strips effect/link causality from the cosmetic event digest. The missing pieces are primarily a richer presentation projection and timeline contract. The one genuine upstream limitation is that the wrapper does not expose MOVE reason or persistent physical-card IDs; reason can remain a clearly marked inference, while viewer-local synthetic identities can support presentation without altering rules or hidden information.

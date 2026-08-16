/**
 * Cross-check test: the message-derived field model (field.js, fed by the
 * masked stream) against the masked core query (state.js) at every decision
 * point of random duels, for both players and the spectator.
 *
 * Why this matters: view.js (masking) and field.js (client model) are written
 * independently from the same server rules. If either drops, mislabels, or
 * leaks a card, they disagree here — this is the guard on the hidden-
 * information boundary.
 *
 * Invariants:
 *   - Wherever the core says a card is visible to the viewer, the model holds
 *     the same code (never a wrong one, never missing).
 *   - Wherever the core says hidden, the model holds 0 or the true code; and
 *     if it holds the true code, that card was legitimately revealed to the
 *     viewer earlier (MSG_CONFIRM_CARDS, or it was face-up at some point). A
 *     known-but-never-revealed card is a masking leak.
 *   - The opponent's hand is never named.
 *   - LP, deck counts, hand/GY/banished lists agree.
 *
 * Run: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";
import { expandDeck, replayDuel, STARTING_LP } from "../src/duel.js";
import { renderLog } from "../src/log.js";
import { buildMenu, chooseFromMenu, hintsBefore } from "../src/menu.js";
import { randomChoice } from "../src/session.js";
import { isVisible, queryLocation } from "../src/state.js";
import { loadDeck } from "../src/store.js";
import { maskStream, SPECTATOR } from "../src/view.js";

const DECKS = [loadDeck("yugi").main, loadDeck("kaiba").main];
const DECK_SIZES = DECKS.map((d) => expandDeck(d).length);
/** Decisions per random duel; enough to reach battle, flips, tributes, traps. */
const STEPS_PER_DUEL = 250;
const SEEDS = [11, 12, 13];

/**
 * Pure function. Per slot: {code, visible} as the core sees it for `viewer`.
 */
function coreSlots(core, handle, controller, location, viewer) {
  return queryLocation(core, handle, controller, location).map((c) => (c === null ? null : { code: c.code, visible: isVisible(c, controller, location, viewer) }));
}

/**
 * Pure function. Codes the viewer's stream legitimately revealed to them: shown
 * via CONFIRM_CARDS, or seen face-up on the field at some point.
 */
function revealedCodes(masked) {
  const codes = new Set();
  for (const m of masked) {
    if (m.type === OcgMessageType.CONFIRM_CARDS) for (const c of m.cards) codes.add(c.code);
    if (m.type === OcgMessageType.POS_CHANGE) codes.add(m.code);
    if (m.type === OcgMessageType.MOVE && m.card !== 0 && (m.to.position & OcgPosition.FACEUP)) codes.add(m.card);
    if ([OcgMessageType.SUMMONING, OcgMessageType.SPSUMMONING, OcgMessageType.FLIPSUMMONING, OcgMessageType.CHAINING].includes(m.type)) codes.add(m.code);
  }
  return codes;
}

for (const seed of SEEDS) {
  test(`model matches masked core query throughout random duel (seed ${seed})`, async () => {
    const responses = [];
    for (let step = 0; step < STEPS_PER_DUEL; step++) {
      const r = await replayDuel({ seed, decks: DECKS, responses });
      try {
        if (r.ended) break;
        for (const viewer of [0, 1, SPECTATOR]) {
          const masked = maskStream(r.messages, viewer);
          const { field } = renderLog(masked, { viewer, startingLP: STARTING_LP, deckSizes: DECK_SIZES });
          const coreField = r.core.duelQueryField(r.handle);
          for (const p of [0, 1]) {
            const where = `seed ${seed} step ${step} viewer ${viewer} player ${p}`;
            assert.equal(field.players[p].lp, coreField.players[p].lp, `LP ${where}`);
            assert.equal(field.players[p].deckCount, coreField.players[p].deck_size, `deck count ${where}`);

            const revealed = revealedCodes(masked);
            const checkSlot = (slot, truth, label) => {
              if (truth === null) {
                assert.equal(slot, null, `expected empty ${label}`);
                return;
              }
              assert.ok(slot, `missing ${label}`);
              if (truth.visible) {
                assert.equal(slot.code, truth.code, `code at ${label}`);
              } else if (slot.code !== 0) {
                assert.equal(slot.code, truth.code, `wrong remembered code at ${label}`);
                assert.ok(revealed.has(slot.code), `LEAK: model knows never-revealed hidden card at ${label}`);
              }
            };
            for (const [key, location] of [["mzone", OcgLocation.MZONE], ["szone", OcgLocation.SZONE]]) {
              coreSlots(r.core, r.handle, p, location, viewer).forEach((truth, seq) => checkSlot(field.players[p][key][seq], truth, `${key}[${seq}] ${where}`));
            }
            for (const [key, location] of [["hand", OcgLocation.HAND], ["grave", OcgLocation.GRAVE], ["removed", OcgLocation.REMOVED]]) {
              const truth = coreSlots(r.core, r.handle, p, location, viewer).filter((c) => c !== null);
              const model = field.players[p][key];
              assert.equal(model.length, truth.length, `${key} length ${where}`);
              truth.forEach((t, i) => checkSlot(model[i], t, `${key}[${i}] ${where}`));
            }
            if (viewer !== SPECTATOR && viewer !== p) {
              assert.ok(field.players[p].hand.every((s) => s.code === 0), `opponent hand leaked ${where}`);
            }
          }
        }
        // Answer via the menu path, which also fuzzes menu building/parsing.
        const asked = r.pending.player;
        const askedView = maskStream(r.messages, asked);
        const { field } = renderLog(askedView, { viewer: asked, startingLP: STARTING_LP, deckSizes: DECK_SIZES });
        const menu = buildMenu(askedView[askedView.length - 1], { ...hintsBefore(askedView), field });
        responses.push(chooseFromMenu(menu, randomChoice(menu, seed * 100000 + step)));
      } finally {
        r.core.destroyDuel(r.handle);
      }
    }
  });
}

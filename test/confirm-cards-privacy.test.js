/**
 * Regression tests for MSG_CONFIRM_CARDS privacy.
 *
 * The bug: a reveal out of a Deck was treated as private to `msg.player`, the
 * player being SHOWN the cards. For a "both players banish every copy" effect
 * (Nobleman of Crossout) the core addresses that message to the opponent of the
 * deck being searched — so a seat was handed its opponent's ENTIRE deck list, and
 * from that their exact hand by elimination. That is the one thing the "unseen"
 * pool exists to prevent. Found 2026-08-17 in a live duel, where an agent used it
 * to read a hand and said so in its report.
 *
 * The contract now: a Deck/Extra reveal is visible only to the player who
 * CONTROLS the revealed cards. Hand and graveyard reveals stay public, because
 * those happen at the table.
 *
 * Run: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { OcgLocation, OcgMessageType } from "ocgcore-wasm";
import { maskMessage } from "../src/view.js";

/** Two cards sitting in P0's deck, as the core reports them for a search. */
const p0DeckCards = [
  { code: 11, controller: 0, location: OcgLocation.DECK, sequence: 0, position: 0 },
  { code: 22, controller: 0, location: OcgLocation.DECK, sequence: 1, position: 0 },
];

test("a deck search is hidden from the opponent even when addressed to them", () => {
  // This is the exact shape that leaked: the cards are P0's, the message is
  // addressed to P1, and P1 must NOT see it.
  const msg = { type: OcgMessageType.CONFIRM_CARDS, player: 1, cards: p0DeckCards };
  assert.equal(maskMessage(msg, 1), null, "P1 must not see P0's deck");
  assert.deepEqual(maskMessage(msg, 0), msg, "P0 searching its own deck still sees it");
  assert.deepEqual(maskMessage(msg, 2), msg, "the spectator is omniscient by design");
});

test("a player's own deck search stays visible to them", () => {
  const msg = { type: OcgMessageType.CONFIRM_CARDS, player: 0, cards: p0DeckCards };
  assert.deepEqual(maskMessage(msg, 0), msg);
  assert.equal(maskMessage(msg, 1), null);
});

test("hand and graveyard reveals remain public at the table", () => {
  for (const location of [OcgLocation.HAND, OcgLocation.GRAVE]) {
    const msg = {
      type: OcgMessageType.CONFIRM_CARDS,
      player: 0,
      cards: [{ code: 33, controller: 0, location, sequence: 0, position: 0 }],
    };
    assert.deepEqual(maskMessage(msg, 1), msg, `a ${location} reveal is shown to both seats`);
  }
});

test("a mixed reveal is hidden unless every card belongs to the viewer", () => {
  // Nobleman of Crossout banishes copies from BOTH decks; if the core ever bundles
  // them into one message, neither seat may see the pair.
  const mixed = {
    type: OcgMessageType.CONFIRM_CARDS,
    player: 0,
    cards: [
      { code: 11, controller: 0, location: OcgLocation.DECK, sequence: 0, position: 0 },
      { code: 11, controller: 1, location: OcgLocation.DECK, sequence: 0, position: 0 },
    ],
  };
  assert.equal(maskMessage(mixed, 0), null);
  assert.equal(maskMessage(mixed, 1), null);
});

/**
 * Unit tests for web/src/lib/pretty/countMenu.js — the pure helpers behind the
 * count-distribution UI for "counters"-mode menus (SELECT_COUNTER "remove N
 * counters"). One counts array is the source of truth on the duel page; these
 * helpers parse the caps ("(has N)") and needed total from the menu's own
 * strings, step/bump the array, and translate it to and from the "1:2,3:1"
 * text the engine's chooseFromMenu has always parsed.
 *
 * Every label and title here is a form src/menu.js buildMenu actually produces.
 *
 * Run: npm test
 */

import "../src/volume-node.js";
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseFromMenu } from "../src/menu.js";
import { bumpedAt, capOf, countsReady, countsToText, neededOf, steppedAt, textToCounts, totalOf } from "../web/src/lib/pretty/countMenu.js";

// The labels/title of the menu that motivated the feature (Shadow Spectre
// Endymion: Jackal King's "remove 3 counters" cost across three cards).
const LABELS = [
  "Mythical Beast Jackal King (P0 m0) (has 4)",
  "Mythical Institution (P0 s1) (has 2)",
  "Mythical Institution (P0 s2) (has 2)",
];
const TITLE = "P0: remove 3 counter(s) of type #1 — answer as option:count, e.g. 1:2";
const CAPS = [4, 2, 2];

test("capOf reads the (has N) cap; null when a label has none", () => {
  assert.deepEqual(LABELS.map(capOf), CAPS);
  assert.equal(capOf("Skilled Dark Magician (P0 m1) (has 3)"), 3);
  assert.equal(capOf("End turn"), null);
  assert.equal(capOf("Sangan (P0 m2) [1000]"), null); // a SELECT_SUM amount is not a cap
});

test("neededOf reads the exact total from the counters title; null elsewhere", () => {
  assert.equal(neededOf(TITLE), 3);
  assert.equal(neededOf("P1: remove 12 counter(s) of type #2 — answer as option:count, e.g. 1:2"), 12);
  assert.equal(neededOf("P0: choose a main phase action"), null);
});

test("countsToText spells counts as option:count pairs, omitting zeros", () => {
  assert.equal(countsToText([2, 0, 1]), "1:2,3:1");
  assert.equal(countsToText([0, 1, 0]), "2:1");
  assert.equal(countsToText([0, 0, 0]), "");
});

test("textToCounts parses valid text to a full-length array", () => {
  assert.deepEqual(textToCounts("1:2,3:1", CAPS), [2, 0, 1]);
  assert.deepEqual(textToCounts(" 2:1 ", CAPS), [0, 1, 0]); // whitespace tolerated
  assert.deepEqual(textToCounts("", CAPS), [0, 0, 0]); // clearing the box resets
  assert.deepEqual(textToCounts("1:0", CAPS), [0, 0, 0]); // an explicit zero is a zero
  assert.deepEqual(textToCounts("1:1,1:2", CAPS), [2, 0, 0]); // last pair wins, as in chooseFromMenu
});

test("textToCounts is null for text that is not (yet) an answer", () => {
  assert.equal(textToCounts("1:", CAPS), null); // mid-typing
  assert.equal(textToCounts("1", CAPS), null);
  assert.equal(textToCounts("banana", CAPS), null);
  assert.equal(textToCounts("0:1", CAPS), null); // no option 0
  assert.equal(textToCounts("4:1", CAPS), null); // out of range
  assert.equal(textToCounts("2:3", CAPS), null); // over that card's cap
});

test("text and counts round-trip through each other", () => {
  for (const counts of [[2, 0, 1], [0, 2, 1], [3, 0, 0], [0, 0, 0]]) {
    assert.deepEqual(textToCounts(countsToText(counts), CAPS), counts);
  }
});

test("steppedAt clamps into 0..cap; bumpedAt wraps past the cap", () => {
  assert.deepEqual(steppedAt([2, 0, 0], 1, +1, CAPS[1]), [2, 1, 0]);
  assert.deepEqual(steppedAt([2, 2, 0], 1, +1, CAPS[1]), [2, 2, 0]); // at the cap: stays
  assert.deepEqual(steppedAt([2, 0, 0], 1, -1, CAPS[1]), [2, 0, 0]); // at 0: stays
  assert.deepEqual(steppedAt([0, 0, 0], 0, +1, null), [1, 0, 0]); // uncapped label
  assert.deepEqual(bumpedAt([0, 0, 0], 0, CAPS[0]), [1, 0, 0]);
  assert.deepEqual(bumpedAt([4, 0, 0], 0, CAPS[0]), [0, 0, 0]); // at the cap: wraps to 0
});

test("totalOf and countsReady gate the Confirm button", () => {
  assert.equal(totalOf([2, 0, 1]), 3);
  assert.equal(countsReady([2, 0, 1], CAPS, 3), true);
  assert.equal(countsReady([2, 0, 0], CAPS, 3), false); // one short
  assert.equal(countsReady([2, 1, 1], CAPS, 3), false); // one over
  assert.equal(countsReady([5, 0, 0], CAPS, 5), false); // over the card's cap
  assert.equal(countsReady([0, 0, 0], CAPS, 3), false);
  assert.equal(countsReady([1, 0, 0], CAPS, null), true); // no stated total: any positive
  assert.equal(countsReady([0, 0, 0], CAPS, null), false);
});

test("Confirm's text is the exact syntax the engine's one parser accepts", () => {
  // A counters menu as buildMenu shapes it (chooseFromMenu only reads items/mode/build).
  const menu = { items: LABELS.map((label, i) => ({ label, value: i })), mode: "counters", min: 1, max: 3, zero: null, build: (counts) => ({ counters: counts }) };
  assert.deepEqual(chooseFromMenu(menu, countsToText([2, 0, 1])), { counters: [2, 0, 1] });
  assert.deepEqual(chooseFromMenu(menu, countsToText([0, 2, 1])), { counters: [0, 2, 1] });
});

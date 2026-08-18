/**
 * Unit tests for the pure menu/session helpers: choice parsing, field-mask
 * decoding, hint freshness, and the auto-pass rule.
 *
 * Run: npm test
 */

// Installs the real filesystem as the app volume (src/volume.js) and cards.cdb
// as the card source (src/cardsource.js).
import "../src/volume-node.js";
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { OcgHintTiming, OcgLocation, OcgMessageType, OcgResponseType } from "ocgcore-wasm";
import { buildMenu, chooseFromMenu, chosenOption, disambiguate, fillTemplate, hintsBefore, selectableZones, timingWords } from "../src/menu.js";
import { shouldAutoPass } from "../src/session.js";
import { moveHidesCode } from "../src/view.js";

const NO_CTX = { selectHint: 0n, eventHint: 0n, field: null };

test("yes/no menu round-trips choices", () => {
  const menu = buildMenu({ type: OcgMessageType.SELECT_YESNO, player: 0, description: 0n }, NO_CTX);
  assert.deepEqual(menu.items.map((i) => i.label), ["Yes", "No"]);
  assert.deepEqual(chooseFromMenu(menu, "1"), { type: OcgResponseType.SELECT_YESNO, yes: true });
  assert.deepEqual(chooseFromMenu(menu, "2"), { type: OcgResponseType.SELECT_YESNO, yes: false });
  assert.throws(() => chooseFromMenu(menu, "3"), /out of range/);
  assert.throws(() => chooseFromMenu(menu, "0"), /not an option/);
  assert.throws(() => chooseFromMenu(menu, "1,2"), /exactly one/);
});

test("select-card menu enforces min/max and cancel", () => {
  const selects = [0, 1, 2].map((i) => ({ code: 0, controller: 1, location: OcgLocation.MZONE, sequence: i, position: 1 }));
  const menu = buildMenu({ type: OcgMessageType.SELECT_CARD, player: 0, can_cancel: true, min: 1, max: 2, selects }, NO_CTX);
  assert.deepEqual(chooseFromMenu(menu, "1,3"), { type: OcgResponseType.SELECT_CARD, indicies: [0, 2] });
  assert.deepEqual(chooseFromMenu(menu, "0"), { type: OcgResponseType.SELECT_CARD, indicies: null });
  assert.throws(() => chooseFromMenu(menu, "1,2,3"), /choose 1-2/);
  assert.throws(() => chooseFromMenu(menu, "2,2"), /duplicate/);
});

test("chosenOption inverts chooseFromMenu, and declines to guess a multi-pick", () => {
  const yesNo = buildMenu({ type: OcgMessageType.SELECT_YESNO, player: 0, description: 0n }, NO_CTX);
  assert.deepEqual(chosenOption(yesNo, chooseFromMenu(yesNo, "1")), { choice: "1", index: 0, label: "Yes" });
  assert.deepEqual(chosenOption(yesNo, chooseFromMenu(yesNo, "2")), { choice: "2", index: 1, label: "No" });
  assert.equal(chosenOption(yesNo, { type: OcgResponseType.SELECT_YESNO, yes: null }), null, "no near-misses");
  assert.equal(chosenOption(null, { type: 3, yes: true }), null);

  const selects = [0, 1, 2].map((i) => ({ code: 0, controller: 1, location: OcgLocation.MZONE, sequence: i, position: 1 }));
  const cards = buildMenu({ type: OcgMessageType.SELECT_CARD, player: 0, can_cancel: true, min: 1, max: 2, selects }, NO_CTX);
  // A single pick inverts; the cancel ("0") option inverts; two picks are combinatorial, so null.
  assert.equal(chosenOption(cards, chooseFromMenu(cards, "3")).choice, "3");
  assert.equal(chosenOption(cards, chooseFromMenu(cards, "0")).choice, "0");
  assert.equal(chosenOption(cards, chooseFromMenu(cards, "1,3")), null);
});

test("field mask: set bit = unavailable, low half = asking player", () => {
  const all = 0xffffffff;
  assert.deepEqual(selectableZones(all ^ 0b11, 0).map((z) => z.label), ["P0 m0", "P0 m1"]);
  assert.deepEqual(selectableZones(all ^ (1 << 8), 1).map((z) => z.label), ["P1 s0"]);
  assert.deepEqual(selectableZones(all ^ (1 << 16), 1).map((z) => z.label), ["P0 m0"]);
  assert.deepEqual(selectableZones(all ^ (1 << 13), 0).map((z) => z.label), ["P0 field"]);
});

test("timing words and template filling", () => {
  assert.equal(timingWords(OcgHintTiming.SUMMON), "after a normal summon");
  assert.equal(timingWords(0), "");
  assert.equal(fillTemplate('Use the effect of "%ls" from [%ls]?', ["Trap Hole", "s1"]), 'Use the effect of "Trap Hole" from [s1]?');
  assert.equal(fillTemplate("Your choice: [{}]", ["Yes"]), "Your choice: [Yes]");
});

test("duplicate labels get effect ordinals", () => {
  assert.deepEqual(disambiguate([{ label: "a" }, { label: "a" }, { label: "b" }]).map((i) => i.label), ["a (effect #1)", "a (effect #2)", "b"]);
});

test("hintsBefore: select hint consumed by intervening question, event hint goes stale", () => {
  const H = OcgMessageType.HINT;
  assert.equal(hintsBefore([{ type: H, hint_type: 3, hint: 502n }, { type: 15 }]).selectHint, 502n);
  assert.equal(hintsBefore([{ type: 15 }, { type: H, hint_type: 3, hint: 502n }, { type: 11 }, { type: 15 }]).selectHint, 0n);
  assert.equal(hintsBefore([{ type: H, hint_type: 1, hint: 23n }, { type: 16 }]).eventHint, 23n);
  assert.equal(hintsBefore([{ type: H, hint_type: 1, hint: 23n }, { type: 11 }, { type: 16 }]).eventHint, 0n);
});

test("shouldAutoPass honours ask-for / ask-at and never passes forced chains", () => {
  const chain = (timing, forced = false) => ({ type: OcgMessageType.SELECT_CHAIN, forced, hint_timing: timing, hint_timing_other: 0 });
  const menu = { items: [{ label: "Activate Trap Hole (P1 s2)" }] };
  assert.equal(shouldAutoPass(menu, chain(OcgHintTiming.DRAW), { askFor: [], askAt: [] }), true);
  assert.equal(shouldAutoPass(menu, chain(OcgHintTiming.SUMMON), { askFor: ["trap hole"], askAt: [] }), false);
  assert.equal(shouldAutoPass(menu, chain(OcgHintTiming.SUMMON), { askFor: ["Trap Hole"], askAt: ["summon"] }), false);
  assert.equal(shouldAutoPass(menu, chain(OcgHintTiming.DRAW_PHASE), { askFor: ["Trap Hole"], askAt: ["summon"] }), true);
  assert.equal(shouldAutoPass(menu, chain(OcgHintTiming.DRAW_PHASE, true), { askFor: [], askAt: [] }), false);
  assert.equal(shouldAutoPass(menu, { type: OcgMessageType.SELECT_IDLECMD }, { askFor: [], askAt: [] }), false);
});

test("moveHidesCode follows the server rule", () => {
  assert.equal(moveHidesCode({ location: OcgLocation.GRAVE, position: 8 }), false);
  assert.equal(moveHidesCode({ location: OcgLocation.HAND, position: 10 }), true);
  assert.equal(moveHidesCode({ location: OcgLocation.MZONE, position: 8 }), true);
  assert.equal(moveHidesCode({ location: OcgLocation.MZONE, position: 1 }), false);
});

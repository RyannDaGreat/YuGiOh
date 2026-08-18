/**
 * Regression tests for "Declare a Type" (MSG_ANNOUNCE_RACE).
 *
 * The bug: the core's Race values are 64-bit (`OcgRace` is a bigint enum), and the
 * menu handed those BigInt bits straight into the response. A duel record is JSON,
 * `JSON.stringify` throws on BigInt, so answering the menu died with "Do not know
 * how to serialize a BigInt" — the menu was literally unanswerable, and any duel
 * that reached it could never be finished. Found by a structure-deck tournament in
 * which 13 duels stalled on this one menu.
 *
 * The contract now: the response carries the Race bit as a decimal STRING (JSON-safe,
 * lossless), and `toCoreResponse` widens it back to BigInt at the single boundary
 * where recorded responses meet the core.
 *
 * Run: npm test
 */

// Installs cards.cdb as the card source (src/cardsource.js).
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { OcgMessageType, OcgResponseType, ocgRaceString } from "ocgcore-wasm";
import { buildMenu, chooseFromMenu } from "../src/menu.js";
import { toCoreResponse } from "../src/duel.js";

const NO_CTX = { selectHint: 0n, eventHint: 0n, field: null };

/** The bits for spellcaster and aqua, the two Types the tournament actually stalled on. */
const SPELLCASTER = [...ocgRaceString.entries()].find(([, name]) => name === "spellcaster")[0];
const AQUA = [...ocgRaceString.entries()].find(([, name]) => name === "aqua")[0];

test("an answered Declare-a-Type response survives JSON.stringify", () => {
  const menu = buildMenu(
    { type: OcgMessageType.ANNOUNCE_RACE, player: 0, count: 1, available: SPELLCASTER | AQUA },
    NO_CTX,
  );
  assert.deepEqual(menu.items.map((i) => i.label), ["spellcaster", "aqua"]);

  const response = chooseFromMenu(menu, "2");
  assert.equal(response.type, OcgResponseType.ANNOUNCE_RACE);
  assert.deepEqual(response.races, [AQUA.toString()]);
  // The actual regression: this line used to throw.
  assert.equal(JSON.stringify(response), `{"type":${OcgResponseType.ANNOUNCE_RACE},"races":["${AQUA}"]}`);
});

test("toCoreResponse widens a recorded Race back to the BigInt the core wants", () => {
  const recorded = JSON.parse(JSON.stringify({ type: OcgResponseType.ANNOUNCE_RACE, races: [AQUA.toString()] }));
  assert.deepEqual(toCoreResponse(recorded).races, [AQUA]);
  assert.equal(typeof toCoreResponse(recorded).races[0], "bigint");
});

test("toCoreResponse leaves every other response untouched", () => {
  // Attributes are plain numbers (`OcgAttribute`), so they were never affected.
  const attrib = { type: OcgResponseType.ANNOUNCE_ATTRIB, attributes: [16] };
  assert.deepEqual(toCoreResponse(attrib), attrib);
  const yesno = { type: OcgResponseType.SELECT_YESNO, yes: true };
  assert.deepEqual(toCoreResponse(yesno), yesno);
  assert.equal(toCoreResponse(null), null);
});

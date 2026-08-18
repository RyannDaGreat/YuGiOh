/**
 * Unit tests for Pendulum visibility: the scale a Pendulum Monster carries must
 * be printed everywhere the card is shown, and a Pendulum Summon must be named
 * as one. (What the core then lets that summon bring out is a different
 * question, guarded by test/pendulum-summon-window.test.js.)
 *
 * Why these exist: ocgcore has no pendulum-summon idle action — it offers the
 * Pendulum Summon as a special-summon procedure owned by the card in a Pendulum
 * Zone, so the raw menu line read "Special summon <my scale card>", which a
 * player reasonably (and wrongly) takes as an offer to summon that scale card
 * as a monster. Scales were invisible in every rendering at the same time, so
 * nothing contradicted the misreading. Both cost a real game turn (2026-08-17).
 *
 * Run: npm test
 */

// Installs cards.cdb as the card source (src/cardsource.js).
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";
import { cardInfo, isPendulumMonster, scaleText, summarizeCard } from "../src/cards.js";
import { createField, makeSlot } from "../src/field.js";
import { buildMenu, pendulumSummonLabel, pendulumZoneCards } from "../src/menu.js";
import { describeFieldCard, fieldCardData } from "../src/state.js";

/** Cards used throughout: a Scale 8 and a Scale 1 Pendulum Monster, and a vanilla. */
const DRAGONPIT = 51531505; // Dragonpit Magician, Scale 8, Lv7
const DRAGONPULSE = 15146890; // Dragonpulse Magician, Scale 1, Lv4
const BLUE_EYES = 89631139; // Blue-Eyes White Dragon, not a Pendulum Monster

/** Master Rule 5 puts the Pendulum Zones in spell/trap sequences 0 and 4. */
const LEFT_PZONE_SEQ = 0;
const RIGHT_PZONE_SEQ = 4;

/** A field model with P0's two Pendulum Zones filled by the given cards. */
function fieldWithScales(leftCode, rightCode) {
  const field = createField(8000, [40, 40]);
  field.players[0].szone[LEFT_PZONE_SEQ] = makeSlot(leftCode, OcgPosition.FACEUP);
  field.players[0].szone[RIGHT_PZONE_SEQ] = makeSlot(rightCode, OcgPosition.FACEUP);
  return field;
}

test("cards.cdb scales reach cardInfo and the one-line summary", () => {
  assert.deepEqual([cardInfo(DRAGONPIT).lscale, cardInfo(DRAGONPIT).rscale], [8, 8]);
  assert.deepEqual([cardInfo(BLUE_EYES).lscale, cardInfo(BLUE_EYES).rscale], [0, 0]);
  assert.equal(isPendulumMonster(DRAGONPIT), true);
  assert.equal(isPendulumMonster(BLUE_EYES), false);
  assert.equal(scaleText(4, 4), "4");
  assert.equal(scaleText(4, 8), "L4/R8");
  assert.match(summarizeCard(DRAGONPIT), /Pendulum Monster Lv7 Scale8 ATK900 DEF2700/);
  assert.equal(summarizeCard(BLUE_EYES), "Blue-Eyes White Dragon [LIGHT Dragon Normal Monster Lv8 ATK3000 DEF2500]");
});

test("a Pendulum Zone card shows its scale in the state rendering", () => {
  const inPendulumZone = fieldCardData({ code: DRAGONPIT, position: OcgPosition.FACEUP }, true, false);
  assert.equal(inPendulumZone.scale, "8");
  assert.equal(describeFieldCard(inPendulumZone), "Dragonpit Magician (up, Normal Pendulum Monster, scale 8)");
  // As a monster it is a monster: level and stats, no scale.
  const asMonster = fieldCardData({ code: DRAGONPIT, position: OcgPosition.FACEUP_ATTACK, attack: 900, defense: 2700, baseAttack: 900, baseDefense: 2700, level: 7 }, true, true);
  assert.equal(asMonster.scale, undefined);
  // A plain spell/trap gains nothing.
  assert.equal(fieldCardData({ code: 4206964, position: OcgPosition.FACEDOWN }, true, false).scale, undefined);
});

test("pendulumZoneCards reads both scales, left zone first", () => {
  assert.deepEqual(pendulumZoneCards(fieldWithScales(DRAGONPIT, DRAGONPULSE), 0), [
    { code: DRAGONPIT, sequence: LEFT_PZONE_SEQ },
    { code: DRAGONPULSE, sequence: RIGHT_PZONE_SEQ },
  ]);
  assert.deepEqual(pendulumZoneCards(null, 0), []);
});

test("a special summon owned by a Pendulum Zone card is labelled a Pendulum Summon", () => {
  const entry = { code: DRAGONPIT, controller: 0, location: OcgLocation.SZONE, sequence: LEFT_PZONE_SEQ };
  const label = pendulumSummonLabel(entry, fieldWithScales(DRAGONPIT, DRAGONPULSE));
  assert.match(label, /^Pendulum Summon — scales Dragonpit Magician 8 \(P0 s0\) \/ Dragonpulse Magician 1 \(P0 s4\); /);
  assert.match(label, /NOT the scale cards themselves/);
  // Without a field model the partner scale is unknown, but the action is still named.
  assert.match(pendulumSummonLabel(entry, null), /^Pendulum Summon using Dragonpit Magician \(P0 s0\) — /);
  // An ordinary special summon (a monster from the hand or Extra Deck) is untouched.
  assert.equal(pendulumSummonLabel({ code: BLUE_EYES, controller: 0, location: OcgLocation.HAND, sequence: 0 }, null), null);
  assert.equal(pendulumSummonLabel({ code: BLUE_EYES, controller: 0, location: OcgLocation.MZONE, sequence: 0 }, null), null);
});

test("the idle menu never offers to 'special summon' a scale card", () => {
  const msg = {
    type: OcgMessageType.SELECT_IDLECMD,
    player: 0,
    summons: [],
    special_summons: [{ code: DRAGONPIT, controller: 0, location: OcgLocation.SZONE, sequence: LEFT_PZONE_SEQ }],
    monster_sets: [],
    spell_sets: [],
    activates: [],
    pos_changes: [],
    to_bp: false,
    to_ep: true,
  };
  const menu = buildMenu(msg, { selectHint: 0n, eventHint: 0n, field: fieldWithScales(DRAGONPIT, DRAGONPULSE) });
  assert.match(menu.items[0].label, /^Pendulum Summon — scales /);
  assert.doesNotMatch(menu.items[0].label, /Special summon/);
});

/**
 * Unit tests for web/src/lib/pretty/optionPlaces.js — the pure label reader that
 * maps a menu option onto the table: which slot/pile it points at (placeOf) and
 * which card it names (nameIn). Both drive real UI: the table's clickable rims
 * and, since options can name a card the player cannot otherwise see (Magician's
 * Circle lists deck cards), the preview panel on hover.
 *
 * Every label here is a form src/menu.js buildMenu actually produces.
 *
 * Run: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { nameIn, optionPlaces, optionsAt, phaseOptions, placeOf } from "../web/src/lib/pretty/optionPlaces.js";

test("placeOf reads the main-phase action forms", () => {
  assert.deepEqual(placeOf("Normal summon Beaver Warrior (P0 hand)"), { p: 0, kind: "hand", seq: null });
  assert.deepEqual(placeOf("Set monster Sangan (P0 hand)"), { p: 0, kind: "hand", seq: null });
  assert.deepEqual(placeOf("Set spell/trap Dark Hole (P0 hand)"), { p: 0, kind: "hand", seq: null });
  assert.deepEqual(placeOf("Special summon Kagari (P0 extra)"), { p: 0, kind: "extra", seq: null });
  assert.deepEqual(placeOf("Activate Book of Moon (P0 s1)"), { p: 0, kind: "s", seq: 1 });
  assert.deepEqual(placeOf("Change battle position of Sangan (P0 m2)"), { p: 0, kind: "m", seq: 2 });
  // The field spell zone is drawn as the spell/trap row's slot 5.
  assert.deepEqual(placeOf("Activate Chicken Game (P1 field)"), { p: 1, kind: "s", seq: 5 });
});

test("placeOf reads battle, target, pile and zone forms", () => {
  assert.deepEqual(placeOf("Attack with Blue-Eyes White Dragon (P1 m0)"), { p: 1, kind: "m", seq: 0 });
  assert.deepEqual(placeOf("Attack with Kuriboh (P1 m1) (can attack directly)"), { p: 1, kind: "m", seq: 1 });
  assert.deepEqual(placeOf("Sangan (P0 m2)"), { p: 0, kind: "m", seq: 2 }); // SELECT_CARD target
  assert.deepEqual(placeOf("Dark Magician (P0 deck)"), { p: 0, kind: "deck", seq: null });
  assert.deepEqual(placeOf("Mystical Space Typhoon (P1 GY)"), { p: 1, kind: "grave", seq: null });
  assert.deepEqual(placeOf("Kuriboh (P0 banished)"), { p: 0, kind: "banished", seq: null });
  assert.deepEqual(placeOf("P0 m3"), { p: 0, kind: "m", seq: 3 }); // SELECT_PLACE zone item
  assert.deepEqual(placeOf("P1 s7"), { p: 1, kind: "s", seq: 7 });
});

test("placeOf survives the suffixes the engine appends after the place", () => {
  // Effect description (Activate), disambiguation ordinal, counter count,
  // tribute weight, SELECT_SUM amount, and the Pendulum Summon prose note.
  assert.deepEqual(placeOf("Activate Book of Moon (P0 s1): Target 1 face-up monster"), { p: 0, kind: "s", seq: 1 });
  assert.deepEqual(placeOf("Activate Magician's Circle (P0 s0) (effect #2)"), { p: 0, kind: "s", seq: 0 });
  assert.deepEqual(placeOf("Activate Skilled Dark Magician (P0 m1): Special summon (effect #1)"), { p: 0, kind: "m", seq: 1 });
  assert.deepEqual(placeOf("Skilled Dark Magician (P0 m1) (has 3)"), { p: 0, kind: "m", seq: 1 });
  assert.deepEqual(placeOf("Sangan (P0 m2) (counts as 2 tributes)"), { p: 0, kind: "m", seq: 2 });
  assert.deepEqual(placeOf("Sangan (P0 m2) [1000]"), { p: 0, kind: "m", seq: 2 });
  assert.deepEqual(placeOf("Pendulum Summon using Dragonpit Magician (P0 s0) — summons monsters from your hand"), { p: 0, kind: "s", seq: 0 });
});

test("placeOf is null for options that point nowhere", () => {
  assert.equal(placeOf("End turn"), null);
  assert.equal(placeOf("Enter Battle Phase"), null);
  assert.equal(placeOf("Yes"), null);
  assert.equal(placeOf("Dark Magician"), null); // a name with no place is not a location
  // Two-scale Pendulum Summon: the places named inside the note are the scales,
  // not the option's own place.
  assert.equal(placeOf("Pendulum Summon — scales Dragonpit Magician 8 (P0 s0) / Dragonpulse Magician 4 (P0 s7); summons monsters"), null);
});

test("nameIn strips the action verb and the place", () => {
  assert.equal(nameIn("Normal summon Beaver Warrior (P0 hand)"), "Beaver Warrior");
  assert.equal(nameIn("Set monster Sangan (P0 hand)"), "Sangan");
  assert.equal(nameIn("Set spell/trap Dark Hole (P0 hand)"), "Dark Hole");
  assert.equal(nameIn("Special summon Dark Magician (P0 extra)"), "Dark Magician");
  assert.equal(nameIn("Flip summon Man-Eater Bug (P0 m0)"), "Man-Eater Bug");
  assert.equal(nameIn("Change battle position of Beaver Warrior (P0 m1)"), "Beaver Warrior");
  assert.equal(nameIn("Attack with Blue-Eyes White Dragon (P1 m0)"), "Blue-Eyes White Dragon");
  assert.equal(nameIn("Attack with Kuriboh (P1 m1) (can attack directly)"), "Kuriboh");
  assert.equal(nameIn("Deselect Sangan (P0 m2)"), "Sangan");
});

test("nameIn survives effect text, ordinals and amounts", () => {
  assert.equal(nameIn("Activate Book of Moon (P0 s1): Target 1 face-up monster; change it to face-down"), "Book of Moon");
  assert.equal(nameIn("Activate Magician's Circle (P0 s0) (effect #2)"), "Magician's Circle");
  assert.equal(nameIn("Activate Skilled Dark Magician (P0 m1): Special summon (effect #1)"), "Skilled Dark Magician");
  assert.equal(nameIn("Sangan (P0 m2) [1000]"), "Sangan");
  assert.equal(nameIn("Sangan (P0 m2) (counts as 2 tributes)"), "Sangan");
  assert.equal(nameIn("Pendulum Summon using Dragonpit Magician (P0 s0) — summons monsters from your hand"), "Dragonpit Magician");
});

test("nameIn reads target items — the cards an option offers from unseen piles", () => {
  // Magician's Circle: the choice is a list of deck cards, named and nothing else.
  assert.equal(nameIn("Dark Magician (P0 deck)"), "Dark Magician");
  assert.equal(nameIn("Skilled Dark Magician (P0 deck)"), "Skilled Dark Magician");
  assert.equal(nameIn("Mystical Space Typhoon (P1 GY)"), "Mystical Space Typhoon");
});

test("nameIn keeps a colon that belongs to the name", () => {
  // No place to anchor an effect description, so the colon is part of the name.
  assert.equal(nameIn("Number 39: Utopia"), "Number 39: Utopia");
  assert.equal(nameIn("Special summon Number 39: Utopia (P0 extra)"), "Number 39: Utopia");
});

test("nameIn is null when there is no card to look up", () => {
  assert.equal(nameIn("P0 m3"), null); // zone item
  assert.equal(nameIn("P1 s7"), null);
  assert.equal(nameIn("? (P1 m0)"), null); // code withheld by the message
  assert.equal(nameIn("? (P1 hand)"), null);
});

test("optionPlaces keeps only the options that point at the table, with their names", () => {
  assert.deepEqual(optionPlaces(["Normal summon Sangan (P0 hand)", "End turn"]), [
    { index: 0, label: "Normal summon Sangan (P0 hand)", place: { p: 0, kind: "hand", seq: null }, name: "Sangan" },
  ]);
});

test("optionsAt groups by slot, and by hand index within a hand (name only for index-less legacy labels)", () => {
  const opts = optionPlaces(["Normal summon Sangan (P0 hand)", "Set monster Sangan (P0 hand)", "Set monster Kuriboh (P0 hand)", "Attack with Beaver Warrior (P0 m1)"]);
  assert.deepEqual(optionsAt(opts, { p: 0, kind: "hand", seq: 0, name: "Sangan" }).map((o) => o.index), [0, 1]);
  assert.deepEqual(optionsAt(opts, { p: 0, kind: "hand", seq: 1, name: "Kuriboh" }).map((o) => o.index), [2]);
  assert.deepEqual(optionsAt(opts, { p: 0, kind: "m", seq: 1 }).map((o) => o.index), [3]);
  assert.deepEqual(optionsAt(opts, { p: 0, kind: "m", seq: 0 }), []);
});

test("two copies of one card in hand are two different clickable cards", () => {
  // The bug: both Mythical Institutions lit up with all four options (set + activate, twice)
  // because hand options were matched by name. Now each copy owns its own two.
  const labels = ["Set spell/trap Mythical Institution (P1 hand 2)", "Set spell/trap Mythical Institution (P1 hand 3)", "Activate Mythical Institution (P1 hand 2)", "Activate Mythical Institution (P1 hand 3)"];
  assert.deepEqual(placeOf(labels[1]), { p: 1, kind: "hand", seq: 3 });
  assert.equal(nameIn(labels[3]), "Mythical Institution");
  const opts = optionPlaces(labels);
  assert.deepEqual(optionsAt(opts, { p: 1, kind: "hand", seq: 2, name: "Mythical Institution" }).map((o) => o.index), [0, 2]);
  assert.deepEqual(optionsAt(opts, { p: 1, kind: "hand", seq: 3, name: "Mythical Institution" }).map((o) => o.index), [1, 3]);
  assert.deepEqual(optionsAt(opts, { p: 1, kind: "hand", seq: 4, name: "Mythical Institution" }), []);
});

test("phaseOptions finds the phase-strip buttons", () => {
  assert.deepEqual(phaseOptions(["Attack with Sangan (P0 m0)", "Enter Main Phase 2", "End turn (skip Main Phase 2)"]), { M2: 1, EP: 2 });
  assert.deepEqual(phaseOptions(["Enter Battle Phase", "End turn"]), { BP: 0, EP: 1 });
  assert.deepEqual(phaseOptions([]), {});
});

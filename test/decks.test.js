/**
 * Deck-schema tests (store.loadDeck) and the GOAT/Extra-Deck replay wiring
 * (duel.replayDuel). See the DECK SCHEMA block at the top of src/store.js.
 *
 * What they guard:
 *   - The full schema loads (category/format/extra/side/manual), and card
 *     placement is enforced: an Extra-Deck monster in `main` (or a main-deck
 *     card in `extra`) is rejected loudly, before a duel can be created.
 *   - A legacy {name, main} deck still loads, defaulting the new fields — a
 *     decklist is a permanent document and old ones must keep working.
 *   - A format:"goat" duel is built in MODE_GOAT (first player draws on turn 1;
 *     duel flags differ from MR5) and its extra-deck cards land in EXTRA
 *     (extra_size > 0). The classic default path is byte-identical to before.
 *
 * Temp deck files are written under the OS temp dir and removed; nothing here
 * touches src/decks or duels/.
 *
 * Run: npm test
 */

// Installs the real filesystem as the app volume (src/volume.js) and cards.cdb
// as the card source (src/cardsource.js).
import "../src/volume-node.js";
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DRAW_PER_TURN, STARTING_HAND, expandDeck, expandExtra, replayDuel } from "../src/duel.js";
import { loadDeck, sharedFormat } from "../src/store.js";

/**
 * Command. Writes `json` to a throwaway deck file, runs `fn(path)`, and deletes
 * the temp dir afterwards. Returns whatever `fn` returns.
 */
function withDeckFile(json, fn) {
  const dir = mkdtempSync(join(tmpdir(), "ygo-deck-"));
  const path = join(dir, "deck.json");
  writeFileSync(path, JSON.stringify(json));
  try {
    return fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("loadDeck: the full schema (goat-sample) parses every field", () => {
  const d = loadDeck("goat-sample");
  assert.equal(d.category, "curated");
  assert.equal(d.format, "goat");
  assert.equal(expandDeck(d.main).length, 40, "40-card GOAT main");
  assert.equal(expandExtra(d.extra).length, 3, "three Fusion monsters in the extra deck");
  assert.deepEqual(d.side, [], "no side deck");
  assert.ok(d.manual.length > 0, "a pilot manual is present");
});

test("loadDeck: an Extra-Deck monster in `main` is rejected", () => {
  withDeckFile({ name: "Bad", main: [["Thousand-Eyes Restrict", 1]] }, (path) => {
    assert.throws(() => loadDeck(path), /Extra Deck monster/, "a Fusion may not sit in main");
  });
});

test("loadDeck: a main-deck card in `extra` is rejected", () => {
  withDeckFile({ name: "Bad", main: [["Pot of Greed", 1]], extra: [["Pot of Greed", 1]] }, (path) => {
    assert.throws(() => loadDeck(path), /not an Extra Deck monster/, "a Spell may not sit in extra");
  });
});

test("loadDeck: a legacy {name, main} deck still loads, defaulting the new fields", () => {
  withDeckFile({ name: "Legacy", main: [["Blue-Eyes White Dragon", 3]] }, (path) => {
    const d = loadDeck(path);
    assert.equal(d.category, "user");
    assert.equal(d.format, "classic");
    assert.deepEqual(d.extra, []);
    assert.deepEqual(d.side, []);
    assert.equal(d.manual, "");
    assert.equal(expandDeck(d.main).length, 3);
  });
});

test("loadDeck: a goat main deck outside 40–60 is rejected", () => {
  withDeckFile({ name: "Tiny", format: "goat", main: [["Pot of Greed", 3]] }, (path) => {
    assert.throws(() => loadDeck(path), /main deck must be/, "3 cards is not a legal GOAT main");
  });
});

test("loadDeck: a typo'd card name fails loudly", () => {
  withDeckFile({ name: "Typo", main: [["Blue-Eyed White Dragon", 1]] }, (path) => {
    assert.throws(() => loadDeck(path), /not found in cards\.cdb/);
  });
});

test("sharedFormat: both decks must agree on a format", () => {
  assert.equal(sharedFormat([loadDeck("goat-sample"), loadDeck("goat-sample")]), "goat");
  assert.equal(sharedFormat([loadDeck("yugi"), loadDeck("kaiba")]), "classic");
  assert.throws(() => sharedFormat([{ format: "classic" }, { format: "goat" }]), /share a format/);
});

test("replay: format goat builds MODE_GOAT and puts the extra cards in EXTRA", async () => {
  const deck = loadDeck("goat-sample");
  const deckCodes = [expandDeck(deck.main), expandDeck(deck.main)];
  const extraCodes = [expandExtra(deck.extra), expandExtra(deck.extra)];
  const goat = await replayDuel({ seed: 7, deckCodes, extraCodes, responses: [], format: "goat" });
  const mr5 = await replayDuel({ seed: 7, deckCodes, responses: [] }); // classic default, no extra deck
  try {
    const gf = goat.core.duelQueryField(goat.handle);
    const mf = mr5.core.duelQueryField(mr5.handle);
    for (const p of [0, 1]) {
      assert.ok(gf.players[p].extra_size > 0, `P${p} has extra-deck cards under goat`);
      assert.equal(gf.players[p].extra_size, extraCodes[p].length, `P${p} extra_size matches the list`);
      assert.equal(mf.players[p].extra_size, 0, `P${p} has no extra cards under the classic default`);
    }
    // Two independent signatures that MODE_GOAT (not MR5) is in force.
    assert.notEqual(gf.flags, mf.flags, "duel flags differ between goat and mr5");
    assert.equal(gf.players[0].hand_size, STARTING_HAND + DRAW_PER_TURN, "goat: the first player draws on turn 1");
    assert.equal(mf.players[0].hand_size, STARTING_HAND, "mr5: the first player skips the turn-1 draw");
  } finally {
    goat.core.destroyDuel(goat.handle);
    mr5.core.destroyDuel(mr5.handle);
  }
});

test("replay: the classic path is unchanged — extra/format are opt-in", async () => {
  const deckCodes = [expandDeck(loadDeck("yugi").main), expandDeck(loadDeck("kaiba").main)];
  const bare = await replayDuel({ seed: 5, deckCodes, responses: [] });
  const explicit = await replayDuel({ seed: 5, deckCodes, extraCodes: [[], []], responses: [], format: "classic" });
  try {
    assert.deepEqual(explicit.messages, bare.messages, "explicit classic + empty extra equals the bare call");
  } finally {
    bare.core.destroyDuel(bare.handle);
    explicit.core.destroyDuel(explicit.handle);
  }
});

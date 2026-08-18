/**
 * "(set this turn)": a face-down Spell/Trap or monster Set this turn is marked in
 * the text state for BOTH players (public information — everyone saw it go
 * down), and the mark is gone once the turn has passed. The mark comes from the
 * core's own status bits (state.js STATUS_SET_TURN / STATUS_FORM_CHANGED), so
 * this also pins that ocgcore-wasm's QUERY_STATUS exposes them, for the
 * opponent's face-down cards too.
 *
 * Run: npm test
 */
import "../src/volume-node.js";
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { expandDeck, replayDuel } from "../src/duel.js";
import { buildMenu, renderMenu } from "../src/menu.js";
import { viewDuel } from "../src/session.js";
import { SPECTATOR } from "../src/view.js";

/** Seed whose opening hand (deck below) holds Trap Hole and Mystical Elf. */
const SEED = 3;
const VIEWERS = [0, 1, SPECTATOR];

/**
 * Command. Replays `responses` and answers the pending menu with the first
 * item matching `itemRe` (the menu title must match `titleRe`).
 *
 * @returns {Promise<object>} The response to append to the record.
 */
async function pick(duel, titleRe, itemRe) {
  const r = await replayDuel({ seed: duel.seed, deckCodes: duel.decks.map((d) => d.codes), responses: duel.responses });
  try {
    const menu = buildMenu(r.pending, { selectHint: 0n, eventHint: 0n, field: null });
    assert.match(menu.title, titleRe, renderMenu(menu).join("\n"));
    const i = menu.items.findIndex((it) => itemRe.test(it.label));
    assert.ok(i >= 0, `${itemRe} in:\n${renderMenu(menu).join("\n")}`);
    return menu.build([menu.items[i].value]);
  } finally {
    r.core.destroyDuel(r.handle);
  }
}

/** Query. The text state line for one zone of one player, per viewer. */
async function zoneLines(duel, zone) {
  const out = {};
  for (const viewer of VIEWERS) {
    const { stateLines } = await viewDuel(duel, viewer);
    out[viewer] = stateLines.find((l) => l.startsWith(`  ${zone}:`)) ?? null;
  }
  return out;
}

test("a Set Spell/Trap and a Set monster read '(set this turn)' for both players, and only this turn", async () => {
  const codes = [expandDeck([["Trap Hole", 20], ["Mystical Elf", 20]]), expandDeck([["Celtic Guardian", 40]])];
  const duel = { seed: SEED, decks: [{ name: "D0", codes: codes[0] }, { name: "D1", codes: codes[1] }], responses: [] };
  const push = async (titleRe, itemRe) => duel.responses.push(await pick(duel, titleRe, itemRe));

  // Turn 1 (P0): Set Trap Hole to s1, Set a monster to m2.
  await push(/main phase action/, /^Set spell\/trap Trap Hole/);
  await push(/^P0: /, /^P0 s1$/);
  await push(/main phase action/, /^Set monster Mystical Elf/);
  await push(/^P0: Select/, /^P0 m2$/);

  const s1 = await zoneLines(duel, "s1");
  const m2 = await zoneLines(duel, "m2");
  assert.equal(s1[0], "  s1: Trap Hole (fd, Trap) (set this turn)", "owner sees the identity and the mark");
  assert.equal(s1[1], "  s1: ? (fd) (set this turn)", "opponent sees the mark without the identity");
  assert.equal(s1[SPECTATOR], "  s1: Trap Hole (fd, Trap) (set this turn)");
  assert.equal(m2[0], "  m2: Mystical Elf fd DEF 800/2000 Lv4 (set this turn)");
  assert.equal(m2[1], "  m2: ? (fd DEF) (set this turn)");
  const t1 = await viewDuel(duel, 1);
  assert.equal(t1.state.players[0].szone[1].setThisTurn, true);
  assert.equal(t1.state.players[0].mzone[2].setThisTurn, true);
  assert.equal(t1.state.players[0].mzone[2].summonedThisTurn, false, "a Set is not a Summon");

  // Turn 2 (P1): the marks are gone; a Normal Summon is summonedThisTurn, never 'set this turn'.
  await push(/main phase action/, /^End turn/);
  await push(/main phase action/, /^Normal summon Celtic Guardian/);
  await push(/^P1: Select/, /^P1 m2$/);
  const s1Later = await zoneLines(duel, "s1");
  const m2Later = await zoneLines(duel, "m2");
  assert.equal(s1Later[0], "  s1: Trap Hole (fd, Trap)");
  assert.equal(s1Later[1], "  s1: ? (fd)");
  assert.equal(m2Later[1], "  m2: ? (fd DEF)");
  const t2 = await viewDuel(duel, 0);
  assert.equal(t2.state.players[0].szone[1].setThisTurn, false);
  assert.equal(t2.state.players[0].mzone[2].setThisTurn, false);
  const celtic = t2.state.players[1].mzone[2];
  assert.equal(celtic.name, "Celtic Guardian");
  assert.deepEqual([celtic.setThisTurn, celtic.summonedThisTurn], [false, true]);
  assert.doesNotMatch(t2.stateLines.find((l) => l.includes("Celtic Guardian ATK")), /set this turn/);
});

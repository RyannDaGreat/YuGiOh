/**
 * Unit tests for the animation digest (src/events.js), on hand-built message
 * arrays rather than real duels.
 *
 * What they guard: the two things the digest INFERS rather than reads. The core
 * never says "this was a tribute summon" or "this card died in battle" — both
 * are deduced from the window a message lands in, so a change in that
 * bookkeeping is exactly the kind of bug a full-duel test would hide.
 *
 * Run: npm test
 */

// Installs cards.cdb as the card source (src/cardsource.js).
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";
import { extractEvents, moveReason } from "../src/events.js";

const T = OcgMessageType;
const SPECTATOR = 2;
const STARTING_LP = 8000;
const DECK_SIZES = [40, 40];
/** Any real passcodes; the tests assert on structure, never on names. */
const BLUE_EYES = 89631139;
const SUMMONED_SKULL = 70781052;

/** Pure function. A card at a monster zone. */
const mzone = (p, seq, position = OcgPosition.FACEUP_ATTACK) => ({ controller: p, location: OcgLocation.MZONE, sequence: seq, position });
/** Pure function. A MOVE of `code` between two coordinates. */
const move = (code, from, to) => ({ type: T.MOVE, card: code, from, to });
/** Pure function. A MOVE from a monster zone to its controller's graveyard. */
const toGrave = (code, p, seq) => move(code, mzone(p, seq), { controller: p, location: OcgLocation.GRAVE, sequence: 0, position: OcgPosition.FACEUP_ATTACK });
/** Pure function. A MOVE from a monster zone to the banished pile. */
const toBanish = (code, p, seq) => move(code, mzone(p, seq), { controller: p, location: OcgLocation.REMOVED, sequence: 0, position: OcgPosition.FACEUP_ATTACK });
/** Pure function. A normal summon of `code` into a monster zone. */
const summoning = (code, p, seq) => ({ type: T.SUMMONING, code, controller: p, location: OcgLocation.MZONE, sequence: seq, position: OcgPosition.FACEUP_ATTACK });
/** Pure function. The MOVE from hand to field that precedes every summon. */
const fromHand = (code, p, seq) => move(code, { controller: p, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEDOWN_ATTACK }, mzone(p, seq));

const rawDigest = (messages) => extractEvents(messages, SPECTATOR, STARTING_LP, DECK_SIZES);
// The unit tests below guard the two things the digest INFERS (tribute / battle /
// reason), not the generic `move` flyer layer, so they run on the digest with
// `move` events filtered out. The dedicated `move` test uses `rawDigest`.
const digest = (messages) => rawDigest(messages).filter((e) => e.kind !== "move");
const kinds = (events) => events.map((e) => e.kind);
const only = (events, kind) => events.filter((e) => e.kind === kind);

test("moveReason: chain beats battle, and nothing means other", () => {
  assert.equal(moveReason({ chain: false, battle: false }), "other");
  assert.equal(moveReason({ chain: false, battle: true }), "battle");
  assert.equal(moveReason({ chain: true, battle: false }), "effect");
  assert.equal(moveReason({ chain: true, battle: true }), "effect");
});

test("tribute summon: releases before a SUMMONING become its tributes", () => {
  const events = digest([
    toGrave(BLUE_EYES, 0, 0),
    toGrave(SUMMONED_SKULL, 0, 1),
    fromHand(BLUE_EYES, 0, 2),
    summoning(BLUE_EYES, 0, 2),
  ]);
  assert.deepEqual(kinds(events), ["tograve", "tograve", "summon"]);
  const summon = events[2];
  assert.equal(summon.tribute, true);
  assert.equal(summon.tributes, 2);
  assert.equal(summon.special, false);
  for (const e of only(events, "tograve")) assert.equal(e.reason, "tribute");
});

test("normal summon with no releases is not a tribute summon", () => {
  const events = digest([fromHand(BLUE_EYES, 0, 0), summoning(BLUE_EYES, 0, 0)]);
  assert.deepEqual(kinds(events), ["summon"]);
  assert.equal(events[0].tribute, false);
  assert.equal(events[0].tributes, 0);
});

test("setting a high-level monster claims its tributes too", () => {
  const events = digest([
    toGrave(BLUE_EYES, 1, 0),
    { type: T.SET, code: SUMMONED_SKULL, controller: 1, location: OcgLocation.MZONE, sequence: 1, position: OcgPosition.FACEDOWN_DEFENSE },
  ]);
  assert.deepEqual(kinds(events), ["tograve", "set"]);
  assert.equal(events[0].reason, "tribute");
  assert.equal(events[1].monster, true);
  assert.equal(events[1].tributes, 1);

  const spell = digest([
    toGrave(BLUE_EYES, 1, 0),
    { type: T.SET, code: SUMMONED_SKULL, controller: 1, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEDOWN_DEFENSE },
  ]);
  assert.equal(spell[1].monster, false);
  assert.equal(spell[1].tributes, 0, "a set spell/trap costs nothing");
  assert.equal(spell[0].reason, "other");
});

test("only the summoning player's own releases count as tributes", () => {
  const events = digest([toGrave(BLUE_EYES, 1, 0), summoning(SUMMONED_SKULL, 0, 0)]);
  assert.equal(events[0].reason, "other");
  assert.equal(events[1].tribute, false);
  assert.equal(events[1].tributes, 0);
});

test("an activation between the release and the summon breaks the tribute window", () => {
  const events = digest([
    toGrave(BLUE_EYES, 0, 0),
    { type: T.CHAINING, code: SUMMONED_SKULL, controller: 0, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEUP_ATTACK, chain_size: 1 },
    summoning(SUMMONED_SKULL, 0, 0),
  ]);
  assert.deepEqual(kinds(events), ["tograve", "activate", "summon"]);
  assert.equal(events[0].reason, "other");
  assert.equal(events[1].chainLink, 1);
  assert.equal(events[2].tribute, false);
});

test("a monster killed by a resolving effect is never claimed as a tribute", () => {
  const events = digest([
    { type: T.CHAIN_SOLVING, chain_size: 1 },
    toGrave(BLUE_EYES, 0, 0),
    { type: T.CHAIN_SOLVED, chain_size: 1 },
    summoning(SUMMONED_SKULL, 0, 1),
  ]);
  assert.equal(only(events, "tograve")[0].reason, "effect");
  assert.equal(only(events, "summon")[0].tribute, false);
});

test("a special summon never claims tributes", () => {
  const events = digest([
    toGrave(BLUE_EYES, 0, 0),
    { type: T.SPSUMMONING, code: SUMMONED_SKULL, controller: 0, location: OcgLocation.MZONE, sequence: 1, position: OcgPosition.FACEUP_ATTACK },
    summoning(BLUE_EYES, 0, 2),
  ]);
  assert.equal(events[0].reason, "other");
  assert.equal(events[1].special, true);
  assert.equal(events[1].tributes, 0);
  assert.equal(events[2].tribute, false, "the special summon consumed the window");
});

test("reason battle: a card destroyed after BATTLE, and not after the damage step ends", () => {
  const events = digest([
    { type: T.ATTACK, card: mzone(0, 0), target: mzone(1, 0) },
    { type: T.DAMAGE_STEP_START },
    { type: T.BATTLE, card: { ...mzone(0, 0), attack: 3000, defense: 2500, destroyed: false }, target: { ...mzone(1, 0), attack: 1200, defense: 1000, destroyed: true } },
    toGrave(SUMMONED_SKULL, 1, 0),
    { type: T.DAMAGE_STEP_END },
    toGrave(BLUE_EYES, 1, 1),
  ]);
  assert.deepEqual(kinds(events), ["attack", "battle", "tograve", "tograve"]);
  assert.equal(events[0].direct, false);
  assert.equal(events[2].reason, "battle");
  assert.equal(events[3].reason, "other", "the damage step is over");
});

test("reason effect: only between CHAIN_SOLVING and CHAIN_SOLVED", () => {
  const events = digest([
    { type: T.CHAIN_SOLVING, chain_size: 2 },
    toGrave(BLUE_EYES, 0, 0),
    toBanish(SUMMONED_SKULL, 1, 0),
    { type: T.CHAIN_SOLVED, chain_size: 2 },
    toGrave(BLUE_EYES, 1, 1),
  ]);
  assert.deepEqual(kinds(events), ["resolve", "tograve", "banish", "tograve"]);
  assert.equal(events[0].chainLink, 2);
  assert.equal(events[1].reason, "effect");
  assert.equal(events[2].reason, "effect");
  assert.equal(events[3].reason, "other");
});

test("a new turn closes the battle window and the tribute window", () => {
  const events = digest([
    { type: T.BATTLE, card: { ...mzone(0, 0), attack: 0, defense: 0, destroyed: false }, target: { ...mzone(1, 0), attack: 0, defense: 0, destroyed: true } },
    { type: T.NEW_TURN, player: 1 },
    toGrave(BLUE_EYES, 0, 0),
    { type: T.NEW_PHASE, phase: 2 },
    summoning(SUMMONED_SKULL, 0, 1),
  ]);
  assert.equal(only(events, "tograve")[0].reason, "other");
  assert.equal(only(events, "summon")[0].tribute, false);
});

test("flip: FLIPSUMMONING is never a battle flip, POS_CHANGE inside the damage step always is", () => {
  const faceUp = { controller: 1, location: OcgLocation.MZONE, sequence: 0, code: BLUE_EYES, prev_position: OcgPosition.FACEDOWN_DEFENSE, position: OcgPosition.FACEUP_DEFENSE };
  const events = digest([
    { type: T.FLIPSUMMONING, code: BLUE_EYES, controller: 0, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP_ATTACK },
    { type: T.POS_CHANGE, ...faceUp },
    { type: T.DAMAGE_STEP_START },
    { type: T.POS_CHANGE, ...faceUp },
    { type: T.DAMAGE_STEP_END },
    { type: T.POS_CHANGE, controller: 0, location: OcgLocation.MZONE, sequence: 0, code: BLUE_EYES, prev_position: OcgPosition.FACEUP_ATTACK, position: OcgPosition.FACEUP_DEFENSE },
  ]);
  assert.deepEqual(kinds(events), ["flip", "flip", "flip", "pos"]);
  assert.deepEqual(only(events, "flip").map((e) => e.battle), [false, false, true]);
  assert.equal(events[3].position, OcgPosition.FACEUP_DEFENSE);
});

test("turning a set spell/trap face-up to activate it is one event, not a flip plus an activation", () => {
  const spot = { controller: 0, location: OcgLocation.SZONE, sequence: 2 };
  const events = digest([
    { type: T.POS_CHANGE, ...spot, code: BLUE_EYES, prev_position: OcgPosition.FACEDOWN_ATTACK, position: OcgPosition.FACEUP_ATTACK },
    { type: T.CHAINING, ...spot, code: BLUE_EYES, position: OcgPosition.FACEUP_ATTACK, chain_size: 1 },
  ]);
  assert.deepEqual(kinds(events), ["activate"]);
});

test("direct attack, LP cost, and win carry their distinguishing fields", () => {
  const events = digest([
    { type: T.ATTACK, card: mzone(0, 0), target: null },
    { type: T.DAMAGE, player: 1, amount: 3000 },
    { type: T.PAY_LPCOST, player: 0, amount: 800 },
    { type: T.RECOVER, player: 0, amount: 500 },
    { type: T.WIN, player: 0, reason: 1 },
  ]);
  assert.deepEqual(kinds(events), ["attack", "damage", "damage", "recover", "win"]);
  assert.equal(events[0].direct, true);
  assert.equal(events[0].to, null);
  assert.equal(events[1].cost, false);
  assert.equal(events[2].cost, true);
  assert.equal(events[4].player, 0);
});

test("table-side happenings: shuffle, equip, counters, coin, dice", () => {
  const events = digest([
    { type: T.SHUFFLE_DECK, player: 1 },
    { type: T.SHUFFLE_HAND, player: 0, cards: [] },
    { type: T.EQUIP, card: { controller: 0, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEUP_ATTACK }, target: mzone(0, 0) },
    { type: T.ADD_COUNTER, counter_type: 1, controller: 0, location: OcgLocation.MZONE, sequence: 0, count: 2 },
    { type: T.REMOVE_COUNTER, counter_type: 1, controller: 0, location: OcgLocation.MZONE, sequence: 0, count: 1 },
    { type: T.TOSS_COIN, player: 0, results: [true, false] },
    { type: T.TOSS_DICE, player: 1, results: [6] },
  ]);
  assert.deepEqual(kinds(events), ["shuffle", "shuffle", "equip", "counter", "counter", "coin", "dice"]);
  assert.deepEqual(events.slice(0, 2).map((e) => e.what), ["deck", "hand"]);
  assert.deepEqual(events.slice(3, 5).map((e) => [e.add, e.count]), [[true, 2], [false, 1]]);
  assert.deepEqual(events[5].results, [true, false]);
  assert.deepEqual(events[6].results, [6]);
});

test("move: every zone-changing relocation emits a from/to flyer event with face flags", () => {
  const moves = rawDigest([
    fromHand(BLUE_EYES, 0, 2),      // hand -> monster zone (reveals: facedown -> faceup)
    toGrave(SUMMONED_SKULL, 0, 1),  // monster zone -> graveyard
  ]).filter((e) => e.kind === "move");
  assert.equal(moves.length, 2, "one move per zone-changing relocation");
  assert.deepEqual(moves[0].from, { p: 0, zone: "hand", seq: 0 });
  assert.deepEqual(moves[0].to, { p: 0, zone: "m", seq: 2 });
  assert.equal(moves[0].faceFrom, false, "hand card was face-down");
  assert.equal(moves[0].faceTo, true, "revealed on the field -> flyer flips mid-air");
  assert.deepEqual(moves[1].from, { p: 0, zone: "m", seq: 1 });
  assert.deepEqual(moves[1].to, { p: 0, zone: "grave", seq: 0 });
});

test("move: internal re-ordering within one zone does NOT emit a flyer", () => {
  // A hand->hand shuffle (same zone, seq change) is reflow, not a flight.
  const handToHand = (p, a, b) => move(BLUE_EYES,
    { controller: p, location: OcgLocation.HAND, sequence: a, position: OcgPosition.FACEDOWN_ATTACK },
    { controller: p, location: OcgLocation.HAND, sequence: b, position: OcgPosition.FACEDOWN_ATTACK });
  const moves = rawDigest([handToHand(0, 0, 3)]).filter((e) => e.kind === "move");
  assert.equal(moves.length, 0, "same-zone re-index is left to animate:flip reflow");
});

/** Pure function. A face-up spell/trap slot coordinate. */
const szone = (p, seq, position = OcgPosition.FACEUP) => ({ controller: p, location: OcgLocation.SZONE, sequence: seq, position });
/** Pure function. The masked stream of one Normal Spell activated from the hand. */
const spellFromHand = (code, p, seq) => [
  move(code, { controller: p, location: OcgLocation.HAND, sequence: 4, position: OcgPosition.FACEDOWN }, szone(p, seq)),
  { type: T.CHAINING, code, ...szone(p, seq), chain_size: 1 },
  { type: T.CHAIN_SOLVING, chain_size: 1 },
  { type: T.RECOVER, player: p, amount: 1000 },
  { type: T.CHAIN_SOLVED, chain_size: 1 },
  move(code, szone(p, seq), { controller: p, location: OcgLocation.GRAVE, sequence: 0, position: OcgPosition.FACEUP }),
  { type: T.CHAIN_END },
];

test("a spell activated from the hand reads as four beats: onto the field, activation, effect, graveyard", () => {
  // The whole point of the digest for a client: an activation must not collapse
  // into "the card is in the graveyard now". Each beat is a separate event, in
  // this order, so the table can animate them one after the other.
  const events = rawDigest(spellFromHand(BLUE_EYES, 0, 0));
  assert.deepEqual(kinds(events), ["move", "activate", "resolve", "recover", "move", "tograve"]);
  assert.deepEqual(events[0].to, { p: 0, zone: "s", seq: 0 }, "the card lands in its spell/trap zone");
  assert.equal(events[0].faceTo, true, "face-up on arrival");
  assert.equal(events[1].code, BLUE_EYES, "the activating card's code, so a client can draw it mid-activation");
  assert.deepEqual(events[1].at, { p: 0, zone: "s", seq: 0 });
  assert.deepEqual(events[4].from, { p: 0, zone: "s", seq: 0 }, "and leaves from the same slot");
});

test("reason spent: a used spell/trap is put away, not destroyed", () => {
  const events = rawDigest(spellFromHand(BLUE_EYES, 0, 0));
  assert.equal(only(events, "tograve")[0].reason, "spent");
  assert.equal(events[4].reason, "spent", "the move carries the same reason as its tograve");
  assert.equal(events[0].reason, "other", "the trip onto the field is not a departure at all");
});

test("reason spent: only the activating card, and only once its chain link is done", () => {
  // A monster killed by the resolving effect leaves mid-chain and stays "effect";
  // the trap that killed it is put away after CHAIN_SOLVED and is "spent". A
  // card in that same slot NEXT chain is not spent — CHAIN_END forgets the slot.
  const trap = { type: T.CHAINING, code: BLUE_EYES, ...szone(0, 1), chain_size: 1 };
  const trapToGrave = move(BLUE_EYES, szone(0, 1), { controller: 0, location: OcgLocation.GRAVE, sequence: 1, position: OcgPosition.FACEUP });
  const events = rawDigest([
    trap,
    { type: T.CHAIN_SOLVING, chain_size: 1 },
    toGrave(SUMMONED_SKULL, 1, 0),
    { type: T.CHAIN_SOLVED, chain_size: 1 },
    trapToGrave,
    { type: T.CHAIN_END },
    trapToGrave,
  ]);
  const graves = only(events, "tograve");
  assert.deepEqual(graves.map((e) => e.reason), ["effect", "spent", "other"]);
});

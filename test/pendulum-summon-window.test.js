/**
 * Which monsters may a Pendulum Summon bring out? Two separate things are
 * guarded here:
 *
 *   1. OUR data path — that `src/cards.js` decodes cards.cdb's packed `level`
 *      column into the printed Level and BOTH printed Pendulum Scales. This is a
 *      permanent regression test of our own code.
 *
 *   2. THE ENGINE'S Pendulum Summon window, end to end — which also guards our
 *      patch of the vendored core. `ocgcore-wasm` 0.1.2 as published marshals
 *      `OcgCardData` into the wasm32 struct with `rscale` at byte offset 48
 *      instead of 44 (and `link_marker` at 52 instead of 48), so the core read
 *      Right Scale 0 and Link Marker 0 for EVERY card: the window collapsed to
 *      (0, left-zone card's Left Scale) and Link Monsters had no arrows. We fix
 *      the two offsets with `patches/ocgcore-wasm+0.1.2.patch` (patch-package,
 *      applied by `npm install`'s postinstall). If these engine tests fail with
 *      the collapsed window again, the patch did not apply. See concerns.md,
 *      2026-08-17 (diagnosis) and 2026-08-18 (fix applied).
 *
 * Run: npm test
 */

// Installs cards.cdb as the card source (src/cardsource.js).
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import createCore, { OcgDuelMode, OcgLocation, OcgMessageType, OcgPosition, OcgProcessResult, OcgQueryFlags } from "ocgcore-wasm";
import { cardReader, cardInfo, codeOf, scriptReader } from "../src/cards.js";
import { autoResponse, STARTING_LP } from "../src/duel.js";
import { buildMenu, chooseFromMenu, renderMenu } from "../src/menu.js";

const PRELUDE_SCRIPTS = ["constant.lua", "utility.lua"];
const MAX_PROCESS_STEPS = 20000;
/** Deck padding so neither player decks out; never selectable in any test below. */
const FILLER = "Blue-Eyes White Dragon";
const FILLER_COUNT = 20;
const OPPONENT_HAND_SIZE = 5;

/**
 * The idle-command entry that starts a Pendulum Summon is owned by the card in
 * the LEFT Pendulum Zone, so its label names that zone whichever wording
 * `src/menu.js` currently gives it.
 */
const PENDULUM_SUMMON_ENTRY = /^(Pendulum Summon|Special summon).*\(P0 s0\)/;

const PATCH_NOTE =
  "ocgcore-wasm 0.1.2 as published writes OcgCardData.rscale at wasm32 offset 48 instead of 44, so the " +
  "core saw every Right Scale as 0; patches/ocgcore-wasm+0.1.2.patch fixes it. If this assertion fails " +
  "with a Right Scale of 0, the patch was not applied (run `npm install`).";

/**
 * Command. Sets up P0 with two Pendulum Zones and a stacked hand, takes the
 * Pendulum Summon, and reports what the core offered.
 *
 * The two scale cards are really activated from hand through the idle command,
 * so this walks exactly the path a player walks — no synthetic board state.
 *
 * Args:
 *     left (string): Card name activated into P0 s0 (the LEFT Pendulum Zone).
 *     right (string): Card name activated into P0 s4 (the RIGHT Pendulum Zone).
 *     hand (string[]): Monster names left in hand as summon candidates.
 *
 * Returns:
 *     Promise<{offered: string[], scales: Record<string, {leftScale, rightScale}>}>
 *     `offered` is the card names the core listed for the Pendulum Summon (empty
 *     when it offered no Pendulum Summon at all); `scales` is the core's own view
 *     of the two zones, keyed "s0" / "s4".
 *
 * Examples:
 *     >>> // (await pendulumWindow("Dragonpit Magician", "Stargazer Magician", ["Sangan"])).offered
 *     >>> // ["Sangan"]   — scales 8 and 1 admit Levels 2-7, and Sangan is Level 3
 */
async function pendulumWindow(left, right, hand) {
  const opening = [left, right, ...hand];
  const core = await createCore({ sync: true });
  const errors = [];
  const handle = await core.createDuel({
    flags: OcgDuelMode.MODE_MR5,
    seed: [1n, 2n, 3n, 4n],
    team1: { startingLP: STARTING_LP, startingDrawCount: opening.length, drawCountPerTurn: 1 },
    team2: { startingLP: STARTING_LP, startingDrawCount: OPPONENT_HAND_SIZE, drawCountPerTurn: 1 },
    cardReader,
    scriptReader,
    errorHandler: (type, text) => errors.push({ type, text }),
  });
  if (!handle) throw new Error("OCG_CreateDuel failed");
  for (const name of PRELUDE_SCRIPTS) core.loadScript(handle, name, scriptReader(name));

  const add = (player, code, location) => core.duelNewCard(handle, {
    team: player, duelist: 0, code, controller: player, location, sequence: 0, position: OcgPosition.FACEDOWN_DEFENSE,
  });
  for (let i = 0; i < FILLER_COUNT; i++) { await add(0, codeOf(FILLER), OcgLocation.DECK); await add(1, codeOf(FILLER), OcgLocation.DECK); }
  // sequence 0 is the top of the deck, so adding the opening in reverse leaves
  // `opening[0]` on top and the whole hand is drawn in written order.
  for (const name of [...opening].reverse()) await add(0, codeOf(name), OcgLocation.DECK);
  core.startDuel(handle);
  if (errors.length) throw new Error(`card script errors: ${JSON.stringify(errors)}`);

  const script = [
    new RegExp(`^Activate ${left} \\(P0 hand \\d+\\)`),
    /^P0 s0$/,
    new RegExp(`^Activate ${right} \\(P0 hand \\d+\\)`),
    /^P0 s4$/,
    PENDULUM_SUMMON_ENTRY,
  ];
  const messages = [];
  let picks = 0;
  let offered = null;
  for (let step = 0; step < MAX_PROCESS_STEPS && offered === null; step++) {
    const status = core.duelProcess(handle);
    messages.push(...core.duelGetMessage(handle));
    if (errors.length) throw new Error(`card script errors: ${JSON.stringify(errors)}`);
    if (status === OcgProcessResult.END) throw new Error("duel ended before the Pendulum Summon");
    if (status === OcgProcessResult.CONTINUE) continue;
    const pending = messages[messages.length - 1];
    if (pending.type === OcgMessageType.RETRY) throw new Error(`core rejected scripted pick #${picks}`);
    const auto = autoResponse(pending);
    if (auto !== null) { core.duelSetResponse(handle, auto); continue; }

    const menu = buildMenu(pending, { selectHint: 0n, eventHint: 0n, field: null });
    if (picks === script.length) { offered = menu.items.map((it) => it.label.replace(/ \(P0 hand \d+\)$/, "")); break; }
    const index = menu.items.findIndex((it) => script[picks].test(it.label));
    // "respond?" windows are noise here; decline anything the script did not ask for.
    if (index < 0 && pending.type === OcgMessageType.SELECT_CHAIN && menu.zero) { core.duelSetResponse(handle, menu.zero.response); continue; }
    // No Pendulum Summon entry at all is a legitimate outcome, not a script error.
    if (index < 0 && picks === script.length - 1) { offered = []; break; }
    if (index < 0) throw new Error(`no menu item matching ${script[picks]} in:\n${renderMenu(menu).join("\n")}`);
    core.duelSetResponse(handle, chooseFromMenu(menu, String(index + 1)));
    picks++;
  }
  if (offered === null) throw new Error(`duel did not settle within ${MAX_PROCESS_STEPS} process steps`);

  const flags = OcgQueryFlags.CODE | OcgQueryFlags.LEVEL | OcgQueryFlags.LSCALE | OcgQueryFlags.RSCALE;
  const scales = {};
  core.duelQueryLocation(handle, { flags, controller: 0, location: OcgLocation.SZONE }).forEach((card, seq) => {
    if (card) scales[`s${seq}`] = { leftScale: card.leftScale, rightScale: card.rightScale };
  });
  core.destroyDuel(handle);
  return { offered, scales };
}

test("cards.cdb decoding: printed Level and BOTH printed Pendulum Scales", () => {
  // Trump Witch's Scale is 4, not 1 — a natural but wrong guess from its Level 1.
  const witch = cardReader(codeOf("Performapal Trump Witch"));
  assert.deepEqual([witch.level, witch.lscale, witch.rscale], [1, 4, 4]);
  const dragonpit = cardReader(codeOf("Dragonpit Magician"));
  assert.deepEqual([dragonpit.level, dragonpit.lscale, dragonpit.rscale], [7, 8, 8]);
  const stargazer = cardReader(codeOf("Stargazer Magician"));
  assert.deepEqual([stargazer.level, stargazer.lscale, stargazer.rscale], [5, 1, 1]);
  // Non-Pendulum monsters carry no scales and their level byte is undisturbed.
  assert.deepEqual([cardInfo(codeOf("Magna Drago")).level, cardInfo(codeOf("Metaphys Armed Dragon")).level], [2, 7]);
});

test("engine: Pendulum Summon window is (min scale, max scale), both scales reaching the core", async () => {
  // The board from duel PendyVsSpell turn 6: Scale 4 on the left, Scale 8 on the
  // right. The printed rules admit Levels 5-7 — Stargazer and Metaphys only.
  const hand = ["Kuriboh", "Magna Drago", "Sangan", "Performapal Salutiger", "Stargazer Magician", "Metaphys Armed Dragon"];
  const { offered, scales } = await pendulumWindow("Performapal Trump Witch", "Dragonpit Magician", hand);
  assert.deepEqual([scales.s0.leftScale, scales.s0.rightScale], [4, 4]);
  assert.deepEqual([scales.s4.leftScale, scales.s4.rightScale], [8, 8], PATCH_NOTE);
  assert.deepEqual(offered, ["Stargazer Magician", "Metaphys Armed Dragon"], PATCH_NOTE);
});

test("engine: a Scale 1 / Scale 8 pair admits Levels 2-7", async () => {
  const hand = ["Kuriboh", "Magna Drago", "Sangan", "Performapal Salutiger", "Metaphys Armed Dragon"];
  const { offered, scales } = await pendulumWindow("Stargazer Magician", "Dragonpit Magician", hand);
  assert.deepEqual([scales.s0.leftScale, scales.s4.rightScale], [1, 8], PATCH_NOTE);
  assert.deepEqual(offered, ["Magna Drago", "Sangan", "Performapal Salutiger", "Metaphys Armed Dragon"], PATCH_NOTE);
});

test("engine: the Endymion board — Jackal King (4) / Magister (8) offers Endymion (Lv7)", async () => {
  // Reported 2026-08-18 on the live site: no Pendulum Summon entry at all with these
  // scales and Endymion in hand — the collapsed (0, 4) window admitted no Level 7.
  const { offered } = await pendulumWindow("Mythical Beast Jackal King", "Magister of Endymion", ["Endymion, the Mighty Master of Magic", "Sangan"]);
  assert.deepEqual(offered, ["Endymion, the Mighty Master of Magic"]);
});

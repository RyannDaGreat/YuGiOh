/**
 * The static host must play the SAME rules as Node. Its card data comes from the
 * baked bundle instead of cards.cdb, and the field that difference can silently
 * drop is `alias` — which IS Konami's "this card is always treated as X" (Project
 * Ignis puts no Lua on A Legendary Ocean; `datas.alias = Umi` is the whole of it).
 *
 * Losing it breaks nothing visibly: the card is named, summoned and destroyed as
 * usual, and only the effects that ask for the other name quietly stop existing —
 * exactly how it was found (Levia-Dragon - Daedalus offering no activation over a
 * face-up A Legendary Ocean, mid-duel, in the browser).
 *
 * So this file installs ONLY the browser source — node:test gives each file its
 * own process, so nothing here can be answered by the Node source — and asks the
 * real core the two questions that game raised.
 *
 * Run: npm test
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import createCore, { OcgDuelMode, OcgLocation, OcgMessageType, OcgPosition, OcgResponseType, SelectBattleCMDAction, SelectIdleCMDAction } from "ocgcore-wasm";
import { cardReader, codeOf, scriptReader } from "../src/cards.js";
import { openBrowserCardSource } from "../src/cardsource-browser.js";

const BUNDLE = join(dirname(fileURLToPath(import.meta.url)), "../web/static/carddata");
/** Enough deck to survive the few draws below without decking out. */
const DECK_CARDS = 10;
/** A first turn has no Battle Phase, so the board has to live until P0's second one. */
const MAX_STEPS = 2000;

/** Query. Serves the committed bundle from disk, standing in for the network. */
function serve(url) {
  const file = url.match(/^bundle:\/carddata\/(.+)$/);
  const path = file && join(BUNDLE, file[1]);
  return path && existsSync(path) ? readFileSync(path, "utf8") : null;
}

globalThis.fetch = async (url) => {
  const body = serve(url);
  return { ok: body !== null, status: body === null ? 404 : 200, text: async () => body ?? "" };
};
globalThis.XMLHttpRequest = class {
  open(_method, url) { this.url = url; }
  send() { const body = serve(this.url); this.status = body === null ? 404 : 200; this.responseText = body ?? ""; }
};

/**
 * Query. Plays a board of pre-placed cards up to P0's first Battle Phase.
 *
 * Args:
 *     board (Array<{code, controller, location, sequence}>): Cards to put on the
 *         field face-up before the duel starts.
 *
 * Returns:
 *     Promise<{errors, idle, battle}>: the core's script errors, P0's first
 *     main-phase decision and its first battle-phase decision.
 */
async function playToBattle(board) {
  const core = await createCore({ sync: true });
  const errors = [];
  const handle = core.createDuel({
    flags: OcgDuelMode.MODE_MR5,
    seed: [1n, 2n, 3n, 4n],
    team1: { startingLP: 8000, startingDrawCount: 0, drawCountPerTurn: 1 },
    team2: { startingLP: 8000, startingDrawCount: 0, drawCountPerTurn: 1 },
    cardReader,
    scriptReader,
    errorHandler: (type, text) => errors.push(`${type}: ${text}`),
  });
  for (const name of ["constant.lua", "utility.lua"]) core.loadScript(handle, name, scriptReader(name));
  const put = (card) => core.duelNewCard(handle, { team: card.controller, duelist: 0, position: OcgPosition.FACEUP_ATTACK, ...card });
  for (const controller of [0, 1]) {
    for (let i = 0; i < DECK_CARDS; i++) {
      put({ code: codeOf("7 Colored Fish"), controller, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN_DEFENSE });
    }
  }
  for (const card of board) put(card);
  core.startDuel(handle);

  let idle = null;
  let battle = null;
  for (let step = 0; step < MAX_STEPS && !battle; step++) {
    core.duelProcess(handle);
    for (const msg of core.duelGetMessage(handle)) {
      if (msg.type === OcgMessageType.SELECT_IDLECMD) {
        if (msg.player === 0 && !idle) idle = msg;
        const action = msg.to_bp ? SelectIdleCMDAction.TO_BP : SelectIdleCMDAction.TO_EP;
        core.duelSetResponse(handle, { type: OcgResponseType.SELECT_IDLECMD, action, index: null });
      } else if (msg.type === OcgMessageType.SELECT_BATTLECMD) {
        if (msg.player === 0) battle = msg;
        else core.duelSetResponse(handle, { type: OcgResponseType.SELECT_BATTLECMD, action: SelectBattleCMDAction.TO_EP, index: null });
      }
    }
  }
  return { errors, idle, battle };
}

test("browser host: A Legendary Ocean is 'Umi' to the core, so the cards that name it work", async () => {
  await openBrowserCardSource("bundle:/carddata");
  assert.equal(cardReader(codeOf("A Legendary Ocean")).alias, codeOf("Umi"), "the bundle carries the alias at all");

  const daedalus = codeOf("Levia-Dragon - Daedalus");
  const bugroth = codeOf("Amphibious Bugroth MK-3");
  const { errors, idle, battle } = await playToBattle([
    { code: daedalus, controller: 0, location: OcgLocation.MZONE, sequence: 0 },
    { code: bugroth, controller: 0, location: OcgLocation.MZONE, sequence: 1 },
    { code: codeOf("A Legendary Ocean"), controller: 0, location: OcgLocation.SZONE, sequence: 5 },
    { code: codeOf("7 Colored Fish"), controller: 1, location: OcgLocation.MZONE, sequence: 0 },
  ]);
  assert.deepEqual(errors, [], "no card script errors");
  // "You can send 1 face-up 'Umi' you control to the GY; destroy all other cards".
  assert.ok(idle.activates.some((a) => a.code === daedalus), "Daedalus can send A Legendary Ocean as its cost");
  // "As long as 'Umi' remains face-up on the field, this card can attack directly".
  assert.equal(battle.attacks.find((a) => a.code === bugroth).can_direct, true, "Bugroth may attack directly under it");
});

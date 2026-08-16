/**
 * One-stop API over a duel record: replay it, then answer "what does viewer X
 * see?" and "apply viewer X's choice". The CLI and (later) the web UI are both
 * thin skins over this module, so they cannot drift apart.
 */

import { OcgMessageType } from "ocgcore-wasm";
import { expandDeck, replayDuel, STARTING_LP } from "./duel.js";
import { renderLog } from "./log.js";
import { buildMenu, chooseFromMenu, hintsBefore, renderMenu } from "./menu.js";
import { mulberry32 } from "./rng.js";
import { renderState } from "./state.js";
import { loadDuel, saveDuel } from "./store.js";
import { maskStream, SPECTATOR } from "./view.js";

/**
 * Pure function. Parses a viewer argument: "0", "1", or "all"/"spectator".
 *
 * Args:
 *     text (string|number): The --as value.
 *
 * Returns:
 *     0|1|2
 *
 * Examples:
 *     >>> parseViewer("1")    // 1
 *     >>> parseViewer("all")  // 2
 */
export function parseViewer(text) {
  const t = String(text).toLowerCase();
  if (t === "0" || t === "p0") return 0;
  if (t === "1" || t === "p1") return 1;
  if (t === "all" || t === "spectator" || t === "2") return SPECTATOR;
  throw new Error(`--as must be 0, 1 or all (got ${JSON.stringify(text)})`);
}

/**
 * Command. Replays a duel record and computes one viewer's complete picture.
 * The returned core handle is destroyed before returning; nothing leaks.
 *
 * Args:
 *     duel (object): Record from store.loadDuel.
 *     viewer (0|1|2): Perspective.
 *
 * Returns:
 *     {
 *       ended: boolean, winner: number|null, winReason: number|null,
 *       pendingPlayer: number|null,          who the core is waiting on
 *       logLines: string[],                  YGN log for the viewer
 *       stateLines: string[],                full state for the viewer
 *       menu: Menu|null,                     if the viewer is (or can see) the asked player
 *       menuLines: string[],
 *       messageCount: number,                total masked messages for this viewer
 *       applied: number,                     recorded responses consumed
 *     }
 */
export async function viewDuel(duel, viewer) {
  const decks = duel.decks.map((d) => d.main);
  const result = await replayDuel({ seed: duel.seed, decks, responses: duel.responses });
  try {
    const masked = maskStream(result.messages, viewer);
    const { lines: logLines, field } = renderLog(masked, { viewer, startingLP: STARTING_LP, deckSizes: decks.map((d) => expandDeck(d).length) });
    const stateLines = renderState(result.core, result.handle, {
      viewer,
      deckNames: duel.decks.map((d) => d.name),
      deckCodes: decks.map(expandDeck),
      model: field,
    });
    const pendingPlayer = result.pending ? result.pending.player : null;
    let menu = null;
    if (result.pending && (viewer === SPECTATOR || viewer === pendingPlayer)) {
      // The menu must be built from the ASKED player's masked view of the question.
      const askedView = maskStream(result.messages, pendingPlayer);
      const askedField = viewer === pendingPlayer ? field : renderLog(askedView, { viewer: pendingPlayer, startingLP: STARTING_LP, deckSizes: decks.map((d) => expandDeck(d).length) }).field;
      menu = buildMenu(askedView[askedView.length - 1], { ...hintsBefore(askedView), field: askedField });
    }
    return {
      ended: result.ended,
      winner: field.winner,
      winReason: field.winReason,
      pendingPlayer,
      logLines,
      stateLines,
      menu,
      menuLines: menu ? renderMenu(menu) : [],
      messageCount: masked.length,
      applied: result.applied,
    };
  } finally {
    result.core.destroyDuel(result.handle);
  }
}

/**
 * Command. Applies a player's choice to a duel: validates it against the menu,
 * checks the core accepts it, appends it to the record, and saves.
 *
 * Args:
 *     id (string): Duel id.
 *     player (0|1): Who is answering (must match whom the core is asking).
 *     choice (string): Menu choice text (see menu.js), or "random".
 *
 * Returns:
 *     {response: OcgResponse, chosenLabel: string, newLogLines: string[], next: {pendingPlayer, ended}}
 *     `newLogLines` are the viewer's log lines produced by this move.
 *
 * Throws:
 *     Error: not this player's turn to answer, malformed choice, or the core
 *     rejected the response. Nothing is saved in any of those cases.
 */
export async function playChoice(id, player, choice) {
  const duel = loadDuel(id);
  const before = await viewDuel(duel, player);
  if (before.ended) throw new Error(`duel ${id} is over`);
  if (before.pendingPlayer !== player) throw new Error(`it is P${before.pendingPlayer}'s decision, not P${player}'s`);

  const menu = before.menu;
  const text = choice === "random" ? randomChoice(menu, duel.responses.length + duel.seed) : choice;
  const response = chooseFromMenu(menu, text);
  const chosenLabel = describeChoice(menu, text);

  // Dry-run: the replay throws on MSG_RETRY, so a core-rejected response never
  // reaches the file.
  const trial = { ...duel, responses: [...duel.responses, response] };
  const after = await viewDuel(trial, player);
  saveDuel(trial);
  const newLogLines = after.logLines.slice(before.logLines.length);
  return { response, chosenLabel, newLogLines, next: { pendingPlayer: after.pendingPlayer, ended: after.ended } };
}

/**
 * Pure function. A uniformly random valid choice string for a menu — the
 * "random legal move" policy, and a fuzzer for the menu code.
 *
 * Args:
 *     menu (Menu): From buildMenu.
 *     seed (number): Determines the pick.
 *
 * Returns:
 *     string: Choice text accepted by chooseFromMenu.
 *
 * Examples:
 *     >>> randomChoice({mode: "one", items: [{}, {}], zero: null}, 1)   // "1" or "2"
 */
export function randomChoice(menu, seed) {
  const rand = mulberry32(seed);
  const pick = (n) => Math.floor(rand() * n);
  const optionCount = menu.items.length + (menu.zero ? 1 : 0);
  if (menu.mode === "one") {
    const k = pick(optionCount);
    return k === menu.items.length ? "0" : `${k + 1}`;
  }
  if (menu.mode === "many") {
    if (menu.zero && pick(4) === 0) return "0";
    const count = menu.min + pick(menu.max - menu.min + 1);
    const idx = [...menu.items.keys()].sort(() => rand() - 0.5).slice(0, count);
    return idx.map((i) => i + 1).join(",");
  }
  if (menu.mode === "order") return [...menu.items.keys()].sort(() => rand() - 0.5).map((i) => i + 1).join(",");
  if (menu.mode === "counters") return `1:${menu.items[0] ? 1 : 0}`;
  throw new Error(`randomChoice cannot answer a ${menu.mode} menu`);
}

/**
 * Pure function. Human label of what was chosen, for the play receipt.
 *
 * Examples:
 *     >>> describeChoice({items: [{label: "End turn"}], zero: null}, "1") // "End turn"
 */
function describeChoice(menu, text) {
  if (text.trim() === "0" && menu.zero) return menu.zero.label;
  if (text.startsWith("name:")) return text;
  return text.split(",").map((t) => menu.items[Number(t.trim().split(":")[0]) - 1]?.label ?? t).join(" + ");
}

/**
 * Query. Which message types the core is waiting on, by name — for `ygo list`.
 */
export const QUESTION_NAME = Object.fromEntries(Object.entries(OcgMessageType).filter(([k]) => Number.isNaN(Number(k))).map(([k, v]) => [v, k]));

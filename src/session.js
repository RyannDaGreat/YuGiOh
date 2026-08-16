/**
 * One-stop API over a duel record: replay it, then answer "what does viewer X
 * see?" and "apply viewer X's choice". The CLI and (later) the web UI are both
 * thin skins over this module, so they cannot drift apart.
 */

import { replayDuel, STARTING_LP } from "./duel.js";
import { extractEvents } from "./events.js";
import { renderLog } from "./log.js";
import { OcgMessageType } from "ocgcore-wasm";
import { buildMenu, chooseFromMenu, hintsBefore, renderMenu, timingWords } from "./menu.js";
import { mulberry32 } from "./rng.js";
import { collectState, renderState } from "./state.js";
import { loadDuel, saveDuel } from "./store.js";
import { cardInfo, summarizeCard } from "./cards.js";
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
 *     at (number|undefined): Replay only the first `at` responses — the board as
 *         it stood at that move. Undefined = the latest position.
 *
 * Returns:
 *     {
 *       ended: boolean, winner: number|null, winReason: number|null,
 *       pendingPlayer: number|null,          who the core is waiting on
 *       logLines: string[],                  YGN log for the viewer
 *       state: object,                       structured state (state.js collectState)
 *       stateLines: string[],                the same as text
 *       menu: Menu|null,                     if the viewer is (or can see) the asked player
 *       menuLines: string[],
 *       pending: object|null,                the asked player's masked view of the pending question
 *       messageCount: number,                total masked messages for this viewer
 *       applied: number,                     recorded responses consumed
 *       at: number, total: number,           position shown / moves in the record
 *       events: object[],                    animation digest (events.js), indices into the masked stream
 *     }
 */
export async function viewDuel(duel, viewer, at) {
  const deckCodes = duel.decks.map((d) => d.codes);
  const responses = at === undefined ? duel.responses : duel.responses.slice(0, at);
  const result = await replayDuel({ seed: duel.seed, deckCodes, responses });
  try {
    const masked = maskStream(result.messages, viewer);
    const deckSizes = deckCodes.map((c) => c.length);
    const { lines: logLines, field } = renderLog(masked, { viewer, startingLP: STARTING_LP, deckSizes });
    const state = collectState(result.core, result.handle, {
      viewer,
      deckNames: duel.decks.map((d) => d.name),
      deckCodes,
      model: field,
    });
    const stateLines = renderState(state);
    const pendingPlayer = result.pending ? result.pending.player : null;
    let menu = null;
    let pending = null;
    if (result.pending && (viewer === SPECTATOR || viewer === pendingPlayer)) {
      // The menu must be built from the ASKED player's masked view of the question.
      const askedView = maskStream(result.messages, pendingPlayer);
      const askedField = viewer === pendingPlayer ? field : renderLog(askedView, { viewer: pendingPlayer, startingLP: STARTING_LP, deckSizes }).field;
      pending = askedView[askedView.length - 1];
      menu = buildMenu(pending, { ...hintsBefore(askedView), field: askedField });
    }
    return {
      ended: result.ended,
      winner: field.winner,
      winReason: field.winReason,
      pendingPlayer,
      logLines,
      state,
      stateLines,
      menu,
      menuLines: menu ? renderMenu(menu) : [],
      pending,
      messageCount: masked.length,
      applied: result.applied,
      at: responses.length,
      total: duel.responses.length,
      events: extractEvents(masked, viewer, STARTING_LP, deckSizes),
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
 * Pure function. Every distinct card of a decklist with stats and full effect
 * text — the reference block at the top of an LLM's context.
 *
 * Args:
 *     deck ({name, main, codes}): A duel-record deck.
 *
 * Returns:
 *     string[]: One block per distinct card, sorted by name.
 *
 * Examples:
 *     >>> deckReference({name: "Kaiba", main: [["Blue-Eyes White Dragon", 1]], codes: [89631139]})[0]
 *     "1x Blue-Eyes White Dragon [LIGHT Dragon Normal Monster Lv8 ATK3000 DEF2500]\n   This legendary dragon ..."
 */
export function deckReference(deck) {
  const counts = new Map();
  for (const code of deck.codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, n]) => ({ n, code, name: cardInfo(code)?.name ?? String(code) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ n, code }) => `${n}x ${summarizeCard(code)}\n   ${(cardInfo(code)?.desc ?? "").replace(/\s*\n\s*/g, " / ")}`);
}

/**
 * Command. The complete text an LLM player receives for one seat: both
 * decklists with card text, the full log from that seat, the current state,
 * and the pending menu. Replays the duel.
 *
 * Args:
 *     duel (object): Record from store.loadDuel.
 *     viewer (0|1|2): Seat (2 = omniscient, for judges).
 *     at (number|undefined): Position; undefined = latest.
 *
 * Returns:
 *     Promise<string>
 */
export async function promptText(duel, viewer, at) {
  const view = await viewDuel(duel, viewer, at);
  const who = viewer === SPECTATOR ? "You are the spectator (omniscient)." : `You are P${viewer} (${duel.players[viewer]}), playing the ${duel.decks[viewer].name} deck.`;
  const sections = [
    `# Duel ${duel.id}`,
    `${who} P0 (${duel.players[0]}, ${duel.decks[0].name}) took turn 1. Both decklists are public knowledge.`,
    "",
    ...duel.decks.map((d, p) => [`## P${p} decklist — ${d.name} (${d.codes.length} cards)`, ...deckReference(d), ""]).flat(),
    "## Log (your perspective)",
    ...view.logLines,
    "",
    "## Current state",
    ...view.stateLines,
    "",
    view.ended ? `## Result\n${view.winner === 2 ? "Draw." : `P${view.winner} wins.`}` : `## Waiting on P${view.pendingPlayer}`,
    ...(view.menuLines.length ? ["", "## Your options", ...view.menuLines] : []),
  ];
  return sections.join("\n");
}

/**
 * Pure function. Should an optional "respond?" prompt be auto-declined?
 *
 * The core asks the non-turn player at every timing window where any set card
 * is legally activatable, which for an LLM player is a paid round trip per
 * window. This lets a player pre-declare what they care about: only be asked
 * when one of `askFor` cards is among the options, and (if given) only at a
 * timing whose description mentions one of `askAt` words.
 *
 * Args:
 *     menu (Menu): The built menu for the pending question.
 *     pending (OcgMessage): The pending message (must be SELECT_CHAIN).
 *     opts.askFor (string[]): Card names (case-insensitive) worth stopping for; empty = none.
 *     opts.askAt (string[]): Timing keywords (matched against timingWords); empty = any timing.
 *
 * Returns:
 *     boolean: true to auto-answer "do not activate".
 *
 * Examples:
 *     >>> shouldAutoPass({items: [{label: "Activate Reinforcements (P1 s1)"}]}, {type: 16, forced: false, hint_timing: 0x10000, hint_timing_other: 0}, {askFor: [], askAt: []})
 *     true
 *     >>> shouldAutoPass({items: [{label: "Activate Trap Hole (P1 s2)"}]}, {type: 16, forced: false, hint_timing: 0x40, hint_timing_other: 0}, {askFor: ["trap hole"], askAt: []})
 *     false
 *     >>> shouldAutoPass({items: [{label: "Activate Trap Hole (P1 s2)"}]}, {type: 16, forced: false, hint_timing: 0x1, hint_timing_other: 0}, {askFor: ["trap hole"], askAt: ["summon"]})
 *     true
 *     >>> shouldAutoPass({items: []}, {type: 16, forced: true}, {askFor: [], askAt: []})  // false (forced)
 */
export function shouldAutoPass(menu, pending, { askFor, askAt }) {
  if (pending.type !== OcgMessageType.SELECT_CHAIN || pending.forced) return false;
  const wanted = menu.items.some((item) => askFor.some((name) => item.label.toLowerCase().includes(name.toLowerCase())));
  if (!wanted) return true;
  if (askAt.length === 0) return false;
  const timing = timingWords(pending.hint_timing | pending.hint_timing_other).toLowerCase();
  return !askAt.some((word) => timing.includes(word.toLowerCase()));
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
 * Pure function. The JSON-safe part of a menu for a UI: labels and modes,
 * without the response builders (the server rebuilds the menu to apply a
 * choice; the client only needs to render and send choice text).
 *
 * Args:
 *     menu (Menu|null): From buildMenu.
 *
 * Returns:
 *     {title, items: string[], zero: string|null, mode, min, max}|null
 *
 * Examples:
 *     >>> menuSummary({title: "t", items: [{label: "a"}], zero: null, mode: "one", min: 1, max: 1})
 *     {title: "t", items: ["a"], zero: null, mode: "one", min: 1, max: 1}
 */
export function menuSummary(menu) {
  if (!menu) return null;
  return { title: menu.title, items: menu.items.map((i) => i.label), zero: menu.zero?.label ?? null, mode: menu.mode, min: menu.min, max: menu.max };
}

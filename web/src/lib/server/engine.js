/**
 * Server-side bridge to the duel engine in ../../../../src. Everything the web
 * UI can do goes through session.js — the same module the CLI uses — so the two
 * interfaces cannot disagree about a duel.
 */

import { cardInfo, codeOf, summarizeCard } from "../../../../src/cards.js";
import { menuSummary, parseViewer, playChoice, promptText, viewDuel } from "../../../../src/session.js";
import { createDuel, forkDuel, listDecks, listDuels, loadDeck, loadDuel } from "../../../../src/store.js";
import { victoryString } from "../../../../src/strings.js";

export { listDecks, listDuels, parseViewer };

/**
 * Command. Builds the JSON payload for one viewer of one duel (replays it).
 *
 * Args:
 *     id (string): Duel id.
 *     viewer (0|1|2)
 *
 * Returns:
 *     Promise<object>: {id, viewer, players, ended, winner, winText, pendingPlayer, state, logLines, menu, moves}
 */
export async function duelPayload(id, viewer, at) {
  const duel = loadDuel(id);
  const view = await viewDuel(duel, viewer, at);
  const prompt = await promptText(duel, viewer, at);
  return {
    prompt,
    id,
    viewer,
    at: view.at,
    total: view.total,
    players: duel.players,
    ended: view.ended,
    winner: view.winner,
    winText: view.ended ? victoryString(view.winReason) : null,
    pendingPlayer: view.pendingPlayer,
    state: view.state,
    logLines: view.logLines,
    menu: menuSummary(view.menu),
    events: view.events,
    moves: duel.responses.length,
  };
}

/**
 * Command. Applies a choice for a player. Throws on anything invalid.
 */
export async function play(id, player, choice) {
  return playChoice(id, player, choice);
}

/**
 * Command. Creates a duel from form values.
 */
export function newDuel({ id, p0, p1, seed, players }) {
  const decks = [loadDeck(p0), loadDeck(p1)];
  const seedValue = seed === "" || seed === undefined ? Math.floor(Math.random() * 2 ** 32) : Number(seed);
  return createDuel({ id, seed: seedValue, decks, players, created: new Date().toISOString() });
}

/**
 * Command. Branches a duel at a move under a new id (see store.forkDuel).
 */
export function fork(id, newId, at) {
  return forkDuel(id, newId, at, undefined, new Date().toISOString());
}

/**
 * Query. Card text for a tooltip.
 */
export function cardText(name) {
  const info = cardInfo(codeOf(name));
  return { summary: summarizeCard(info.code), desc: info.desc, code: info.code };
}

/**
 * Command. One-line summaries of every duel for the index page.
 */
export async function duelSummaries() {
  const rows = [];
  for (const id of listDuels()) {
    const duel = loadDuel(id);
    const view = await viewDuel(duel, 2);
    rows.push({
      id,
      decks: duel.decks.map((d) => d.name),
      players: duel.players,
      moves: duel.responses.length,
      status: view.ended ? `over — P${view.winner} wins (${victoryString(view.winReason)})` : `waiting on P${view.pendingPlayer}`,
    });
  }
  return rows;
}

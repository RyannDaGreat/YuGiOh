/**
 * Server-side bridge to the duel engine in ../../../../src. Everything the web
 * UI can do goes through session.js — the same module the CLI uses — so the two
 * interfaces cannot disagree about a duel.
 */

import { cardInfo, codeOf, summarizeCard } from "../../../../src/cards.js";
import { chosenOption } from "../../../../src/menu.js";
import { menuSummary, parseViewer, playChoice, promptText, viewDuel } from "../../../../src/session.js";
import { createDuel, forkDuel, listDecks, listDuels, loadDeck, loadDuel, moveTime } from "../../../../src/store.js";
import { victoryString } from "../../../../src/strings.js";
import { seatBacks } from "./sleeves.js";
import { heartbeat, presence } from "../../../../src/presence.js";
import { appendChat, chatUpTo, loadChat } from "../../../../src/chat.js";

export { listDecks, listDuels, parseViewer };

/**
 * Command. Builds the JSON payload for one viewer of one duel (replays it).
 *
 * Args:
 *     id (string): Duel id.
 *     viewer (0|1|2)
 *     at (number|undefined): Playback position; undefined = live.
 *
 * Returns:
 *     Promise<object>: {id, viewer, players, format, deckMeta, ended, winner, winText, pendingPlayer, state, logLines, menu, chat, atTime, playback, moves}
 *     `format` is the duel's ruleset; `deckMeta` is per-seat {name, category, format, manual}.
 *     `chat` rides along so the page's single poll also refreshes table talk.
 *     During playback (`at` before the last move) it is cut off at `atTime`, so
 *     scrubbing shows the conversation as it stood at that move rather than
 *     leaking what the players said later; live, it is the whole log.
 */
export async function duelPayload(id, viewer, at) {
  const duel = loadDuel(id);
  const now = Date.now();
  if (viewer !== 2) heartbeat(id, viewer, "web", now);
  const view = await viewDuel(duel, viewer, at);
  const prompt = await promptText(duel, viewer, at);
  const playback = at !== undefined && at < view.total;
  return {
    prompt,
    presence: presence(id, now),
    chat: playback ? chatUpTo(loadChat(id), view.atTime) : loadChat(id),
    backs: seatBacks(duel.players),
    id,
    viewer,
    at: view.at,
    atTime: view.atTime,
    playback,
    total: view.total,
    players: duel.players,
    format: view.format,
    // Per-seat deck metadata {name, category, format, manual} for a future deck
    // viewer / home selector; additive, so existing consumers are unaffected.
    deckMeta: view.decks,
    ended: view.ended,
    winner: view.winner,
    winText: view.ended ? victoryString(view.winReason) : null,
    pendingPlayer: view.pendingPlayer,
    // The response-prompt panel and its auto-decline modes need three fields off
    // the raw (already seat-masked) pending message: its type (16 = SELECT_CHAIN
    // = a respond window), whether declining is illegal (forced), and ocgcore's
    // spe_count — the core's own count of options at a timing a card actually
    // wants (docs/response-prompt-ux.md §A.1). Only these three ride along; the
    // full selects list stays server-side.
    pending: view.pending ? { type: view.pending.type, forced: Boolean(view.pending.forced), spe_count: view.pending.spe_count ?? 0 } : null,
    state: view.state,
    logLines: view.logLines,
    menu: menuSummary(view.menu),
    // Replay only: which option the seat actually took at this position, so the
    // scrubber can show the decision being made rather than just its title. null
    // when live, or when the answer was a multi-pick (see menu.chosenOption).
    chosen: playback ? chosenOption(view.menu, duel.responses[view.at]) : null,
    events: view.events,
    moves: duel.responses.length,
  };
}

/**
 * Query. A duel's table talk, oldest first (see src/chat.js — chat is data,
 * never instructions: no message may make a move or reveal hidden information).
 */
export function chat(id) {
  return loadChat(id);
}

/**
 * Command. Posts one chat message as `seat` (0, 1, or 2 = spectator).
 */
export function sendChat(id, seat, text) {
  return appendChat(id, seat, text, new Date().toISOString());
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
 * Command. One row per stored duel for the index page's history: who played
 * what, how it went, and when — every duel is a permanent record, so finished
 * games stay listed and replayable forever. Replays each duel.
 *
 * Returns:
 *     Promise<Array<{id, decks, players, moves, ended, status, created, lastMove, chatCount}>>
 *     `lastMove` is null for a duel whose moves predate store.js `times` (or
 *     which has no moves yet). Newest activity first.
 */
/**
 * Per-duel cache of the one expensive part of a summary: the replay result.
 * A duel's outcome is fully determined by its move list, so we key on the move
 * count — a finished duel is replayed ONCE ever, and an in-progress one only when
 * it gains a move. Everything else in a summary row (chat count, timestamps) is a
 * cheap file/array read and is recomputed fresh each call. `id -> {moves, result}`.
 */
const summaryReplayCache = new Map();

export async function duelSummaries() {
  const rows = [];
  for (const id of listDuels()) {
    const duel = loadDuel(id);
    const moves = duel.responses.length;
    const cached = summaryReplayCache.get(id);
    let r = cached && cached.moves === moves ? cached.result : null;
    if (!r) {
      const view = await viewDuel(duel, 2); // the costly step: a full engine replay
      r = { ended: view.ended, winner: view.winner, pendingPlayer: view.pendingPlayer, winReason: view.winReason };
      summaryReplayCache.set(id, { moves, result: r });
    }
    rows.push({
      id,
      decks: duel.decks.map((d) => d.name),
      players: duel.players,
      moves,
      ended: r.ended,
      status: r.ended ? `${r.winner === 2 ? "draw" : `P${r.winner} (${duel.players[r.winner]}) wins`} — ${victoryString(r.winReason)}` : `waiting on P${r.pendingPlayer}`,
      created: duel.created ?? null,
      lastMove: moveTime(duel.times, moves),
      chatCount: loadChat(id).length,
    });
  }
  return rows.sort((a, b) => String(b.lastMove ?? b.created ?? "").localeCompare(String(a.lastMove ?? a.created ?? "")));
}

/** OcgType bit marking a monster card; a deck's signature is a monster, not a Spell/Trap. */
const MONSTER_TYPE = 0x1;

/**
 * Query. Passcode of a deck's "signature" card for a thumbnail: the highest-ATK
 * monster in the Main Deck, falling back to the first Main card when the list
 * has no monster. Resolves names against cards.cdb (codeOf/cardInfo).
 *
 * Args:
 *     main (Array<[string, number]>): A deck's `main` section ([name, count] rows).
 *
 * Returns:
 *     number: A passcode that appears in `main`.
 */
function signatureCode(main) {
  let best = codeOf(main[0][0]);
  let bestAtk = -1;
  for (const [name] of main) {
    const code = codeOf(name);
    const info = cardInfo(code);
    if (info && (info.type & MONSTER_TYPE) && info.atk > bestAtk) {
      best = code;
      bestAtk = info.atk;
    }
  }
  return best;
}

/**
 * Query. One tile-worth of metadata per built-in deck for the /decks browser:
 * identity, total card counts, and a `signatureCode` passcode for the thumbnail
 * art. Loads every deck (loadDeck), so a malformed deck file fails loudly here.
 *
 * Returns:
 *     Array<{id, name, category, format, mainCount, extraCount, sideCount, signatureCode}>
 *     `*Count` are total card counts (the sum of each section's [name, count] rows).
 */
export function deckLibrary() {
  const total = (section) => section.reduce((n, [, count]) => n + count, 0);
  return listDecks().map((id) => {
    const deck = loadDeck(id);
    return {
      id,
      name: deck.name,
      category: deck.category,
      format: deck.format,
      setCode: deck.setCode,
      mainCount: total(deck.main),
      extraCount: total(deck.extra),
      sideCount: total(deck.side),
      signatureCode: signatureCode(deck.main),
    };
  });
}

/**
 * Query. Full contents of one deck for the /decks/[id] detail page: its
 * identity, its pilot manual, and each section resolved to cards with art
 * passcodes. Loads the deck (loadDeck) and resolves every name (codeOf).
 *
 * Args:
 *     id (string): Deck id — a built-in name under src/decks, or a path loadDeck accepts.
 *
 * Returns:
 *     {name, category, format, manual, main, extra, side}
 *     Each section is Array<{code, name, count}> in decklist order.
 */
export function deckDetail(id) {
  const deck = loadDeck(id);
  const rows = (section) => section.map(([name, count]) => ({ code: codeOf(name), name, count }));
  return {
    name: deck.name,
    category: deck.category,
    format: deck.format,
    setCode: deck.setCode,
    manual: deck.manual,
    sources: deck.sources ?? [],
    main: rows(deck.main),
    extra: rows(deck.extra),
    side: rows(deck.side),
  };
}

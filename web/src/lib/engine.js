/**
 * Bridge from the web UI to the duel engine in ../../../src. Everything the web
 * UI can do goes through session.js — the same module the CLI uses — so the two
 * interfaces cannot disagree about a duel.
 *
 * Host-agnostic on purpose: served from Node this runs behind the /api routes;
 * built as a static page it runs IN the browser, called directly by $lib/api.js.
 * The only difference is which volume and card source were installed at boot
 * (hooks.server.js vs $lib/boot.js) — nothing in here knows or cares.
 */

import { cardInfo, codeOf, summarizeCard } from "../../../src/cards.js";
import { chosenOption } from "../../../src/menu.js";
import { menuSummary, parseViewer, playChoice, promptText, viewDuel } from "../../../src/session.js";
import { boxArtFile, createDuel, forkDuel, listDecks, listDuels, loadDeck, loadDuel, moveTime } from "../../../src/store.js";
import { victoryString } from "../../../src/strings.js";
import { seatBacks } from "./sleeves.js";
import { heartbeat, presence } from "../../../src/presence.js";
import { appendChat, chatUpTo, loadChat } from "../../../src/chat.js";
import { loadSeats } from "../../../src/ai/seats.js";

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
    // Monsters that may still declare an attack, so the table can mark them.
    attackers: view.attackers,
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
export function newDuel({ id, p0, p1, seed, players, seats }) {
  const decks = [loadDeck(p0), loadDeck(p1)];
  const seedValue = seed === "" || seed === undefined ? Math.floor(Math.random() * 2 ** 32) : Number(seed);
  const chosenId = id && String(id).trim() ? String(id).trim() : autoId(p0, p1);
  return createDuel({ id: chosenId, seed: seedValue, decks, players, seats, created: new Date().toISOString() });
}

/**
 * Query. A free duel id when the user did not name one: "<p0>-vs-<p1>", with a
 * counter once that is taken. Nobody knows what a game will be before it is
 * played, so a name is not worth asking for; the decks make it findable later.
 *
 * Args:
 *     p0 (string): P0's deck id.
 *     p1 (string): P1's deck id.
 *
 * Returns:
 *     string: e.g. "yugi-vs-kaiba", then "yugi-vs-kaiba-2", "-3", ...
 *
 * Examples:
 *     >>> autoId("yugi", "kaiba")   // "yugi-vs-kaiba"   (or "yugi-vs-kaiba-2" if that exists)
 */
export function autoId(p0, p1) {
  const taken = new Set(listDuels());
  const stem = `${p0}-vs-${p1}`;
  if (!taken.has(stem)) return stem;
  for (let n = 2; ; n++) if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

/**
 * Command. Plays it again: a fresh duel with the same two decks, the same seat
 * labels and the same seat assignments (human / AI, src/ai/seats.js), a new
 * shuffle, and an automatic id. Returns the new record.
 *
 * Args:
 *     id (string): The finished (or any) duel to rematch.
 *
 * Returns:
 *     object: The new duel record (createDuel).
 *
 * Examples:
 *     >>> rematch("yugi-vs-kaiba").id   // "yugi-vs-kaiba-2"
 */
export function rematch(id) {
  const source = loadDuel(id);
  // The record freezes decks by NAME; resolve them back to library ids.
  const library = deckLibrary();
  const ids = source.decks.map((d) => library.find((x) => x.name === d.name)?.id);
  if (ids.some((x) => !x)) throw new Error(`cannot rematch ${id}: a deck it used is no longer in the library (${source.decks.map((d) => d.name).join(" vs ")})`);
  return newDuel({ id: "", p0: ids[0], p1: ids[1], seed: "", players: source.players, seats: loadSeats(id) });
}

/**
 * Command. Branches a duel at a move under a new id (see store.forkDuel).
 */
export function fork(id, newId, at) {
  // Seats live in the record, so the branch keeps the same human/AI seats by construction.
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
      // Which seat a person sits in, so the home page can offer one "continue"
      // that opens the right view: the human seat if there is exactly one, the
      // spectator view for AI-vs-AI, P0 for human-vs-human.
      seats: [loadSeats(id)[0].kind, loadSeats(id)[1].kind],
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
 * Pure function. A deck's box-art file name for the UI, or null when the deck has
 * no box (curated/user decks, and any structure deck still missing its `boxArt`).
 *
 * WHY the payload carries the FILE NAME and not just `setCode`: DeckThumb builds
 * one URL for both hosts — `{ASSETS}/boxart/<file>`. On the Node host ASSETS is
 * the app base and the /boxart route serves vendor/boxart; on the static host it
 * is raw.githubusercontent.com/.../assets, a dumb file server that can only
 * answer for the real name, extension included. Deriving it here (server-side on
 * Node, in the browser on static) keeps the extension logic in exactly one place,
 * src/store.js `boxArtFile`, shared with `ygo fetch-boxart` which wrote the file.
 *
 * Args:
 *     deck (object): A loaded deck (loadDeck), with `setCode` and `boxArt`.
 *
 * Returns:
 *     string|null
 *
 * Examples:
 *     >>> deckBoxArtFile(loadDeck("kaiba"))   // "SDK.png"
 *     >>> deckBoxArtFile(loadDeck("goat-control"))  // null  (curated, no box)
 */
function deckBoxArtFile(deck) {
  return deck.setCode && deck.boxArt ? boxArtFile(deck.setCode, deck.boxArt) : null;
}

/**
 * Query. One tile-worth of metadata per built-in deck for the /decks browser:
 * identity, total card counts, and a `signatureCode` passcode for the thumbnail
 * art. Loads every deck (loadDeck), so a malformed deck file fails loudly here.
 *
 * Returns:
 *     Array<{id, name, category, format, setCode, boxArtFile, mainCount, extraCount, sideCount, signatureCode}>
 *     `*Count` are total card counts (the sum of each section's [name, count] rows).
 *     `boxArtFile` is the box art's file name WITH extension ("SD1.png") or null —
 *     see deckBoxArtFile.
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
      boxArtFile: deckBoxArtFile(deck),
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
 *     {name, category, format, setCode, boxArtFile, manual, sources, main, extra, side}
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
    boxArtFile: deckBoxArtFile(deck),
    manual: deck.manual,
    sources: deck.sources ?? [],
    main: rows(deck.main),
    extra: rows(deck.extra),
    side: rows(deck.side),
  };
}

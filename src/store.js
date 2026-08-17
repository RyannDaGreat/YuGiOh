/**
 * Duel records on disk.
 *
 * A duel is a JSON file under `duels/`: seed, the two decklists, and the
 * ordered list of responses so far. That is the ENTIRE game — replaying it
 * (see duel.js) reproduces every shuffle, draw, and decision.
 *
 * `times` rides alongside as wall-clock ANNOTATION: `times[i]` is the ISO
 * timestamp at which `responses[i]` was recorded. It is never fed to the core
 * and never changes a replay; it exists so a stored duel can be put back on a
 * clock — which move happened when, and therefore what had been said in chat
 * by that move (see chat.js `chatUpTo`). Records written before `times` existed
 * simply lack it, and every reader must cope: `alignTimes` pads the missing
 * entries with null rather than letting the two arrays drift out of step.
 *
 * WARNING — information boundary: the file holds the seed, from which both
 * hands and both decks follow. A player who reads the file (or replays as
 * SPECTATOR) sees everything. Playing honestly means touching a duel only
 * through `ygo state/log/play --as <you>`. This is an honor-system boundary,
 * chosen over a token-authenticated daemon because every participant runs on
 * one machine anyway; see README "Hidden information".
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, codeOf } from "./cards.js";
import { expandDeck } from "./duel.js";

export const DUELS_DIR = join(REPO_ROOT, "duels");
export const DECKS_DIR = join(REPO_ROOT, "src/decks");

/** Duel ids are short, filesystem-safe, human-typeable (also used by chat.js for `<id>.chat.json`). */
export const DUEL_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** Suffix of the chat log that chat.js keeps beside each duel record; never a duel itself. */
export const CHAT_SUFFIX = ".chat.json";

/**
 * Query. Loads a decklist by name (built-in under src/decks) or by path.
 *
 * Args:
 *     nameOrPath (string): "yugi", "kaiba", or a path to a deck JSON.
 *
 * Returns:
 *     {name: string, main: Array<[string, number]>}
 *
 * Throws:
 *     Error: if the file is missing, or any card name is not in cards.cdb —
 *     a typo in a decklist must fail before the duel is created.
 *
 * Examples:
 *     >>> loadDeck("kaiba").name          // "Kaiba"
 *     >>> loadDeck("kaiba").main.length   // 50
 */
export function loadDeck(nameOrPath) {
  const path = existsSync(nameOrPath) ? nameOrPath : join(DECKS_DIR, `${nameOrPath.toLowerCase()}.json`);
  if (!existsSync(path)) throw new Error(`no such deck: ${nameOrPath} (looked for ${path})`);
  const deck = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(deck.main) || !deck.name) throw new Error(`malformed deck file: ${path}`);
  for (const [name, count] of deck.main) {
    codeOf(name);
    if (!Number.isInteger(count) || count < 1) throw new Error(`bad count for ${name} in ${path}`);
  }
  return { name: deck.name, main: deck.main };
}

/**
 * Query. Names of the built-in decks.
 *
 * Returns:
 *     string[]
 *
 * Examples:
 *     >>> listDecks() // ["kaiba", "yugi"]
 */
export function listDecks() {
  return readdirSync(DECKS_DIR).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
}

/**
 * Pure function. Path of a duel record.
 *
 * Examples:
 *     >>> duelPath("game1").endsWith("duels/game1.json") // true
 */
export function duelPath(id) {
  if (!DUEL_ID_PATTERN.test(id)) throw new Error(`invalid duel id: ${JSON.stringify(id)}`);
  return join(DUELS_DIR, `${id}.json`);
}

/**
 * Query. Ids of all stored duels. `<id>.chat.json` (chat.js) shares this
 * directory and is not a duel, so it is skipped.
 *
 * Args:
 *     dir (string): Directory to scan; defaults to duels/ (tests pass a temp dir).
 *
 * Returns:
 *     string[]
 */
export function listDuels(dir = DUELS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(CHAT_SUFFIX)).map((f) => f.slice(0, -5)).sort();
}

/**
 * Pure function. A record's `times` as exactly one entry per response: missing
 * or short (a record from before timestamps existed, or one rewound by `undo`)
 * is padded with null, longer is truncated. Every reader of `times` goes
 * through this, so index i always means responses[i].
 *
 * Args:
 *     times (Array<string|null>|undefined): The record's `times`, if any.
 *     count (number): Number of responses to align to.
 *
 * Returns:
 *     Array<string|null>: Length `count`.
 *
 * Examples:
 *     >>> alignTimes(["2026-08-16T18:00:00.000Z"], 3)
 *     ["2026-08-16T18:00:00.000Z", null, null]
 *     >>> alignTimes(undefined, 2)   // [null, null]   (a record written before `times`)
 *     >>> alignTimes(["a", "b"], 1)  // ["a"]
 */
export function alignTimes(times, count) {
  const known = times ?? [];
  return Array.from({ length: count }, (_, i) => known[i] ?? null);
}

/**
 * Pure function. When the position "after `at` moves" happened: the timestamp
 * of the last replayed response, or null if it is the start of the duel or
 * that move predates timestamps.
 *
 * Args:
 *     times (Array<string|null>|undefined): The record's `times`.
 *     at (number): How many responses have been replayed.
 *
 * Returns:
 *     string|null: ISO timestamp.
 *
 * Examples:
 *     >>> moveTime(["2026-08-16T18:00:00.000Z", "2026-08-16T18:01:00.000Z"], 2)
 *     "2026-08-16T18:01:00.000Z"
 *     >>> moveTime(["2026-08-16T18:00:00.000Z"], 0)  // null  (nothing has been played yet)
 *     >>> moveTime(undefined, 5)                     // null  (no timestamps in this record)
 */
export function moveTime(times, at) {
  if (at <= 0) return null;
  return (times ?? [])[at - 1] ?? null;
}

/**
 * Query. Reads a duel record.
 *
 * Args:
 *     id (string): Duel id.
 *
 * Returns:
 *     {id, created, seed, decks: [{name, main, codes}, {name, main, codes}], players: [string, string], responses: OcgResponse[], times?: Array<string|null>}
 *     `codes` are the passcodes frozen at creation (see replayDuel).
 *     `times[i]` is when `responses[i]` was played; absent on old records, so
 *     read it through `alignTimes`/`moveTime`, never by raw index.
 */
export function loadDuel(id) {
  const path = duelPath(id);
  if (!existsSync(path)) throw new Error(`no such duel: ${id}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Command. Writes a duel record atomically (temp file + rename).
 *
 * Args:
 *     duel (object): Record as returned by loadDuel/createDuel.
 */
export function saveDuel(duel) {
  mkdirSync(DUELS_DIR, { recursive: true });
  const path = duelPath(duel.id);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(duel, null, 1));
  renameSync(tmp, path);
}

/**
 * Command. Copies a duel truncated to its first `at` responses under a new id —
 * a branch point for "what if I had played differently here".
 *
 * Args:
 *     id (string): Source duel id.
 *     newId (string): Id for the branch (must not exist).
 *     at (number): How many responses to keep (their `times` come along, so the
 *         branch keeps the original moves' clock and only diverges after `at`).
 *     players ([string, string]|undefined): New seat labels; default = source's.
 *     created (string): ISO timestamp.
 *
 * Returns:
 *     object: The saved branch record.
 */
export function forkDuel(id, newId, at, players, created) {
  const source = loadDuel(id);
  if (!Number.isInteger(at) || at < 0 || at > source.responses.length) throw new Error(`--at must be 0..${source.responses.length}`);
  if (existsSync(duelPath(newId))) throw new Error(`duel already exists: ${newId}`);
  const branch = { ...source, id: newId, created, players: players ?? source.players, responses: source.responses.slice(0, at), times: alignTimes(source.times, source.responses.length).slice(0, at), forkedFrom: { id, at } };
  saveDuel(branch);
  return branch;
}

/**
 * Command. Creates and saves a new duel record.
 *
 * Args:
 *     opts.id (string): Duel id (must not already exist).
 *     opts.seed (number): 32-bit seed.
 *     opts.decks ([deck, deck]): Loaded decklists for P0 (goes first) and P1; passcodes are frozen into the record.
 *     opts.players ([string, string]): Free-text labels ("ryan", "claude", ...).
 *     opts.created (string): ISO timestamp.
 *
 * Returns:
 *     object: The saved record, with empty `responses` and `times`.
 */
export function createDuel({ id, seed, decks, players, created }) {
  if (existsSync(duelPath(id))) throw new Error(`duel already exists: ${id}`);
  const duel = { id, created, seed, decks: decks.map((d) => ({ name: d.name, main: d.main, codes: expandDeck(d.main) })), players, responses: [], times: [] };
  saveDuel(duel);
  return duel;
}

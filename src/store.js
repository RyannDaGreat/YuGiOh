/**
 * Duel records on disk.
 *
 * A duel is a JSON file under `duels/`: seed, the two decklists, and the
 * ordered list of responses so far. That is the ENTIRE game — replaying it
 * (see duel.js) reproduces every shuffle, draw, and decision.
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
 * Query. Reads a duel record.
 *
 * Args:
 *     id (string): Duel id.
 *
 * Returns:
 *     {id, created, seed, decks: [{name, main, codes}, {name, main, codes}], players: [string, string], responses: OcgResponse[]}
 *     `codes` are the passcodes frozen at creation (see replayDuel).
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
 *     at (number): How many responses to keep.
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
  const branch = { ...source, id: newId, created, players: players ?? source.players, responses: source.responses.slice(0, at), forkedFrom: { id, at } };
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
 *     object: The saved record.
 */
export function createDuel({ id, seed, decks, players, created }) {
  if (existsSync(duelPath(id))) throw new Error(`duel already exists: ${id}`);
  const duel = { id, created, seed, decks: decks.map((d) => ({ name: d.name, main: d.main, codes: expandDeck(d.main) })), players, responses: [] };
  saveDuel(duel);
  return duel;
}

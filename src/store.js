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
 *
 * DECK SCHEMA (src/decks/*.json, and the frozen copy inside a duel record).
 * A deck file is:
 *   {
 *     "name":     str,                          // display name, e.g. "GOAT Sample"
 *     "category": "structure"|"curated"|"user", // official product | research build | user; default "user"
 *     "setCode":  str,                          // OPTIONAL official product code ("SD1", "SDY"); structure decks only
 *     "boxArt":   str,                          // OPTIONAL URL of the product's real box cover art (structure decks)
 *     "format":   "classic" | "goat",           // ruleset; default "classic"
 *     "main":     [[cardName, count], ...], // Main Deck; goat: 40..60 cards, classic: any
 *     "extra":    [[cardName, count], ...], // OPTIONAL Extra Deck; ≤ 15 cards
 *     "side":     [[cardName, count], ...], // OPTIONAL Side Deck; ≤ 15 cards
 *     "manual":   str,                      // OPTIONAL concise markdown: how to pilot it
 *     "sources":  [str, ...]                // OPTIONAL citations (URLs / references) the
 *                                           //   decklist + manual were researched from
 *   }
 * Deck files are JSONC — line and block comments are allowed (loadDeck strips
 * them) so each card row can also cite its source inline; the `sources` array is
 * the official, machine-readable list of citations for the deck as a whole.
 * Card placement is enforced (loadDeck): every `extra` entry MUST be a
 * Fusion/Synchro/Xyz/Link monster (cards.isExtraDeckCard) and no `main` entry
 * may be — the core keeps those in OcgLocation.EXTRA, not the deck. Both decks
 * of a duel must share one `format`; that becomes the duel-level `format`
 * (createDuel), which duel.js maps to MODE_GOAT vs MODE_MR5. Backward compat: a
 * legacy `{name, main}` file still loads (category "user", format "classic",
 * empty extra/side, empty manual). See the `deck-schema` semantic binding.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import stripJsonComments from "strip-json-comments";
import { REPO_ROOT, cardInfo, codeOf, isExtraDeckCard, typeLabel } from "./cards.js";
import { expandDeck, expandExtra, expandSide } from "./duel.js";

/**
 * A deck's `category`:
 *   "structure" — an official Konami product (Structure/Starter Deck): a fixed
 *                 printed list with an official name, a `setCode`, and box art.
 *   "curated"   — a meta/theme deck we built from research (GOAT netdecks, anime
 *                 themes). Not an official product; identified by a signature card.
 *   "user"      — user-authored.
 */
const DECK_CATEGORIES = ["structure", "curated", "user"];
/** A deck's `format`: the ruleset the duel is built under (see duel.js MODE_*). */
const DECK_FORMATS = ["classic", "goat"];
/** GOAT format is 40–60 Main Deck cards; classic imposes no size (starter decks are 50). */
const GOAT_MAIN_MIN = 40;
const GOAT_MAIN_MAX = 60;
/** Extra and Side decks are each capped at 15 cards, as in every real format. */
const MAX_EXTRA = 15;
const MAX_SIDE = 15;

export const DUELS_DIR = join(REPO_ROOT, "duels");
export const DECKS_DIR = join(REPO_ROOT, "src/decks");

/** Duel ids are short, filesystem-safe, human-typeable (also used by chat.js for `<id>.chat.json`). */
export const DUEL_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** Suffix of the chat log that chat.js keeps beside each duel record; never a duel itself. */
export const CHAT_SUFFIX = ".chat.json";

/**
 * Query. Validates one `[name, count]` section: every name resolves (loud on a
 * typo), every count is a positive integer, and — when `extraOnly` is set —
 * every card is (true) or is not (false) an Extra-Deck monster. `extraOnly`
 * undefined skips the placement check (the side deck may hold anything).
 *
 * Args:
 *     entries (Array<[string, number]>): The section's rows.
 *     opts.path (string): Deck file path, for error messages.
 *     opts.section (string): "main" | "extra" | "side", for error messages.
 *     opts.extraOnly (boolean|undefined): Required extra-deck membership, or skip.
 *
 * Throws:
 *     Error: on an unknown card, a bad count, or a misplaced card.
 */
function validateSection(entries, { path, section, extraOnly }) {
  for (const [name, count] of entries) {
    const code = codeOf(name);
    if (!Number.isInteger(count) || count < 1) throw new Error(`bad count for ${name} in ${path}`);
    if (extraOnly === true && !isExtraDeckCard(code)) {
      throw new Error(`${name} is not an Extra Deck monster but is listed in "extra" of ${path}; move it to "main"`);
    }
    if (extraOnly === false && isExtraDeckCard(code)) {
      throw new Error(`${name} is an Extra Deck monster (${typeLabel(cardInfo(code).type)}) but is listed in "main" of ${path}; Fusion/Synchro/Xyz/Link cards go in "extra"`);
    }
  }
}

/**
 * Query. Loads a decklist by name (built-in under src/decks) or by path, in the
 * full schema (see the DECK SCHEMA block at the top of this file). Backward
 * compatible: a legacy `{name, main}` file loads with category "user", format
 * "classic", and empty extra/side/manual.
 *
 * Args:
 *     nameOrPath (string): "yugi", "kaiba", or a path to a deck JSON.
 *
 * Returns:
 *     {name, category, format, main, extra, side, manual, sources}:
 *     `main`/`extra`/`side` are Array<[string, number]>; `manual` is a (possibly
 *     empty) markdown string; `sources` is a (possibly empty) string[] of citations.
 *
 * Throws:
 *     Error: if the file is missing or malformed; if any card name is not in
 *     cards.cdb (a decklist typo must fail before the duel is created); if an
 *     Extra-Deck monster sits in `main` (or a main-deck card in `extra`); or if
 *     the sizes are illegal (goat main 40–60, extra ≤ 15, side ≤ 15).
 *
 * Examples:
 *     >>> loadDeck("kaiba").name          // "Kaiba"
 *     >>> loadDeck("kaiba").main.length   // 50
 *     >>> loadDeck("kaiba").format        // "classic"
 *     >>> loadDeck("goat-sample").format  // "goat"
 */
export function loadDeck(nameOrPath) {
  const path = existsSync(nameOrPath) ? nameOrPath : join(DECKS_DIR, `${nameOrPath.toLowerCase()}.json`);
  if (!existsSync(path)) throw new Error(`no such deck: ${nameOrPath} (looked for ${path})`);
  // Deck files are JSONC: `//` and `/* */` comments are allowed so each card
  // and each deck can cite the source it was researched from, inline in the
  // file. Stripping is string-aware, so URLs inside "manual"/"note" survive.
  const deck = JSON.parse(stripJsonComments(readFileSync(path, "utf8")));
  if (!Array.isArray(deck.main) || !deck.name) throw new Error(`malformed deck file: ${path}`);

  const category = deck.category ?? "user";
  if (!DECK_CATEGORIES.includes(category)) throw new Error(`bad category ${JSON.stringify(category)} in ${path} (expected one of ${DECK_CATEGORIES.join(", ")})`);
  const format = deck.format ?? "classic";
  if (!DECK_FORMATS.includes(format)) throw new Error(`bad format ${JSON.stringify(format)} in ${path} (expected one of ${DECK_FORMATS.join(", ")})`);

  const main = deck.main;
  const extra = deck.extra ?? [];
  const side = deck.side ?? [];
  if (!Array.isArray(extra) || !Array.isArray(side)) throw new Error(`"extra"/"side" must be arrays in ${path}`);
  const manual = deck.manual ?? "";
  const sources = deck.sources ?? [];
  if (!Array.isArray(sources) || sources.some((s) => typeof s !== "string")) {
    throw new Error(`"sources" must be an array of citation strings in ${path}`);
  }
  // `setCode` is the official product code (e.g. "SD1", "SDY"); structure decks
  // carry one and key their box art off it. Null for curated/user decks.
  const setCode = deck.setCode ?? null;
  if (setCode !== null && typeof setCode !== "string") throw new Error(`"setCode" must be a string in ${path}`);
  // `boxArt` is the source URL of the product's real box cover art. `fetch-boxart`
  // downloads it to vendor/boxart/<setCode>; the URL is recorded here so the image
  // is reproducible (vendor/ is gitignored). Every structure deck should have one.
  const boxArt = deck.boxArt ?? null;
  if (boxArt !== null && typeof boxArt !== "string") throw new Error(`"boxArt" must be a URL string in ${path}`);

  validateSection(main, { path, section: "main", extraOnly: false });
  validateSection(extra, { path, section: "extra", extraOnly: true });
  validateSection(side, { path, section: "side", extraOnly: undefined });

  const mainCount = expandDeck(main).length;
  const extraCount = expandExtra(extra).length;
  const sideCount = expandSide(side).length;
  if (format === "goat" && (mainCount < GOAT_MAIN_MIN || mainCount > GOAT_MAIN_MAX)) {
    throw new Error(`goat main deck must be ${GOAT_MAIN_MIN}–${GOAT_MAIN_MAX} cards, got ${mainCount} in ${path}`);
  }
  if (extraCount > MAX_EXTRA) throw new Error(`extra deck must be ≤ ${MAX_EXTRA} cards, got ${extraCount} in ${path}`);
  if (sideCount > MAX_SIDE) throw new Error(`side deck must be ≤ ${MAX_SIDE} cards, got ${sideCount} in ${path}`);

  return { name: deck.name, category, format, main, extra, side, manual, sources, setCode, boxArt };
}

/**
 * Pure function. The single format shared by a pair of decks, or a loud error
 * if they disagree — a duel is one ruleset, so mixed formats are rejected at
 * creation rather than silently coerced.
 *
 * Args:
 *     decks ([deck, deck]): Loaded decks (loadDeck), each with a `format`.
 *
 * Returns:
 *     "classic" | "goat"
 *
 * Examples:
 *     >>> sharedFormat([{format: "goat"}, {format: "goat"}]) // "goat"
 *     >>> // sharedFormat([{format: "classic"}, {format: "goat"}]) throws
 */
export function sharedFormat(decks) {
  const [a, b] = decks.map((d) => d.format ?? "classic");
  if (a !== b) throw new Error(`both decks must share a format (P0 is "${a}", P1 is "${b}")`);
  return a;
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
 *     {id, created, seed, format, decks: [deck, deck], players: [string, string], responses: OcgResponse[], times?: Array<string|null>}
 *     Each `deck` is {name, category, format, main, extra, side, manual, codes,
 *     extraCodes, sideCodes}. `codes`/`extraCodes`/`sideCodes` are the passcodes
 *     frozen at creation (see replayDuel). `format` is the duel-level ruleset.
 *     Records written before extra decks/format existed lack those fields; every
 *     reader defaults them (format "classic", empty extra/side).
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
 * The temp name is UNIQUE PER WRITER, and that matters. A fixed `<path>.tmp` is
 * atomic against readers but not against other writers: two processes writing the
 * same duel both open the same temp file, their writes interleave, and the rename
 * then publishes the shredded result as a valid-looking record. That is not
 * theoretical — it destroyed `sdc-SDP-vs-SDSC-g3` during the structure-deck
 * tournament when a seed reset ran while an agent was mid-move. Distinct temp
 * names make concurrent writers merely last-one-wins instead of corrupting.
 *
 * Args:
 *     duel (object): Record as returned by loadDuel/createDuel.
 */
export function saveDuel(duel) {
  mkdirSync(DUELS_DIR, { recursive: true });
  const path = duelPath(duel.id);
  const tmp = `${path}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(tmp, JSON.stringify(duel, null, 1));
  renameSync(tmp, path);
}

/**
 * Command. Copies a duel truncated to its first `at` responses under a new id —
 * a branch point for "what if I had played differently here". The spread copies
 * everything the source froze — `format` and both decks' `extraCodes`/`sideCodes`
 * included — so a branch of a GOAT duel is itself a GOAT duel with the same extra
 * deck.
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
 * Both decks must share a `format` (sharedFormat throws otherwise); it becomes
 * the duel-level `format`. Each deck is frozen with its main/extra/side lists and
 * their passcodes (`codes`/`extraCodes`/`sideCodes`), plus category and manual, so
 * a record replays identically and a later deck viewer can show what was played.
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
  const format = sharedFormat(decks);
  const frozen = decks.map((d) => ({
    name: d.name,
    category: d.category,
    format: d.format,
    main: d.main,
    extra: d.extra,
    side: d.side,
    manual: d.manual,
    codes: expandDeck(d.main),
    extraCodes: expandExtra(d.extra),
    sideCodes: expandSide(d.side),
  }));
  const duel = { id, created, seed, format, decks: frozen, players, responses: [], times: [] };
  saveDuel(duel);
  return duel;
}

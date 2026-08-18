/**
 * The LLM trace: one record per model call, beside the duel it played.
 *
 * This is what a "view LLM process" button renders — the whole story of a move.
 * What was sent (system prefix and messages), what came back (answer, reasoning
 * summary, tokens, latency), what it was turned into (choice and its label), and
 * whether anything went wrong (retries, error).
 *
 * ==========================================================================
 * A TRACE IS ANNOTATION, NEVER STATE.
 * ==========================================================================
 * Like chat.js, this lives in its OWN file, never inside `duels/<id>.json`.
 * That record is the engine's replay truth — seed, decks, responses — and a
 * replay must be identical whether or not an LLM's prompts were ever kept.
 * Deleting every trace file changes nothing about any duel.
 *
 * Files: `duels/.traces/<duelId>.<seat>.json`, a JSON array, oldest first.
 * The hidden directory is deliberate and matches `duels/.presence/`:
 * `store.listDuels` treats every `*.json` directly under `duels/` as a duel, so
 * `duels/<id>.trace.0.json` would show up as a duel called "<id>.trace.0" and
 * then fail to load. A subdirectory is invisible to that scan.
 *
 * STORAGE DETAIL: the frozen system prefix is ~9k tokens of decklists and is
 * identical on every move of a duel, so `appendTrace` writes it as null when it
 * repeats the previous record's, and `loadTrace` fills it back in. Records handed
 * to callers always carry the full prefix; only the file is smaller (by ~50x on
 * a long duel, which matters because the browser volume holds everything in
 * memory).
 *
 * KEYS ARE NEVER HERE. `traceRecord` copies an explicit list of fields, so an
 * API key cannot ride into a trace on a spread of some caller's options object.
 */

import { existsSync, join, mkdirSync, randomId, readFileSync, renameSync, writeFileSync } from "../volume.js";
import { DUELS_DIR, DUEL_ID_PATTERN } from "../store.js";

/** Where traces live; hidden from `listDuels`, like `duels/.presence/`. */
const TRACES_DIR = join(DUELS_DIR, ".traces");

/**
 * Pure function. Path of one seat's trace file.
 *
 * Args:
 *     id (string): Duel id.
 *     seat (0|1): Seat.
 *     dir (string): Traces directory; tests pass a temp one.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> tracePath("duel1", 0).endsWith("duels/.traces/duel1.0.json")  // true
 *     >>> tracePath("duel1", 1, "/tmp/t")                               // "/tmp/t/duel1.1.json"
 */
export function tracePath(id, seat, dir = TRACES_DIR) {
  if (!DUEL_ID_PATTERN.test(id)) throw new Error(`invalid duel id: ${JSON.stringify(id)}`);
  if (![0, 1].includes(seat)) throw new Error(`invalid seat: ${JSON.stringify(seat)}`);
  return join(dir, `${id}.${seat}.json`);
}

/**
 * Pure function. Builds one trace record from named parts. Every field is copied
 * explicitly — this is the boundary that keeps credentials out of stored data.
 *
 * Args:
 *     parts.move (number): Index of the response this call produced (0-based),
 *         i.e. how many moves the duel had before it. This is the record's
 *         identity: it is the position in the replay a viewer clicks.
 *     parts.at (string): ISO timestamp of the call.
 *     parts.seat (0|1)
 *     parts.provider (string): Provider id.
 *     parts.model (string)
 *     parts.options (object): Provider-native options used.
 *     parts.system (string): The frozen prefix sent.
 *     parts.messages (Array<{role, content}>): The messages sent.
 *     parts.response (string|null): The model's raw answer; null if it never answered.
 *     parts.reasoning (string|null): Reasoning/thinking summary, or the model's own
 *         one-line reason when the provider returned no summary.
 *     parts.usage ({in, out, reasoning}): Token counts; nulls where unreported.
 *     parts.latencyMs (number|null)
 *     parts.choice (string): The menu choice actually played — "random" for the
 *         random-legal-move fallback, "" when nothing was played at all (a
 *         provider failure, which `error` explains).
 *     parts.chosenLabel (string): What that option was, in words.
 *     parts.retries (number): How many answers were rejected before this one.
 *     parts.error (string|null): Why a retry or the random fallback happened.
 *
 * Returns:
 *     object: The record, exactly the fields above.
 *
 * Examples:
 *     >>> traceRecord({move: 17, at: "2026-08-17T18:04:15.340Z", seat: 0, provider: "openai",
 *     ...   model: "gpt-5.6-terra", options: {effort: "low"}, system: "# Yu-Gi-Oh!…",
 *     ...   messages: [{role: "user", content: "## Your options…"}],
 *     ...   response: '{"choice":"1","reason":"…"}', reasoning: "…",
 *     ...   usage: {in: 5310, out: 412, reasoning: 260}, latencyMs: 4120,
 *     ...   choice: "1", chosenLabel: "Normal Summon Vorse Raider", retries: 0, error: null})
 *     {move: 17, at: "2026-08-17T18:04:15.340Z", seat: 0, provider: "openai", …}
 */
export function traceRecord({ move, at, seat, provider, model, options, system, messages, response, reasoning, usage, latencyMs, choice, chosenLabel, retries, error }) {
  return {
    move, at, seat, provider, model,
    options: { ...options },
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    response, reasoning,
    usage: { in: usage?.in ?? null, out: usage?.out ?? null, reasoning: usage?.reasoning ?? null },
    latencyMs,
    choice, chosenLabel,
    retries,
    error: error ?? null,
  };
}

/**
 * Query. One seat's trace records, oldest first, with each record's frozen
 * system prefix restored (see the module docstring).
 *
 * Args:
 *     id (string): Duel id.
 *     seat (0|1): Seat.
 *     dir (string): Traces directory.
 *
 * Returns:
 *     object[]: Empty when this seat has never been played by a model.
 *
 * Examples:
 *     >>> loadTrace("never-played", 0)          // []
 *     >>> loadTrace("duel1", 1).map((r) => r.choice)   // ["1", "3", "0"]
 *     >>> loadTrace("duel1", 1)[1].system === loadTrace("duel1", 1)[0].system   // true
 */
export function loadTrace(id, seat, dir = TRACES_DIR) {
  const path = tracePath(id, seat, dir);
  if (!existsSync(path)) return [];
  let system = null;
  return JSON.parse(readFileSync(path, "utf8")).map((record) => {
    system = record.system ?? system;
    return { ...record, system };
  });
}

/**
 * Command. Appends one record to a seat's trace file (read-modify-write plus an
 * atomic rename, like chat.js). The system prefix is stored only when it differs
 * from the previous record's.
 *
 * Concurrency matches chat.js: two writers in the same millisecond can lose one
 * record. Only the seat's own player loop writes here, one move at a time, and a
 * lost trace costs a debug view rather than a game, so no locking is worth its
 * weight.
 *
 * Args:
 *     id (string): Duel id.
 *     seat (0|1): Seat.
 *     record (object): From traceRecord.
 *     dir (string): Traces directory.
 *
 * Returns:
 *     object: The record as passed in (with its full system prefix).
 *
 * Examples:
 *     >>> appendTrace("duel1", 0, traceRecord({…})).move   // 17
 *     >>> loadTrace("duel1", 0).length                     // 1
 */
export function appendTrace(id, seat, record, dir = TRACES_DIR) {
  const path = tracePath(id, seat, dir);
  const stored = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
  const previousSystem = stored.map((r) => r.system).filter((s) => s !== null && s !== undefined).at(-1) ?? null;
  stored.push(record.system === previousSystem ? { ...record, system: null } : record);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${randomId().slice(0, 8)}.tmp`;
  writeFileSync(tmp, JSON.stringify(stored, null, 1));
  renameSync(tmp, path);
  return record;
}

/**
 * Pure function. A one-line summary of a trace record, for a list view or a log.
 *
 * Args:
 *     record (object): From traceRecord/loadTrace.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> summarizeTrace({move: 17, provider: "openai", model: "gpt-5.6-terra", latencyMs: 4120,
 *     ...   usage: {in: 5310, out: 412, reasoning: 260}, chosenLabel: "Normal Summon Vorse Raider",
 *     ...   retries: 0, error: null})
 *     "move 17: openai/gpt-5.6-terra -> Normal Summon Vorse Raider (4120ms, 5310 in / 412 out / 260 thinking)"
 *     >>> summarizeTrace({move: 3, provider: "openai", model: "gpt-5-nano", latencyMs: null,
 *     ...   usage: {in: null, out: null, reasoning: null}, chosenLabel: "End turn", retries: 2,
 *     ...   error: "the model chose \"9\", which is not an option"})
 *     'move 3: openai/gpt-5-nano -> End turn (?ms, ? in / ? out) [2 retries] ERROR: the model chose "9", which is not an option'
 */
export function summarizeTrace(record) {
  const n = (v) => (v === null || v === undefined ? "?" : v);
  const tokens = [`${n(record.usage?.in)} in`, `${n(record.usage?.out)} out`, ...(record.usage?.reasoning ? [`${record.usage.reasoning} thinking`] : [])];
  return [
    `move ${record.move}: ${record.provider}/${record.model} -> ${record.chosenLabel}`,
    `(${n(record.latencyMs)}ms, ${tokens.join(" / ")})`,
    ...(record.retries ? [`[${record.retries} ${record.retries === 1 ? "retry" : "retries"}]`] : []),
    ...(record.error ? [`ERROR: ${record.error}`] : []),
  ].join(" ");
}

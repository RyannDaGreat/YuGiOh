/**
 * Who sits at each seat of a duel: a human, or an AI (provider + model + options
 * + talk level).
 *
 * The assignment lives IN the duel record (`duel.seats`, next to the player
 * labels), so a fork, a rematch, an export and a re-import all carry it without
 * any code remembering to. Earlier builds kept it in a `duels/<id>.seats.json`
 * sidecar, and some games lost it that way — this module still reads that
 * sidecar for old records, and as a last resort recognises a seat whose player
 * label is exactly a known model id (nobody names themselves "gpt-5.6-terra")
 * so such a game gets its AI back instead of showing an offline seat forever.
 *
 * Shape: `{ "0": Seat, "1": Seat }` where
 *     Seat = {kind: "human"} | {kind: "ai", provider, model, options, talk?}
 */

import { DUELS_DIR, DUEL_ID_PATTERN, SEATS_SUFFIX, loadDuel, saveDuel } from "../store.js";
import { existsSync, join, readFileSync } from "../volume.js";
import { PROVIDER_CATALOG, defaultOptions } from "./provider.js";

/** Pure function. A human seat, the default. */
export const HUMAN = Object.freeze({ kind: "human" });

/**
 * Pure function. Path of a legacy seats sidecar (read-only compatibility).
 *
 * Examples:
 *     >>> seatsPath("g1").endsWith("duels/g1.seats.json")   // true
 */
export function seatsPath(id, dir = DUELS_DIR) {
  if (!DUEL_ID_PATTERN.test(id)) throw new Error(`invalid duel id: ${JSON.stringify(id)}`);
  return join(dir, `${id}${SEATS_SUFFIX}`);
}

/**
 * Pure function. The AI seat a player label implies, when the label is exactly a
 * model id from the provider catalog — the self-heal for a game whose seat
 * assignment was lost. Anything else is a human.
 *
 * Args:
 *     label (string): The seat's player label.
 *
 * Returns:
 *     Seat
 *
 * Examples:
 *     >>> seatFromLabel("gpt-5.6-terra")   // {kind: "ai", provider: "openai", model: "gpt-5.6-terra", options: {…}, talk: "sporting"}
 *     >>> seatFromLabel("ryan")            // {kind: "human"}
 */
export function seatFromLabel(label) {
  for (const cat of Object.values(PROVIDER_CATALOG)) {
    if (cat.models.some((m) => m.id === label)) {
      return { kind: "ai", provider: cat.id, model: label, options: { ...defaultOptions(cat) }, talk: "sporting" };
    }
  }
  return HUMAN;
}

/**
 * Query. Both seats' assignments: from the record; else the legacy sidecar; else
 * inferred from the player label; human where nothing says otherwise.
 *
 * Returns:
 *     {0: Seat, 1: Seat}
 *
 * Examples:
 *     >>> loadSeats("never-configured")   // {0: {kind: "human"}, 1: {kind: "human"}}
 */
export function loadSeats(id, dir = DUELS_DIR) {
  const duel = loadDuel(id);
  const legacyPath = seatsPath(id, dir);
  const legacy = existsSync(legacyPath) ? JSON.parse(readFileSync(legacyPath, "utf8")) : {};
  const seat = (i) => duel.seats?.[i] ?? legacy[i] ?? seatFromLabel(duel.players?.[i] ?? "");
  return { 0: seat(0), 1: seat(1) };
}

/**
 * Command. Records both seats' assignments in the duel record.
 *
 * Args:
 *     id (string): Duel id.
 *     seats ({0: Seat, 1: Seat}): Assignments; an AI seat needs `provider`.
 *
 * Examples:
 *     >>> saveSeats("g1", {0: {kind: "human"}, 1: {kind: "ai", provider: "openai", model: "gpt-5-nano", options: {}}})
 */
export function saveSeats(id, seats) {
  for (const i of [0, 1]) {
    const s = seats[i] ?? HUMAN;
    if (s.kind !== "human" && s.kind !== "ai") throw new Error(`seat ${i}: kind must be "human" or "ai"`);
    if (s.kind === "ai" && !s.provider) throw new Error(`seat ${i}: an AI seat needs a provider`);
  }
  const duel = loadDuel(id);
  saveDuel({ ...duel, seats: { 0: seats[0] ?? HUMAN, 1: seats[1] ?? HUMAN } });
}

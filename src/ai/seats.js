/**
 * Who sits at each seat of a duel: a human, or an AI (provider + model + options).
 *
 * Kept as a sidecar `duels/<id>.seats.json` beside the duel record — like chat,
 * deliberately NOT inside the record, which is the engine's replay truth and
 * holds decisions only. It goes through the volume, so on a static host it is
 * in the browser's own storage and it rides along in an export archive.
 *
 * Shape: `{ "0": Seat, "1": Seat }` where
 *     Seat = {kind: "human"} | {kind: "ai", provider, model, options}
 * A missing seat is human.
 */

import { DUELS_DIR, DUEL_ID_PATTERN, SEATS_SUFFIX } from "../store.js";
import { existsSync, join, mkdirSync, readFileSync, writeFileSync } from "../volume.js";

/** Pure function. A human seat, the default. */
export const HUMAN = Object.freeze({ kind: "human" });

/**
 * Pure function. Path of a duel's seats file.
 *
 * Examples:
 *     >>> seatsPath("g1").endsWith("duels/g1.seats.json")   // true
 */
export function seatsPath(id, dir = DUELS_DIR) {
  if (!DUEL_ID_PATTERN.test(id)) throw new Error(`invalid duel id: ${JSON.stringify(id)}`);
  return join(dir, `${id}${SEATS_SUFFIX}`);
}

/**
 * Query. Both seats' assignments; human where nothing was recorded.
 *
 * Returns:
 *     {0: Seat, 1: Seat}
 *
 * Examples:
 *     >>> loadSeats("never-configured")   // {0: {kind: "human"}, 1: {kind: "human"}}
 */
export function loadSeats(id, dir = DUELS_DIR) {
  const path = seatsPath(id, dir);
  const stored = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  return { 0: stored[0] ?? HUMAN, 1: stored[1] ?? HUMAN };
}

/**
 * Command. Records both seats' assignments.
 *
 * Args:
 *     id (string): Duel id.
 *     seats ({0: Seat, 1: Seat}): Assignments; an AI seat needs `provider`.
 *
 * Examples:
 *     >>> saveSeats("g1", {0: {kind: "human"}, 1: {kind: "ai", provider: "openai", model: "gpt-5-nano", options: {}}})
 */
export function saveSeats(id, seats, dir = DUELS_DIR) {
  for (const seat of [0, 1]) {
    const s = seats[seat] ?? HUMAN;
    if (s.kind !== "human" && s.kind !== "ai") throw new Error(`seat ${seat}: kind must be "human" or "ai"`);
    if (s.kind === "ai" && !s.provider) throw new Error(`seat ${seat}: an AI seat needs a provider`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(seatsPath(id, dir), JSON.stringify({ 0: seats[0] ?? HUMAN, 1: seats[1] ?? HUMAN }, null, 1));
}

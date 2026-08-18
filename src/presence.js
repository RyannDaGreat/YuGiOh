/**
 * Seat presence: who is currently sitting at a seat, and are they alive?
 *
 * Any client holding a seat (a browser tab polling, or `ygo wait` on the CLI)
 * writes a heartbeat file; a seat is "online" if its heartbeat is fresh. This
 * is harness plumbing shared by the CLI and the web UI — it says nothing about
 * the game and never touches the duel record.
 *
 * Files: duels/.presence/<duelId>.<seat>.json = {label, kind, at, pid}
 */

import { existsSync, join, mkdirSync, readFileSync, writeFileSync } from "./volume.js";
import { DUELS_DIR } from "./store.js";

const PRESENCE_DIR = join(DUELS_DIR, ".presence");
/**
 * A heartbeat older than this means the seat-holder is gone. Pollers beat every
 * 1–2 s while active, but a player (human or a Claude between turns) naturally
 * pauses — thinking, or in the gap between finishing one `ygo` command and
 * starting the next `wait`. A short window flips them to "offline" during those
 * normal pauses; 30 s keeps "online" meaning "someone is here and recently
 * acting" without lying when they truly leave.
 */
export const ONLINE_MS = 30000;

/**
 * Pure function. Path of a seat's heartbeat file.
 *
 * Examples:
 *     >>> presencePath("g1", 1).endsWith("duels/.presence/g1.1.json") // true
 */
export function presencePath(id, seat) {
  return join(PRESENCE_DIR, `${id}.${seat}.json`);
}

/**
 * Command. Records that `kind` (web|cli) is holding `seat` of duel `id` now.
 *
 * Args:
 *     id (string): Duel id.
 *     seat (0|1): Seat.
 *     kind (string): "web" or "cli".
 *     now (number): Timestamp (ms).
 */
export function heartbeat(id, seat, kind, now) {
  mkdirSync(PRESENCE_DIR, { recursive: true });
  writeFileSync(presencePath(id, seat), JSON.stringify({ kind, at: now, pid: process.pid }));
}

/**
 * Query. Presence of both seats.
 *
 * Args:
 *     id (string): Duel id.
 *     now (number): Timestamp (ms).
 *
 * Returns:
 *     Array<{seat: number, online: boolean, kind: string|null, ageMs: number|null}>
 */
export function presence(id, now) {
  return [0, 1].map((seat) => {
    const path = presencePath(id, seat);
    if (!existsSync(path)) return { seat, online: false, kind: null, ageMs: null };
    const beat = JSON.parse(readFileSync(path, "utf8"));
    const ageMs = now - beat.at;
    return { seat, online: ageMs < ONLINE_MS, kind: beat.kind, ageMs };
  });
}

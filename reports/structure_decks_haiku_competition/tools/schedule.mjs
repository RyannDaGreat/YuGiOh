#!/usr/bin/env node
// Builds schedule.json: every cell of the NxN grid, and the duels inside it.
//
// GRID SEMANTICS (this is the whole point of the two triangular halves):
//   cell (row, col) = the ROW deck goes FIRST (seat P0) against the COLUMN deck (P1).
// So an unordered pair {A,B} appears twice — once in the upper half with the
// earlier-released deck on the play, once in the lower half with the later one on
// the play — and the diagonal is a mirror match where seating is irrelevant.
//
// Each cell is a best-of-3: three duels, identical seating, different seeds.
// All three are always played (no early stop at 2-0), so every cell yields the
// same amount of evidence.
//
// Usage: node reports/structure_decks_haiku_competition/tools/schedule.mjs [--games 3]

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { roster } from "./roster.mjs";

const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Duels per cell. Best-of-3 -> 3. */
const DEFAULT_GAMES = 3;
/** Deterministic seed base, so the whole tournament can be regenerated identically. */
const SEED_BASE = 20260817;

/**
 * Pure function. The full schedule for a field of decks.
 *
 * @param {Array<{file: string, setCode: string, name: string}>} field - decks in matrix order
 * @param {number} games - duels per cell
 * @returns {{field: Array, games: number, cells: Array<{row: string, col: string, p0: string, p1: string, duels: Array<{id: string, game: number, seed: number}>}>}}
 *
 * @example
 * build([{file: "yugi", setCode: "SDY"}, {file: "kaiba", setCode: "SDK"}], 3).cells.length  // 4
 * build([{file: "yugi", setCode: "SDY"}, {file: "kaiba", setCode: "SDK"}], 3).cells[1].duels[0].id
 * // "sdc-SDY-vs-SDK-g1"   (row SDY is P0: it goes first)
 */
export function build(field, games = DEFAULT_GAMES) {
  const cells = [];
  for (const [r, row] of field.entries()) {
    for (const [c, col] of field.entries()) {
      const duels = [];
      for (let g = 1; g <= games; g += 1) {
        duels.push({
          id: `sdc-${row.setCode}-vs-${col.setCode}-g${g}`,
          game: g,
          // Seed varies with cell and game so no two duels of the tournament share a shuffle.
          seed: SEED_BASE + (r * field.length + c) * games + g,
        });
      }
      cells.push({ row: row.setCode, col: col.setCode, p0: row.file, p1: col.file, duels });
    }
  }
  return { field, games, cells };
}

const games = Number(process.argv.includes("--games") ? process.argv[process.argv.indexOf("--games") + 1] : DEFAULT_GAMES);
const schedule = build(roster(), games);
writeFileSync(join(REPORT_DIR, "schedule.json"), `${JSON.stringify(schedule, null, 2)}\n`);
const duelCount = schedule.cells.reduce((n, cell) => n + cell.duels.length, 0);
console.log(`${schedule.field.length} decks -> ${schedule.cells.length} cells x ${games} games = ${duelCount} duels (${duelCount * 2} haiku agents)`);
console.log(schedule.field.map((d) => `${d.setCode} ${d.name}`).join("\n"));

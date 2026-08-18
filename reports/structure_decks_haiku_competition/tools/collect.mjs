#!/usr/bin/env node
// Reads every scheduled duel record and writes the tournament's results:
//   results.jsonl  one line per duel (the raw evidence)
//   matrix.md      the NxN win matrix + standings, in Markdown
//   matrix.json    the same numbers, for the HTML report and any later analysis
//
// Nothing here decides anything: a duel's winner is whatever the rules engine
// says when the record is replayed. Unfinished duels are counted as unfinished
// and named, never guessed at.
//
// Usage: node reports/structure_decks_haiku_competition/tools/collect.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDuel } from "../../../src/store.js";
import { viewDuel } from "../../../src/session.js";
import { victoryString } from "../../../src/strings.js";

const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(REPORT_DIR, "..", "..");
const schedule = JSON.parse(readFileSync(join(REPORT_DIR, "schedule.json"), "utf8"));

/**
 * Query. Replays one duel record and reports its outcome as the engine sees it.
 *
 * @param {string} id - duel id
 * @returns {Promise<object|null>} null when the record does not exist yet
 */
async function outcome(id) {
  if (!existsSync(join(REPO_ROOT, "duels", `${id}.json`))) return null;
  const duel = loadDuel(id);
  const view = await viewDuel(duel, 2);
  return {
    id,
    p0: duel.decks[0].name,
    p1: duel.decks[1].name,
    moves: duel.responses.length,
    ended: view.ended,
    // winner 2 is the engine's "draw", not a third player.
    winner: view.ended ? (view.winner === 2 ? "draw" : `P${view.winner}`) : null,
    reason: view.ended ? victoryString(view.winReason) : null,
    lp: view.state.players.map((p) => p.lp),
  };
}

/**
 * Pure function. Reduces a cell's game outcomes to a best-of-3 line.
 *
 * @param {Array<{ended: boolean, winner: (string|null)}>} games
 * @returns {{rowWins: number, colWins: number, draws: number, played: number, complete: boolean, winner: ("row"|"col"|"tie"|null)}}
 *
 * @example
 * cellScore([{ended: true, winner: "P0"}, {ended: true, winner: "P1"}, {ended: true, winner: "P0"}])
 * // {rowWins: 2, colWins: 1, draws: 0, played: 3, complete: true, winner: "row"}
 * @example
 * cellScore([{ended: true, winner: "P0"}, {ended: false, winner: null}, {ended: false, winner: null}])
 * // {rowWins: 1, colWins: 0, draws: 0, played: 1, complete: false, winner: "row"}
 */
export function cellScore(games) {
  const rowWins = games.filter((g) => g.winner === "P0").length;
  const colWins = games.filter((g) => g.winner === "P1").length;
  const draws = games.filter((g) => g.winner === "draw").length;
  const played = rowWins + colWins + draws;
  const complete = games.length > 0 && games.every((g) => g.ended);
  const winner = played === 0 ? null : rowWins > colWins ? "row" : colWins > rowWins ? "col" : "tie";
  return { rowWins, colWins, draws, played, complete, winner };
}

const field = schedule.field;
const results = [];
const cells = [];

for (const cell of schedule.cells) {
  const games = [];
  for (const d of cell.duels) {
    const o = await outcome(d.id);
    if (o) {
      results.push({ ...o, row: cell.row, col: cell.col, game: d.game });
      games.push(o);
    } else {
      games.push({ id: d.id, ended: false, winner: null });
    }
  }
  cells.push({ row: cell.row, col: cell.col, ...cellScore(games) });
}

writeFileSync(join(REPORT_DIR, "results.jsonl"), `${results.map((r) => JSON.stringify(r)).join("\n")}\n`);

// ---- standings ----
// A deck's record is every duel it played, on either side of the grid: as the row
// deck (on the play) and as the column deck (on the draw). Kept apart as well as
// summed, because "who goes first" is exactly what the two triangles measure.
const byDeck = new Map(field.map((d) => [d.setCode, { setCode: d.setCode, name: d.name, firstW: 0, firstL: 0, secondW: 0, secondL: 0, draws: 0 }]));
for (const r of results) {
  if (!r.ended || r.row === r.col) continue; // mirrors tell you nothing about a deck's strength
  const rowRec = byDeck.get(r.row);
  const colRec = byDeck.get(r.col);
  if (r.winner === "draw") { rowRec.draws += 1; colRec.draws += 1; continue; }
  if (r.winner === "P0") { rowRec.firstW += 1; colRec.secondL += 1; } else { rowRec.firstL += 1; colRec.secondW += 1; }
}
const standings = [...byDeck.values()].map((d) => {
  const wins = d.firstW + d.secondW;
  const losses = d.firstL + d.secondL;
  const games = wins + losses + d.draws;
  return { ...d, wins, losses, games, winRate: games ? wins / games : 0 };
}).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

const totals = {
  duels: schedule.cells.reduce((n, c) => n + c.duels.length, 0),
  played: results.length,
  finished: results.filter((r) => r.ended).length,
  unfinished: results.filter((r) => !r.ended).map((r) => r.id),
  missing: schedule.cells.flatMap((c) => c.duels.map((d) => d.id)).filter((id) => !results.some((r) => r.id === id)),
  p0Wins: results.filter((r) => r.winner === "P0").length,
  p1Wins: results.filter((r) => r.winner === "P1").length,
  draws: results.filter((r) => r.winner === "draw").length,
};

writeFileSync(join(REPORT_DIR, "matrix.json"), `${JSON.stringify({ field, cells, standings, totals }, null, 2)}\n`);

// ---- matrix.md ----
const cellAt = (row, col) => cells.find((c) => c.row === row && c.col === col);
/** Pure function. A cell's "row wins-col wins" text, bolded when the row deck took the match. */
const cellText = (c) => {
  // matrix.md stays pure ASCII on purpose: it is the deliverable people paste into
  // terminals, editors and chat windows, and any of those may assume Latin-1 and
  // render a typographic dash as "â€“". index.html may use en dashes because it
  // declares UTF-8; this file cannot declare anything.
  if (!c || c.played === 0) return ".";
  const s = `${c.rowWins}-${c.colWins}${c.draws ? `+${c.draws}d` : ""}${c.complete ? "" : "*"}`;
  return c.winner === "row" ? `**${s}**` : s;
};

const md = [];
md.push("# Structure decks: Haiku vs Haiku, every deck against every deck", "");
md.push(`Generated ${new Date().toISOString()} from the duel records in \`duels/\`.`, "");
md.push(`**${totals.finished} of ${totals.duels} duels finished.** Row deck went FIRST (seat P0) in every duel; column deck went second.`);
md.push("Each cell is a best-of-3, written as **row wins-column wins**; bold means the row deck took the match. `*` = the cell is not finished yet.", "");
md.push(`| first (row) \\ second (col) | ${field.map((d) => d.setCode).join(" | ")} | cell record |`);
md.push(`| --- | ${field.map(() => "---").join(" | ")} | --- |`);
for (const row of field) {
  const rowCells = field.map((col) => cellText(cellAt(row.setCode, col.setCode)));
  const won = field.filter((col) => col.setCode !== row.setCode && cellAt(row.setCode, col.setCode)?.winner === "row").length;
  const lost = field.filter((col) => col.setCode !== row.setCode && cellAt(row.setCode, col.setCode)?.winner === "col").length;
  md.push(`| **${row.setCode}** ${row.name} | ${rowCells.join(" | ")} | ${won}-${lost} |`);
}
md.push("", "## Standings", "");
md.push("Mirror matches are excluded (a deck cannot beat itself). \"On the play\" = the deck was P0 and took turn 1.", "");
md.push("| # | deck | duels | W | L | D | win rate | on the play | on the draw |");
md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const [i, s] of standings.entries()) {
  md.push(`| ${i + 1} | **${s.setCode}** ${s.name} | ${s.games} | ${s.wins} | ${s.losses} | ${s.draws} | ${(s.winRate * 100).toFixed(1)}% | ${s.firstW}-${s.firstL} | ${s.secondW}-${s.secondL} |`);
}
// Head-to-head, strength-ordered: both seatings merged into six games per pairing,
// so "who went first" is out of the comparison. A transitive field reads as an
// upper triangle of row wins; the breaks in that pattern are the real findings.
const order = standings.map((s) => s.setCode);
const rankOf = new Map(order.map((c, i) => [c, i]));
const pairWins = (a, b) => cells.filter((c) => (c.row === a && c.col === b) || (c.row === b && c.col === a))
  .reduce((n, c) => n + (c.row === a ? c.rowWins : c.colWins), 0);
md.push("", "## Head-to-head, ordered by strength", "");
md.push("Both seatings merged: six games per pairing, so seating is out of the comparison. Cell = row wins-column wins.", "");
md.push(`| # | deck | ${order.join(" | ")} |`);
md.push(`| --- | --- | ${order.map(() => "---").join(" | ")} |`);
for (const [i, code] of order.entries()) {
  const row = order.map((col) => {
    if (col === code) return "-";
    const rw = pairWins(code, col);
    const cw = pairWins(col, code);
    // "!" marks an upset: this deck stands lower overall yet won the pairing.
    return `${rw}-${cw}${rankOf.get(code) > rankOf.get(col) && rw > cw ? " !" : ""}`;
  });
  md.push(`| ${i + 1} | **${code}** | ${row.join(" | ")} |`);
}
const upsetList = [];
for (const [i, a] of order.entries()) {
  for (const b of order.slice(i + 1)) {
    const aw = pairWins(a, b);
    const bw = pairWins(b, a);
    if (bw > aw) {
      const gap = rankOf.get(b) - rankOf.get(a);
      upsetList.push(`**${b} beat ${a} ${bw}-${aw}** (${b} stands ${gap} place${gap === 1 ? "" : "s"} lower)`);
    }
  }
}
md.push("", `\`!\` = upset. ${upsetList.length} of ${(order.length * (order.length - 1)) / 2} pairings went against the standings:`, "");
for (const u of upsetList) md.push(`- ${u}`);
md.push("", "## Going first", "");
md.push(`Across every finished duel: the player who went first won **${totals.p0Wins}**, the player who went second won **${totals.p1Wins}**, draws **${totals.draws}**.`, "");
if (totals.unfinished.length) md.push(`## Unfinished (${totals.unfinished.length})`, "", totals.unfinished.join(" "), "");
if (totals.missing.length) md.push(`## Not yet started (${totals.missing.length})`, "", `${totals.missing.slice(0, 40).join(" ")}${totals.missing.length > 40 ? " …" : ""}`, "");
writeFileSync(join(REPORT_DIR, "matrix.md"), `${md.join("\n")}\n`);

console.log(`${totals.finished}/${totals.duels} duels finished (${totals.played} records, ${totals.unfinished.length} unfinished, ${totals.missing.length} not started)`);
console.log(`going first: ${totals.p0Wins} wins vs going second: ${totals.p1Wins} wins, ${totals.draws} draws`);
console.log("");
for (const [i, s] of standings.slice(0, 11).entries()) {
  console.log(`${String(i + 1).padStart(2)}. ${s.setCode.padEnd(5)} ${s.name.padEnd(32)} ${String(s.wins).padStart(3)}W ${String(s.losses).padStart(3)}L  ${(s.winRate * 100).toFixed(1)}%`);
}

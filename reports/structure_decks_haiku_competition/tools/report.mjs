#!/usr/bin/env node
// Renders index.html from matrix.json + results.jsonl. Self-contained: no external
// requests, theme-aware, and every value in the page also readable as a table
// (the matrix and the standings are tables that happen to be colored).
//
// Encoding choices, deliberately:
//   - the matrix is DIVERGING (row deck ahead <-> column deck ahead) with a neutral
//     gray midpoint, because the quantity has a natural zero: a drawn cell;
//   - each arm is one hue mixed toward the surface in three equal steps, so it is
//     lightness-monotonic (a real ramp, not a rainbow);
//   - the standings bars are ONE hue, because they are one series;
//   - "on the play" vs "on the draw" are two series on one shared 0-100% axis,
//     with a legend and direct labels. Never two axes.
//
// Usage: node reports/structure_decks_haiku_competition/tools/report.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(readFileSync(join(REPORT_DIR, "matrix.json"), "utf8"));
const resultsPath = join(REPORT_DIR, "results.jsonl");
const results = existsSync(resultsPath)
  ? readFileSync(resultsPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
// Every duel whose game the ENGINE could not finish, and was therefore replayed from
// a fresh shuffle. Surfaced in the report on purpose: it is the one caveat a reader
// needs in order to judge the table, so it belongs beside the numbers.
const reseedPath = join(REPORT_DIR, "reseeds.jsonl");
const reseeds = existsSync(reseedPath)
  ? readFileSync(reseedPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];

const { field, cells, standings, totals } = matrix;

/** Pure function. HTML-escapes a string for text and attribute contexts. */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pure function. Percent with one decimal, or an em dash when there is nothing to divide. */
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

const cellAt = (row, col) => cells.find((c) => c.row === row && c.col === col);
const gamesOf = (row, col) => results.filter((r) => r.row === row && r.col === col).sort((a, b) => a.game - b.game);

/**
 * Pure function. The diverging step for a cell: negative = column deck ahead,
 * positive = row deck ahead, 0 = level. Clamped to the three steps per arm that
 * a best-of-three can produce.
 *
 * @param {{rowWins: number, colWins: number}} c
 * @returns {number} -3..3
 *
 * @example step({rowWins: 2, colWins: 1})  //  1
 * @example step({rowWins: 0, colWins: 3})  // -3
 */
function step(c) {
  return Math.max(-3, Math.min(3, c.rowWins - c.colWins));
}

/** Pure function. The CSS class carrying a cell's diverging fill. */
const stepClass = (s) => (s === 0 ? "s0" : `${s > 0 ? "r" : "c"}${Math.abs(s)}`);

// ---- orderings ----
// The grid is published twice. Release order is the neutral, non-question-begging
// layout. STRENGTH order is the analytical one: sorting both axes by win rate turns
// the same 121 cells into a dominance plot, where a transitive hierarchy shows up as
// blue above the diagonal and red below it — and every upset is a visible break in
// that pattern rather than a number you have to hunt for.
const strengthOrder = standings.map((s) => field.find((f) => f.setCode === s.setCode)).filter(Boolean);
const rankOf = new Map(strengthOrder.map((d, i) => [d.setCode, i]));

/**
 * Pure function. Head-to-head totals per unordered pair, merging BOTH seatings —
 * six games per pair, which removes "who went first" from the comparison entirely.
 *
 * @param {Array} allCells - matrix.json cells
 * @returns {Map<string, Record<string, number>>} "A|B" (sorted) -> {A: wins, B: wins}
 *
 * @example
 * pairTotals([{row: "SDY", col: "SD4", rowWins: 2, colWins: 1}, {row: "SD4", col: "SDY", rowWins: 1, colWins: 2}])
 * // Map { "SD4|SDY" => {SDY: 4, SD4: 2} }
 */
export function pairTotals(allCells) {
  const pairs = new Map();
  for (const c of allCells) {
    if (c.row === c.col) continue;
    const key = [c.row, c.col].sort().join("|");
    const p = pairs.get(key) ?? {};
    p[c.row] = (p[c.row] ?? 0) + c.rowWins;
    p[c.col] = (p[c.col] ?? 0) + c.colWins;
    pairs.set(key, p);
  }
  return pairs;
}

const pairs = pairTotals(cells);
const headToHead = (a, b) => pairs.get([a, b].sort().join("|")) ?? {};

/**
 * Pure function. Diverging step for a six-game head-to-head margin. A best-of-six
 * can only land on 3-3, 4-2, 5-1 or 6-0, so the arms have exactly three levels.
 *
 * @param {number} margin - wins(row) - wins(col), -6..6
 * @returns {string} CSS class
 *
 * @example stepClass6(0)   // "s0"   (3-3, dead even)
 * @example stepClass6(2)   // "r1"   (4-2 to the row deck)
 * @example stepClass6(-6)  // "c3"   (6-0 to the column deck)
 */
export function stepClass6(margin) {
  if (margin === 0) return "s0";
  const level = Math.abs(margin) >= 6 ? 3 : Math.abs(margin) >= 4 ? 2 : 1;
  return `${margin > 0 ? "r" : "c"}${level}`;
}

// The upsets: pairs where the deck standing LOWER won the six-game head-to-head.
const upsets = [];
const splits = [];
for (const key of pairs.keys()) {
  const [a, b] = key.split("|");
  const strong = rankOf.get(a) < rankOf.get(b) ? a : b;
  const weak = strong === a ? b : a;
  const h = headToHead(a, b);
  const sw = h[strong] ?? 0;
  const ww = h[weak] ?? 0;
  if (ww > sw) upsets.push({ weak, strong, ww, sw, gap: rankOf.get(weak) - rankOf.get(strong) });
  else if (ww === sw) splits.push({ a: strong, b: weak, score: sw });
}
upsets.sort((x, y) => y.gap - x.gap);

// ---- matrix table ----
const matrixRows = field.map((row) => {
  const tds = field.map((col) => {
    const c = cellAt(row.setCode, col.setCode);
    const mirror = row.setCode === col.setCode;
    if (!c || c.played === 0) return `<td class="cell empty" title="not played yet">·</td>`;
    const s = step(c);
    const games = gamesOf(row.setCode, col.setCode);
    const detail = [
      `${row.setCode} first vs ${col.setCode}`,
      ...games.map((g) => `g${g.game}: ${g.ended ? `${g.winner === "draw" ? "draw" : `${g.winner === "P0" ? row.setCode : col.setCode} wins`} — ${g.reason}, LP ${g.lp[0]}–${g.lp[1]}, ${g.moves} moves` : "unfinished"}`),
    ].join("\n");
    const label = `${c.rowWins}–${c.colWins}${c.draws ? `+${c.draws}d` : ""}`;
    return `<td class="cell ${mirror ? "mirror" : stepClass(s)}${c.complete ? "" : " partial"}" tabindex="0" data-detail="${esc(detail)}"><span class="score">${label}</span>${c.complete ? "" : '<span class="mark">*</span>'}</td>`;
  });
  const won = field.filter((col) => col.setCode !== row.setCode && cellAt(row.setCode, col.setCode)?.winner === "row").length;
  const lost = field.filter((col) => col.setCode !== row.setCode && cellAt(row.setCode, col.setCode)?.winner === "col").length;
  return `<tr><th scope="row" class="rowhead"><span class="set">${row.setCode}</span> <span class="deckname">${esc(row.name)}</span></th>${tds.join("")}<td class="record">${won}–${lost}</td></tr>`;
});

// ---- strength-ordered grid, and the six-game head-to-head grid ----

/** Pure function. One row of the strength-ordered 121-cell grid (same data, sorted axes). */
const strengthRow = (row) => {
  const tds = strengthOrder.map((col) => {
    const c = cellAt(row.setCode, col.setCode);
    if (!c || c.played === 0) return `<td class="cell empty">·</td>`;
    if (row.setCode === col.setCode) return `<td class="cell mirror" tabindex="0" data-detail="${esc(`${row.setCode} mirror match — both seats hold the same deck, so seating cannot matter`)}"><span class="score">${c.rowWins}–${c.colWins}</span></td>`;
    const games = gamesOf(row.setCode, col.setCode);
    const detail = [`${row.setCode} (rank ${rankOf.get(row.setCode) + 1}) first vs ${col.setCode} (rank ${rankOf.get(col.setCode) + 1})`,
      ...games.map((g) => `g${g.game}: ${g.ended ? `${g.winner === "draw" ? "draw" : `${g.winner === "P0" ? row.setCode : col.setCode} wins`} — LP ${g.lp[0]}–${g.lp[1]}, ${g.moves} moves` : "unfinished"}`)].join("\n");
    return `<td class="cell ${stepClass(step(c))}" tabindex="0" data-detail="${esc(detail)}"><span class="score">${c.rowWins}–${c.colWins}</span></td>`;
  });
  return `<tr><th scope="row" class="rowhead"><span class="rank">${rankOf.get(row.setCode) + 1}</span> <span class="set">${row.setCode}</span> <span class="deckname">${esc(row.name)}</span></th>${tds.join("")}</tr>`;
};

/** Pure function. One row of the head-to-head grid: six games per pair, both seatings merged. */
const h2hRow = (row) => {
  const tds = strengthOrder.map((col) => {
    if (row.setCode === col.setCode) return `<td class="cell mirror">—</td>`;
    const h = headToHead(row.setCode, col.setCode);
    const rw = h[row.setCode] ?? 0;
    const cw = h[col.setCode] ?? 0;
    const upset = rankOf.get(row.setCode) > rankOf.get(col.setCode) && rw > cw;
    const detail = `${row.setCode} ${rw}–${cw} ${col.setCode} over all six games (both seatings)${upset ? `\nUPSET: ${row.setCode} stands ${rankOf.get(row.setCode) - rankOf.get(col.setCode)} places lower` : ""}`;
    return `<td class="cell ${stepClass6(rw - cw)}${upset ? " upset" : ""}" tabindex="0" data-detail="${esc(detail)}"><span class="score">${rw}–${cw}</span></td>`;
  });
  return `<tr><th scope="row" class="rowhead"><span class="rank">${rankOf.get(row.setCode) + 1}</span> <span class="set">${row.setCode}</span> <span class="deckname">${esc(row.name)}</span></th>${tds.join("")}</tr>`;
};

// ---- standings bars ----
const best = standings[0];
const maxRate = Math.max(...standings.map((s) => s.winRate), 0.0001);
const standingsBars = standings.map((s) => `
  <div class="barrow">
    <div class="barlabel"><span class="set">${s.setCode}</span> <span class="deckname">${esc(s.name)}</span></div>
    <div class="bartrack"><div class="bar" style="width: ${((s.winRate / maxRate) * 100).toFixed(1)}%"></div></div>
    <div class="barvalue">${(s.winRate * 100).toFixed(1)}%</div>
    <div class="barsub">${s.wins}W ${s.losses}L${s.draws ? ` ${s.draws}D` : ""}</div>
  </div>`).join("");

const seatBars = standings.map((s) => {
  const first = s.firstW + s.firstL;
  const second = s.secondW + s.secondL;
  const fr = first ? s.firstW / first : 0;
  const sr = second ? s.secondW / second : 0;
  return `
  <div class="barrow seat">
    <div class="barlabel"><span class="set">${s.setCode}</span></div>
    <div class="bartrack stack">
      <div class="bar play" style="width: ${(fr * 100).toFixed(1)}%"><span class="inbar">${(fr * 100).toFixed(0)}%</span></div>
      <div class="bar draw" style="width: ${(sr * 100).toFixed(1)}%"><span class="inbar">${(sr * 100).toFixed(0)}%</span></div>
    </div>
  </div>`;
}).join("");

// ---- results table ----
const resultRows = results.map((r) => `<tr>
  <td class="mono">${esc(r.id)}</td><td>${r.row}</td><td>${r.col}</td>
  <td>${r.ended ? (r.winner === "draw" ? "draw" : r.winner === "P0" ? `${r.row} (first)` : `${r.col} (second)`) : "<em>unfinished</em>"}</td>
  <td>${r.ended ? esc(r.reason) : ""}</td>
  <td class="num">${r.lp[0]}</td><td class="num">${r.lp[1]}</td><td class="num">${r.moves}</td>
</tr>`).join("");

// The charset declaration is NOT optional here. This file is opened as a local
// file:// document, where there is no HTTP Content-Type to fall back on, so a
// browser guesses the locale encoding and every en dash renders as "â€“". Declaring
// it is the difference between a readable table and mojibake.
const html = `<meta charset="utf-8">
<title>Structure Deck Gauntlet</title>
<style>
  :root {
    color-scheme: light;
    --surface-0: #f7f7f5;
    --surface-1: #fcfcfb;
    --surface-2: #f0efec;
    --hairline: #e2e1dc;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #85837c;
    --text-on-fill: #ffffff;
    --series-1: #2a78d6;
    --series-2: #eb6834;
    --diverge-row: #2a78d6;
    --diverge-col: #d03b3b;
    --diverge-mid: #f0efec;
    --mirror-fill: #eceae5;

    --step-1: 26%;
    --step-2: 56%;
    --step-3: 86%;

    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 28px;
    --space-xl: 48px;
    --radius-mark: 4px;
    --radius-card: 10px;
    --bar-height: 14px;
    --bar-gap: 2px;
    --cell-min: 52px;
    --page-max: 1180px;
    --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --hero-size: 40px;
    --tooltip-max: 340px;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-0: #131312;
      --surface-1: #1a1a19;
      --surface-2: #232322;
      --hairline: #333330;
      --text-primary: #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted: #8f8e85;
      --text-on-fill: #ffffff;
      --series-1: #3987e5;
      --series-2: #d95926;
      --diverge-row: #3987e5;
      --diverge-col: #e66767;
      --diverge-mid: #383835;
      --mirror-fill: #2a2a28;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-0: #131312;
    --surface-1: #1a1a19;
    --surface-2: #232322;
    --hairline: #333330;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #8f8e85;
    --text-on-fill: #ffffff;
    --series-1: #3987e5;
    --series-2: #d95926;
    --diverge-row: #3987e5;
    --diverge-col: #e66767;
    --diverge-mid: #383835;
    --mirror-fill: #2a2a28;
  }

  body { margin: 0; background: var(--surface-0); color: var(--text-primary); font-family: var(--font-sans); line-height: 1.5; }
  main { max-width: var(--page-max); margin: 0 auto; padding: var(--space-xl) var(--space-md); }
  h1 { font-size: 28px; margin: 0 0 var(--space-sm); letter-spacing: -0.01em; }
  h2 { font-size: 18px; margin: var(--space-xl) 0 var(--space-sm); }
  h3 { font-size: 14px; margin: var(--space-lg) 0 var(--space-sm); color: var(--text-secondary); font-weight: 600; }
  p, li { color: var(--text-secondary); max-width: 76ch; }
  a { color: var(--series-1); }
  .lede { font-size: 15px; }
  .card { background: var(--surface-1); border: 1px solid var(--hairline); border-radius: var(--radius-card); padding: var(--space-md); }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-sm); margin: var(--space-lg) 0; }
  .tile { background: var(--surface-1); border: 1px solid var(--hairline); border-radius: var(--radius-card); padding: var(--space-md); }
  .tile .k { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .tile .v { font-size: var(--hero-size); font-weight: 650; line-height: 1.1; margin-top: var(--space-xs); }
  .tile .s { font-size: 13px; color: var(--text-secondary); }

  .scroll { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: var(--bar-gap); font-size: 13px; }
  .matrix th { font-weight: 600; color: var(--text-secondary); font-size: 12px; }
  .matrix thead th { padding: 0 var(--space-xs) var(--space-xs); text-align: center; }
  .matrix thead th.corner { text-align: left; white-space: nowrap; color: var(--text-muted); font-weight: 500; }
  .rowhead { text-align: left; padding-right: var(--space-sm); white-space: nowrap; }
  .set { font-family: var(--font-mono); font-weight: 700; }
  .deckname { color: var(--text-muted); font-weight: 400; }
  .cell { min-width: var(--cell-min); text-align: center; border-radius: var(--radius-mark); padding: var(--space-sm) var(--space-xs); background: var(--diverge-mid); color: var(--text-primary); font-variant-numeric: tabular-nums; cursor: default; }
  .cell:focus-visible { outline: 2px solid var(--series-1); outline-offset: 1px; }
  .cell.empty { background: var(--surface-2); color: var(--text-muted); }
  .cell.mirror { background: var(--mirror-fill); color: var(--text-muted); }
  .cell .mark { color: var(--text-muted); }
  .cell.r1 { background: color-mix(in oklab, var(--diverge-row) var(--step-1), var(--surface-1)); }
  .cell.r2 { background: color-mix(in oklab, var(--diverge-row) var(--step-2), var(--surface-1)); }
  .cell.r3 { background: color-mix(in oklab, var(--diverge-row) var(--step-3), var(--surface-1)); color: var(--text-on-fill); }
  .cell.c1 { background: color-mix(in oklab, var(--diverge-col) var(--step-1), var(--surface-1)); }
  .cell.c2 { background: color-mix(in oklab, var(--diverge-col) var(--step-2), var(--surface-1)); }
  .cell.c3 { background: color-mix(in oklab, var(--diverge-col) var(--step-3), var(--surface-1)); color: var(--text-on-fill); }
  .record { text-align: center; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .rank { display: inline-block; min-width: var(--space-md); color: var(--text-muted); font-variant-numeric: tabular-nums; }
  /* An upset is called out by an outline, never by hue alone — the hue is already
     spoken for by the margin, and outline survives colour-blindness and print. */
  .cell.upset { outline: 2px solid var(--text-primary); outline-offset: -2px; }
  .upsetkey { outline: 2px solid var(--text-primary); outline-offset: 1px; padding: 0 var(--space-xs); }

  .legend { display: flex; flex-wrap: wrap; gap: var(--space-md); align-items: center; margin: var(--space-sm) 0 var(--space-md); font-size: 12px; color: var(--text-secondary); }
  .ramp { display: flex; gap: var(--bar-gap); align-items: center; }
  .swatch { width: 26px; height: var(--bar-height); border-radius: var(--radius-mark); }
  .key { display: inline-flex; align-items: center; gap: var(--space-xs); }
  .keydot { width: 10px; height: 10px; border-radius: 50%; }

  .barrow { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(120px, 3fr) 56px 84px; gap: var(--space-sm); align-items: center; padding: var(--space-xs) 0; font-size: 13px; }
  .barrow.seat { grid-template-columns: 64px 1fr; }
  .barlabel { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bartrack { background: var(--surface-2); border-radius: var(--radius-mark); }
  .bartrack.stack { display: grid; gap: var(--bar-gap); background: none; }
  .bar { height: var(--bar-height); border-radius: 0 var(--radius-mark) var(--radius-mark) 0; background: var(--series-1); min-width: var(--radius-mark); }
  .bar.play { background: var(--series-1); }
  .bar.draw { background: var(--series-2); }
  .inbar { display: none; }
  .barvalue { text-align: right; font-variant-numeric: tabular-nums; }
  .barsub { color: var(--text-muted); font-variant-numeric: tabular-nums; }

  details { margin-top: var(--space-md); }
  summary { cursor: pointer; color: var(--text-secondary); font-size: 13px; }
  .data { width: 100%; border-spacing: 0; margin-top: var(--space-sm); }
  .data th, .data td { border-bottom: 1px solid var(--hairline); padding: var(--space-xs) var(--space-sm); text-align: left; }
  .data th { color: var(--text-muted); font-weight: 600; font-size: 12px; }
  .data td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: var(--font-mono); font-size: 12px; }

  #tip { position: fixed; z-index: 10; max-width: var(--tooltip-max); background: var(--surface-1); color: var(--text-primary); border: 1px solid var(--hairline); border-radius: var(--radius-mark); padding: var(--space-sm); font-size: 12px; white-space: pre-line; box-shadow: 0 2px 10px rgb(0 0 0 / 0.18); pointer-events: none; display: none; }
  footer { margin-top: var(--space-xl); color: var(--text-muted); font-size: 12px; }
</style>

<main>
<h1>Structure Deck Gauntlet</h1>
<p class="lede">Every official Konami product in this repo plays every other one — and itself — in a best-of-three.
Both seats of every duel are played by a <strong>Claude Haiku</strong> agent through this repo's CLI, under the real
rules. Same model on both sides, no strategy briefs, no human input: the only difference between two seats is the
decklist, which is what makes this table a statement about <em>decks</em>.</p>

<div class="tiles">
  <div class="tile"><div class="k">duels finished</div><div class="v">${totals.finished}</div><div class="s">of ${totals.duels} scheduled · ${field.length}×${field.length} grid, best-of-3</div></div>
  <div class="tile"><div class="k">strongest deck</div><div class="v">${best ? esc(best.setCode) : "—"}</div><div class="s">${best ? `${esc(best.name)} · ${(best.winRate * 100).toFixed(1)}% of ${best.games} duels` : "no results yet"}</div></div>
  <div class="tile"><div class="k">going first won</div><div class="v">${pct(totals.p0Wins, totals.p0Wins + totals.p1Wins + totals.draws)}</div><div class="s">${totals.p0Wins} first · ${totals.p1Wins} second · ${totals.draws} draws</div></div>
  <div class="tile"><div class="k">haiku agents</div><div class="v">${totals.duels * 2}</div><div class="s">two per duel, one per seat — never a costlier model</div></div>
</div>

<h2>The win matrix</h2>
<p><strong>The row deck goes first</strong> (seat P0, takes turn 1); the column deck goes second. That is what makes the two
triangular halves meaningful: a pairing appears once in each half, so every matchup is measured from both seatings. The
diagonal is a mirror match, where seating cannot matter. Each cell reads <strong>row wins–column wins</strong>.</p>

<div class="legend">
  <span class="ramp">
    <span>column deck ahead (went second)</span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-col) var(--step-3), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-col) var(--step-2), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-col) var(--step-1), var(--surface-1))"></span>
    <span class="swatch" style="background: var(--diverge-mid)"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-row) var(--step-1), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-row) var(--step-2), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-row) var(--step-3), var(--surface-1))"></span>
    <span>row deck ahead (went first)</span>
  </span>
  <span class="key"><span class="keydot" style="background: var(--mirror-fill)"></span> mirror match</span>
  <span class="key"><span class="keydot" style="background: var(--surface-2)"></span> not played</span>
  <span><code>*</code> cell not finished</span>
</div>

<div class="scroll">
<table class="matrix">
  <thead><tr><th class="corner">first ↓ &nbsp;\\&nbsp; second →</th>${field.map((d) => `<th scope="col">${d.setCode}</th>`).join("")}<th scope="col">cells</th></tr></thead>
  <tbody>${matrixRows.join("")}</tbody>
</table>
</div>

<h2>The same grid, ordered by strength</h2>
<p>Identical data, both axes sorted strongest to weakest. If the field were a clean pecking order this
would be <strong>blue above the diagonal and red below it</strong> — stronger decks beating weaker ones
whichever seat they took. It mostly is, and the exceptions are the interesting part.</p>
<div class="scroll">
<table class="matrix">
  <thead><tr><th class="corner">first ↓ &nbsp;\\&nbsp; second →</th>${strengthOrder.map((d) => `<th scope="col">${d.setCode}</th>`).join("")}</tr></thead>
  <tbody>${strengthOrder.map(strengthRow).join("")}</tbody>
</table>
</div>

<h2>Head-to-head: six games per pairing</h2>
<p>Both seatings merged, so <strong>who went first is gone from this table entirely</strong> — each cell is
one pairing's whole six-game record. This is the cleanest read on "who beats whom": ${upsets.length ? `the
${upsets.length} <span class="upsetkey">outlined</span> cells are <strong>upsets</strong>, where the
lower-standing deck won the pairing.` : "no upsets occurred."}</p>
<div class="legend">
  <span class="ramp">
    <span>column deck ahead</span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-col) var(--step-3), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-col) var(--step-2), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-col) var(--step-1), var(--surface-1))"></span>
    <span class="swatch" style="background: var(--diverge-mid)"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-row) var(--step-1), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-row) var(--step-2), var(--surface-1))"></span>
    <span class="swatch" style="background: color-mix(in oklab, var(--diverge-row) var(--step-3), var(--surface-1))"></span>
    <span>row deck ahead</span>
  </span>
  <span>4–2 · 5–1 · 6–0 · gray = 3–3</span>
</div>
<div class="scroll">
<table class="matrix">
  <thead><tr><th class="corner">rank ↓ deck</th>${strengthOrder.map((d) => `<th scope="col">${d.setCode}</th>`).join("")}</tr></thead>
  <tbody>${strengthOrder.map(h2hRow).join("")}</tbody>
</table>
</div>

<h3>How well does the pecking order hold?</h3>
<div class="tiles">
  <div class="tile"><div class="k">hierarchy held</div><div class="v">${pairs.size - upsets.length - splits.length}</div><div class="s">of ${pairs.size} pairings the higher-standing deck won</div></div>
  <div class="tile"><div class="k">dead even</div><div class="v">${splits.length}</div><div class="s">pairings split 3–3 across six games</div></div>
  <div class="tile"><div class="k">upsets</div><div class="v">${upsets.length}</div><div class="s">pairings the lower-standing deck won</div></div>
</div>
${upsets.length ? `<ul>${upsets.map((u) => `<li><strong>${u.weak} beat ${u.strong} ${u.ww}–${u.sw}</strong> — ${u.weak} stands ${u.gap} place${u.gap === 1 ? "" : "s"} lower overall, yet won the pairing. A rank is an average; a matchup is not.</li>`).join("")}</ul>` : ""}
${splits.length ? `<p class="lede">Split 3–3: ${splits.map((s) => `${s.a}/${s.b}`).join(" · ")}. With six games a 3–3 means the pairing is genuinely close, not that the evidence ran out.</p>` : ""}

<h2>Standings</h2>
<p>Every duel a deck played, on either side of the grid. Mirror matches are excluded — a deck cannot beat itself.</p>
<div class="card">${standingsBars}</div>

<h3>Win rate on the play vs on the draw</h3>
<div class="legend">
  <span class="key"><span class="keydot" style="background: var(--series-1)"></span> on the play (went first)</span>
  <span class="key"><span class="keydot" style="background: var(--series-2)"></span> on the draw (went second)</span>
  <span>same 0–100% scale for both</span>
</div>
<div class="card">${seatBars}</div>

<details>
  <summary>Standings as a table</summary>
  <table class="data">
    <thead><tr><th>#</th><th>deck</th><th>duels</th><th>W</th><th>L</th><th>D</th><th>win rate</th><th>on the play</th><th>on the draw</th></tr></thead>
    <tbody>${standings.map((s, i) => `<tr><td class="num">${i + 1}</td><td><span class="set">${s.setCode}</span> ${esc(s.name)}</td><td class="num">${s.games}</td><td class="num">${s.wins}</td><td class="num">${s.losses}</td><td class="num">${s.draws}</td><td class="num">${(s.winRate * 100).toFixed(1)}%</td><td class="num">${s.firstW}–${s.firstL}</td><td class="num">${s.secondW}–${s.secondL}</td></tr>`).join("")}</tbody>
  </table>
</details>

<details>
  <summary>Every duel (${results.length} records)</summary>
  <table class="data">
    <thead><tr><th>duel</th><th>first</th><th>second</th><th>winner</th><th>ended by</th><th class="num">LP first</th><th class="num">LP second</th><th class="num">moves</th></tr></thead>
    <tbody>${resultRows}</tbody>
  </table>
</details>

${reseeds.length ? `<h2>Replayed duels (${new Set(reseeds.map((r) => r.id)).size} of ${totals.duels})</h2>
<p>Two defects in the rules engine can leave a board in a position <strong>no player can answer</strong>:
a <code>chain.lua</code> CHAININFO error where the pinned card scripts and the pinned core disagree (every case
involved SD10 / Ancient Gear Cannon), and a <code>MSG_SELECT_SUM</code> dead end where the core offers zero
selectable cards yet still demands more sum, and rejects the empty answer (every case involved SDP's Toon
tribute lines). Neither is fixable without changing the core/scripts pair, which would change how every
already-finished duel replays.</p>
<p>Those duels were therefore <strong>replayed from a fresh shuffle</strong>: the unplayable game was discarded
and two Haiku agents played the cell again from move 0 with a new seed, under identical conditions. This never
decides a duel — no winner is picked, no life points compared, no move played by the operator — and a duel the
engine calls <em>finished</em> is refused outright, so a result can never be re-rolled, only an unplayable
position. ${reseeds.length} resets across ${new Set(reseeds.map((r) => r.id)).size} duels; some needed a second
shuffle because the same defect recurred.</p>
<details>
  <summary>The reseed ledger</summary>
  <table class="data">
    <thead><tr><th>duel</th><th class="num">attempt</th><th class="num">moves discarded</th><th class="num">old seed</th><th class="num">new seed</th><th>reason</th></tr></thead>
    <tbody>${reseeds.map((r) => `<tr><td class="mono">${esc(r.id)}</td><td class="num">${r.attempt}</td><td class="num">${r.discardedMoves}</td><td class="num">${r.oldSeed}</td><td class="num">${r.newSeed}</td><td>${esc(r.reason)}</td></tr>`).join("")}</tbody>
  </table>
</details>
` : ""}
<h2>How this was run</h2>
<ul>
  <li><strong>Field:</strong> the ${field.length} decks marked <code>category: "structure"</code> — official Starter and Structure Decks, fixed printed lists. Curated and user decks are excluded.</li>
  <li><strong>Players:</strong> one headless Haiku agent per seat, prompted with <code>ygo brief</code> (that is <code>PLAYER.md</code> plus the seat facts) and nothing else. No strategy brief on either side.</li>
  <li><strong>Hidden information is enforced, not trusted:</strong> a <code>PreToolUse</code> hook restricts each seat's shell to <code>ygo</code> calls for its own seat — no spectator view, no other seat, nothing under <code>duels/</code> (the record holds the seed, hence the opponent's hand), no <code>undo</code>/<code>fork</code>, no random play.</li>
  <li><strong>No shortcuts:</strong> a duel counts only when the rules engine declares it over. Nothing is decided by life points, by random play, or by assumption. If a pair of agents leaves a duel unfinished, a fresh single-decision Haiku agent is sent in to answer the pending menu, then a fresh pair resumes — repeatedly, until the engine ends the duel.</li>
  <li><strong>Reproducible:</strong> fixed per-duel seeds; every result above is re-derived by replaying <code>duels/*.json</code>.</li>
</ul>

<h2>What this measures</h2>
<p>How these ${field.length} printed decklists perform against each other <em>when piloted by equally weak, equally uninformed
players</em>. That is a real question, and its answer is not the human-tournament answer: a deck whose strength depends on
subtle sequencing underperforms here, and a deck that wins by having bigger numbers overperforms. Three games per cell
ranks decks; it does not make any single cell trustworthy. The going-first split in the tiles above is the honest scale
for reading the rest.</p>

<footer>Generated ${new Date().toISOString()} · <code>reports/structure_decks_haiku_competition/</code> · matrix and standings also in <code>matrix.md</code>, raw rows in <code>results.jsonl</code></footer>
</main>

<div id="tip" role="tooltip"></div>
<script>
  // Per-cell hover/focus detail. The tooltip enhances; every number it shows is
  // already in the cell, the matrix table, or the "Every duel" table below.
  const tip = document.getElementById("tip");
  const GAP = 12;
  function show(el) {
    tip.textContent = el.dataset.detail || "";
    tip.style.display = "block";
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    tip.style.left = Math.max(GAP, Math.min(window.innerWidth - t.width - GAP, r.left + r.width / 2 - t.width / 2)) + "px";
    tip.style.top = (r.top > t.height + GAP ? r.top - t.height - GAP : r.bottom + GAP) + "px";
  }
  const hide = () => { tip.style.display = "none"; };
  for (const el of document.querySelectorAll(".cell[data-detail]")) {
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("focus", () => show(el));
    el.addEventListener("mouseleave", hide);
    el.addEventListener("blur", hide);
  }
  window.addEventListener("scroll", hide, { passive: true });
</script>
`;

writeFileSync(join(REPORT_DIR, "index.html"), html);
console.log(`wrote index.html (${(html.length / 1024).toFixed(1)} KB) — ${totals.finished}/${totals.duels} duels`);

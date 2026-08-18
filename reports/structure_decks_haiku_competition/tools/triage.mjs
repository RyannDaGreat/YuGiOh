#!/usr/bin/env node
// Diagnoses why each unfinished tournament duel is unfinished, WITHOUT touching it.
//
// For every unfinished duel it forks the record at its current position into a
// throwaway `triage-*` id and tries to answer the pending menu there. The fork is
// deleted afterwards. The tournament record is never played, never edited: a
// decision inside a real duel belongs to a Haiku agent, not to the operator.
//
// Classification:
//   answerable  — the fork accepted a legal answer, so the board is fine and the
//                 duel simply lost its agents (relaunching will finish it)
//   script      — answering raises a Lua error from the card scripts / core: the
//                 position is UNPLAYABLE by anyone, an engine bug, not a stall
//   malformed   — the menu itself decodes to nonsense (impossible counts, absurd
//                 player/zone numbers), so there is no legal answer to give
//   other       — anything else, printed verbatim for a human to read
//
// Usage: node reports/structure_decks_haiku_competition/tools/triage.mjs

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDuel } from "../../../src/store.js";
import { viewDuel } from "../../../src/session.js";

const execFile = promisify(execFileCb);
const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(REPORT_DIR, "..", "..");
const schedule = JSON.parse(readFileSync(join(REPORT_DIR, "schedule.json"), "utf8"));

/** Absurd player index in a rendered menu line — a decode gone wrong, since seats are 0/1/2. */
const MAX_SANE_PLAYER = 2;

/**
 * Query. Runs an `ygo` command, returning stdout and stderr without throwing.
 *
 * @param {string[]} args - argv after `bin/ygo.js`
 * @returns {Promise<{ok: boolean, out: string}>}
 */
async function ygo(args) {
  try {
    const { stdout } = await execFile("node", ["bin/ygo.js", ...args], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return { ok: true, out: stdout };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}` };
  }
}

/**
 * Pure function. Whether a rendered menu is self-evidently corrupt.
 *
 * @param {string} text - the menu's title/lines
 * @returns {boolean}
 *
 * @example isMalformed('Select the card(s) to Tribute (total exactly 1; ... choose exactly 0 more)')  // true
 * @example isMalformed('Select the zone to place "Black Dragon\'s Chick" (choose 1)')                  // false
 */
export function isMalformed(text) {
  if (/total exactly \d+;.*choose exactly 0 more/.test(text)) return true;
  const players = [...text.matchAll(/\(P(\d+)\s/g)].map((m) => Number(m[1]));
  return players.some((p) => p > MAX_SANE_PLAYER);
}

const ids = schedule.cells.flatMap((c) => c.duels.map((d) => d.id));
const report = { answerable: [], script: [], malformed: [], other: [] };

for (const id of ids) {
  if (!existsSync(join(REPO_ROOT, "duels", `${id}.json`))) continue;
  const duel = loadDuel(id);
  const view = await viewDuel(duel, 2);
  if (view.ended) continue;

  const menuText = view.menuLines.join("\n");
  if (isMalformed(menuText)) {
    report.malformed.push({ id, moves: duel.responses.length, menu: menuText.split("\n")[0].slice(0, 150) });
    continue;
  }

  const forkId = `triage-${id}`;
  await ygo(["fork", id, "--at", String(duel.responses.length), "--id", forkId]);
  // The pending seat is the only one that can answer; option 1 always exists on a
  // well-formed menu (and "0" is only ever an extra).
  const played = await ygo(["play", forkId, "1", "--as", String(view.pendingPlayer), "--quiet"]);
  rmSync(join(REPO_ROOT, "duels", `${forkId}.json`), { force: true });
  rmSync(join(REPO_ROOT, "duels", `${forkId}.chat.json`), { force: true });

  if (played.ok) {
    report.answerable.push({ id, moves: duel.responses.length });
  } else if (/script error|\.lua/.test(played.out)) {
    const line = played.out.split("\n").find((l) => /\.lua/.test(l)) ?? "";
    report.script.push({ id, moves: duel.responses.length, lua: line.trim().slice(0, 120) });
  } else {
    report.other.push({ id, moves: duel.responses.length, err: played.out.split("\n").slice(0, 2).join(" | ").slice(0, 200) });
  }
}

for (const [kind, rows] of Object.entries(report)) {
  console.log(`\n## ${kind} (${rows.length})`);
  for (const r of rows) console.log(`  ${r.id} @${r.moves}mv ${r.lua ?? r.menu ?? r.err ?? ""}`);
}

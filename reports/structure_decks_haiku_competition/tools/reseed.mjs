#!/usr/bin/env node
// Resets duels that the ENGINE cannot finish, so they can be played again from a
// fresh shuffle. This is the only operation in the tournament that discards played
// moves, and it exists for exactly one reason: two engine-level defects can put a
// board in a position that NO player — human or agent — is able to answer.
//
//   1. `chain.lua:85` Lua error: the pinned CardScripts and the pinned core disagree
//      about a CHAININFO flag, so answering the pending menu raises a script error.
//      Every instance so far involves SD10 (Ancient Gear Cannon, passcode 80045583).
//   2. `MSG_SELECT_SUM` mis-decode: `selects_must` comes back with impossible players
//      and zones (P69, P254, loc120) and min/max of 0 against a required total of 1 —
//      "choose exactly 0 more", a menu with no legal answer. Every instance so far
//      involves SDP (Toon tribute lines).
//
// WHAT THIS IS NOT: it never decides a duel. It does not pick a winner, compare life
// points, or play a move. It throws away an unplayable game and lets two Haiku agents
// play the cell again from move 0 with a different shuffle, under identical conditions.
// Every reset is appended to `reseeds.jsonl` — how far the dead game got, its old seed,
// its new seed, and why — so the audit trail is in the report, not hidden in a record.
//
// Fixing the two defects properly is NOT possible mid-tournament: both live in the
// core/scripts pair, and changing that pair changes how every one of the already
// finished duels replays (see manifest §12 for the same hazard with Pendulum scales).
//
// Usage: node reports/structure_decks_haiku_competition/tools/reseed.mjs <duelId>... [--reason <text>]

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDuel, saveDuel } from "../../../src/store.js";
import { viewDuel } from "../../../src/session.js";

const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(REPORT_DIR, "..", "..");
const LEDGER = join(REPORT_DIR, "reseeds.jsonl");
/** Added to the old seed per prior attempt. A large odd number, so successive shuffles are unrelated. */
const SEED_STRIDE = 1000003;

const args = process.argv.slice(2);
const reasonIdx = args.indexOf("--reason");
const reason = reasonIdx === -1 ? "engine could not continue the position" : args[reasonIdx + 1];
const ids = args.filter((a, i) => !a.startsWith("--") && i !== reasonIdx + 1);
if (!ids.length) throw new Error("usage: reseed.mjs <duelId>... [--reason <text>]");

/**
 * Query. How many times this duel has already been reseeded, from the ledger.
 *
 * @param {string} id - duel id
 * @returns {number}
 *
 * @example priorReseeds("sdc-SD10-vs-SDY-g1")  // 0 the first time, 1 after one reset
 */
function priorReseeds(id) {
  if (!existsSync(LEDGER)) return 0;
  return readFileSync(LEDGER, "utf8").trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l)).filter((r) => r.id === id).length;
}

for (const id of ids) {
  if (!existsSync(join(REPO_ROOT, "duels", `${id}.json`))) throw new Error(`no such duel record: ${id}`);
  const duel = loadDuel(id);
  const view = await viewDuel(duel, 2);
  if (view.ended) {
    // Refusing this is the whole safety property: a finished duel is a result, and a
    // result is never re-rolled. Only unplayable positions are reset.
    console.log(`${id}: already finished (P${view.winner} won) — NOT touching it`);
    continue;
  }

  const attempt = priorReseeds(id) + 1;
  const newSeed = (duel.seed + SEED_STRIDE * attempt) % 2 ** 32;
  const record = { at: new Date().toISOString(), id, attempt, oldSeed: duel.seed, newSeed, discardedMoves: duel.responses.length, reason };
  appendFileSync(LEDGER, `${JSON.stringify(record)}\n`);
  saveDuel({ ...duel, seed: newSeed, responses: [], times: [] });
  console.log(`${id}: reset (attempt ${attempt}) — discarded ${record.discardedMoves} moves, seed ${duel.seed} -> ${newSeed}`);
}

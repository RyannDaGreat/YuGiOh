#!/usr/bin/env node
// Random-legal-move playout of a duel record. CALIBRATION AND FUZZING ONLY.
//
// !! NOT A TOURNAMENT TOOL. A tournament duel is NEVER finished, resolved, or
// !! nudged by this script. Every decision in every tournament duel is made by a
// !! Haiku agent; a duel that stalls is forced forward by fresh agents (see
// !! run-tournament.mjs `nudge`), never by random play and never by life-point
// !! comparison. Results produced any other way would be worthless.
//
// What it is good for: measuring how long a classic-format duel runs (used to
// size the tournament: ~490 decisions under uniformly random play), and fuzzing
// the menu code against the engine.
//
// Usage: node reports/structure_decks_haiku_competition/tools/autoplay.mjs <duelId> [maxMoves]

import { loadDuel } from "../../../src/store.js";
import { viewDuel, playChoice } from "../../../src/session.js";

const [id, maxMovesArg] = process.argv.slice(2);
if (!id) throw new Error("usage: autoplay.mjs <duelId> [maxMoves]");
if (id.startsWith("sdc-")) throw new Error(`${id} is a tournament duel; random play is forbidden there`);
/** Hard cap so a pathological loop cannot run forever. A classic duel ends far below this. */
const MAX_MOVES = Number(maxMovesArg ?? 4000);

const started = Date.now();
let moves = loadDuel(id).responses.length;
for (;;) {
  const view = await viewDuel(loadDuel(id), 2);
  if (view.ended) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${id}: ended after ${moves} moves in ${seconds}s — winner ${view.winner === 2 ? "draw" : `P${view.winner}`} (${view.winReason})`);
    break;
  }
  if (moves >= MAX_MOVES) {
    console.log(`${id}: hit cap ${MAX_MOVES} moves, still waiting on P${view.pendingPlayer}`);
    break;
  }
  await playChoice(id, view.pendingPlayer, "random");
  moves += 1;
}

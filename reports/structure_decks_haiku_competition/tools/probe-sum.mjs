#!/usr/bin/env node
// Probe: on a mis-decoded MSG_SELECT_SUM position, is ANY response accepted?
//
// The menu layer refuses picks outside the decoded min/max, and those are exactly
// the numbers we suspect are wrong. So this bypasses the menu and asks the core
// directly: it tries the empty selection and each single index, and reports which
// the core accepts. Purely diagnostic — it runs against a fork and writes nothing.
//
// Usage: node reports/structure_decks_haiku_competition/tools/probe-sum.mjs <forkId>

import { loadDuel } from "../../../src/store.js";
import { viewDuel } from "../../../src/session.js";
import { OcgResponseType } from "ocgcore-wasm";

const [id] = process.argv.slice(2);
if (!id) throw new Error("usage: probe-sum.mjs <forkId>");
if (!id.startsWith("diag-") && !id.startsWith("triage-")) throw new Error("probe only a diag-/triage- fork, never a tournament record");

const duel = loadDuel(id);
const view = await viewDuel(duel, 2);
console.log(`pending: ${view.pending?.type} | menu min=${view.menu?.min} max=${view.menu?.max} items=${view.menu?.items.length}`);
console.log(`selects_must=${view.pending?.selects_must?.length ?? "-"} selects=${view.pending?.selects?.length ?? "-"} amount=${view.pending?.amount}`);

/** Candidate answers to try: the empty list, then every single index, then every pair. */
const candidates = [[]];
const n = view.menu?.items.length ?? 0;
for (let i = 0; i < n; i += 1) candidates.push([i]);
for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) candidates.push([i, j]);

for (const indicies of candidates) {
  const trial = { ...duel, responses: [...duel.responses, { type: OcgResponseType.SELECT_SUM, indicies }], times: [...(duel.times ?? []), null] };
  try {
    const after = await viewDuel(trial, 2);
    console.log(`ACCEPTED indicies=[${indicies}] -> ${after.ended ? "duel ends" : `waiting on P${after.pendingPlayer}`}`);
  } catch (err) {
    console.log(`rejected indicies=[${indicies}] (${String(err.message).slice(0, 60)})`);
  }
}

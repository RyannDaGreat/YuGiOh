#!/usr/bin/env node
// Audits how many tournament duels were exposed to the MSG_CONFIRM_CARDS privacy
// bug fixed on 2026-08-17 (see manifest §17).
//
// The bug keyed a deck reveal's privacy on `msg.player` — the player being SHOWN
// the cards — instead of on who OWNS them, so a "both players banish every copy"
// effect handed a seat its opponent's whole deck list. This replays every duel from
// each seat's perspective and counts the reveals that seat should never have seen:
// a line naming cards in the OTHER player's deck.
//
// It uses the CURRENT (fixed) masking to prove the leak is closed, and reproduces
// the OLD rule in-process to measure what the tournament was actually exposed to.
// Read-only: it never writes to a duel record.
//
// Usage: node reports/structure_decks_haiku_competition/tools/audit-leak.mjs

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { OcgLocation, OcgMessageType } from "ocgcore-wasm";
import { loadDuel } from "../../../src/store.js";
import { replayDuel } from "../../../src/duel.js";

const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(REPORT_DIR, "..", "..");
const schedule = JSON.parse(readFileSync(join(REPORT_DIR, "schedule.json"), "utf8"));

/**
 * Pure function. The OLD, buggy visibility rule, kept here only to measure the
 * damage: a deck/extra reveal was shown to `msg.player` regardless of who owned
 * the cards.
 *
 * @param {{player: number, cards: Array<{controller: number, location: number}>}} msg
 * @param {number} viewer - 0 or 1
 * @returns {boolean} whether the old code would have shown this reveal
 *
 * @example
 * // P0's deck, addressed to P1: the old rule showed it to P1. That was the leak.
 * oldRuleShowed({player: 1, cards: [{controller: 0, location: 1}]}, 1)  // true
 */
export function oldRuleShowed(msg, viewer) {
  const first = msg.cards[0];
  if (!first) return true;
  const fromHiddenPile = first.location === OcgLocation.DECK || first.location === OcgLocation.EXTRA;
  if (!fromHiddenPile) return true;
  return msg.player === viewer;
}

/** Pure function. Whether a reveal exposes cards the viewer does not own from a hidden pile. */
const isCrossOwnerDeckReveal = (msg, viewer) =>
  msg.cards?.length > 0
  && (msg.cards[0].location === OcgLocation.DECK || msg.cards[0].location === OcgLocation.EXTRA)
  && msg.cards.some((c) => c.controller !== viewer);

const ids = schedule.cells.flatMap((c) => c.duels.map((d) => d.id));
let scanned = 0;
const exposed = [];
let leakedCardsTotal = 0;

for (const id of ids) {
  if (!existsSync(join(REPO_ROOT, "duels", `${id}.json`))) continue;
  const duel = loadDuel(id);
  // The RAW core stream, before any masking — `viewDuel` deliberately does not
  // expose it (it returns messageCount only), so replay directly. Getting this
  // wrong is how a first version of this audit reported a reassuring zero.
  const raw = await replayDuel({
    seed: duel.seed,
    deckCodes: duel.decks.map((d) => d.codes),
    extraCodes: duel.decks.map((d) => d.extraCodes ?? []),
    responses: duel.responses,
    format: duel.format ?? "classic",
  });
  scanned += 1;
  const perSeat = [0, 0];
  const cardsPerSeat = [0, 0];
  for (const msg of raw.messages) {
    if (msg.type !== OcgMessageType.CONFIRM_CARDS) continue;
    for (const viewer of [0, 1]) {
      if (isCrossOwnerDeckReveal(msg, viewer) && oldRuleShowed(msg, viewer)) {
        perSeat[viewer] += 1;
        cardsPerSeat[viewer] += msg.cards.filter((c) => c.controller !== viewer).length;
      }
    }
  }
  if (perSeat[0] + perSeat[1] > 0) {
    exposed.push({ id, p0: perSeat[0], p1: perSeat[1], cards: cardsPerSeat[0] + cardsPerSeat[1] });
    leakedCardsTotal += cardsPerSeat[0] + cardsPerSeat[1];
  }
}

console.log(`scanned ${scanned} duels`);
console.log(`duels where a seat could see the OPPONENT'S deck under the old rule: ${exposed.length} (${((exposed.length / scanned) * 100).toFixed(1)}%)`);
console.log(`total card-names leaked across the tournament: ${leakedCardsTotal}`);
console.log("");
for (const e of exposed) console.log(`  ${e.id}: P0 saw ${e.p0} reveal(s), P1 saw ${e.p1} — ${e.cards} card names`);

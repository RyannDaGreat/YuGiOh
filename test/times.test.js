/**
 * Unit tests for the per-move clock (store.js `times`, session.js `atTime`).
 *
 * What they guard: `times` is annotation only — a record replays identically
 * with it, without it, or with a short one — and every reader gets the same
 * answer for "when was this position played" through alignTimes/moveTime.
 * Records written before `times` existed must keep working forever, since a
 * duel record is a permanent replayable document.
 *
 * Nothing here touches `duels/`: the records are built in memory and handed
 * straight to viewDuel, which only ever reads them.
 *
 * Run: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { expandDeck } from "../src/duel.js";
import { chooseFromMenu } from "../src/menu.js";
import { viewDuel } from "../src/session.js";
import { alignTimes, loadDeck, moveTime } from "../src/store.js";

const SEED = 7;
const T1 = "2026-08-16T18:02:00.000Z";

/**
 * Query. A duel record like createDuel's, but in memory only.
 *
 * Args:
 *     fields (object): Extra/overriding record fields (responses, times, ...).
 *
 * Returns:
 *     object: A record viewDuel accepts.
 */
function record(fields) {
  const decks = ["yugi", "kaiba"].map((n) => loadDeck(n)).map((d) => ({ name: d.name, main: d.main, codes: expandDeck(d.main) }));
  return { id: "memory-only", created: "2026-08-16T18:00:00.000Z", seed: SEED, decks, players: ["a", "b"], responses: [], ...fields };
}

test("alignTimes: one entry per response, whatever the record holds", () => {
  assert.deepEqual(alignTimes(["a", "b"], 2), ["a", "b"]);
  assert.deepEqual(alignTimes(undefined, 2), [null, null], "a record from before `times` existed");
  assert.deepEqual(alignTimes([], 2), [null, null]);
  assert.deepEqual(alignTimes(["a"], 3), ["a", null, null], "timestamps started mid-duel");
  assert.deepEqual(alignTimes(["a", "b", "c"], 1), ["a"], "rewound by `undo` / truncated by a fork");
  assert.deepEqual(alignTimes(["a"], 0), []);
});

test("moveTime: the clock of the position after N moves", () => {
  const times = ["2026-08-16T18:00:00.000Z", T1];
  assert.equal(moveTime(times, 2), T1, "the last replayed response");
  assert.equal(moveTime(times, 1), times[0]);
  assert.equal(moveTime(times, 0), null, "nothing has been played at the start");
  assert.equal(moveTime(undefined, 5), null, "no timestamps in this record");
  assert.equal(moveTime([null, T1], 1), null, "a move that predates timestamps");
});

test("viewDuel reports atTime, and a record without times still views identically", async () => {
  const empty = await viewDuel(record({}), 2);
  assert.equal(empty.at, 0);
  assert.equal(empty.atTime, null, "no move has been played yet");
  assert.ok(empty.menu, "the core is asking someone");

  // One real move, recorded both ways: with a timestamp and (as older files are) without.
  const response = chooseFromMenu(empty.menu, "1");
  const stamped = await viewDuel(record({ responses: [response], times: [T1] }), 2);
  const legacy = await viewDuel(record({ responses: [response] }), 2);

  assert.equal(stamped.at, 1);
  assert.equal(stamped.atTime, T1);
  assert.equal(legacy.atTime, null, "an untimed record views fine; its clock is simply unknown");
  assert.deepEqual(legacy.logLines, stamped.logLines, "`times` is annotation: it cannot change a replay");
  assert.deepEqual(legacy.stateLines, stamped.stateLines);

  const rewound = await viewDuel(record({ responses: [response], times: [T1] }), 2, 0);
  assert.equal(rewound.at, 0);
  assert.equal(rewound.total, 1);
  assert.equal(rewound.atTime, null, "playback at the start of a timed duel");
  assert.deepEqual(rewound.logLines, empty.logLines);
});

/**
 * Unit tests for the per-duel chat log (src/chat.js).
 *
 * Everything runs against a temp directory passed as the `dir` argument, so no
 * test ever writes into `duels/` — a real game may be in progress there.
 *
 * What they guard: the chat file is the ONLY thing chat may write (never the
 * duel record), sender names come from the duel record rather than the caller,
 * and the limits (empty / too long / bad seat) fail loudly instead of storing
 * junk.
 *
 * Run: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendChat, chatPath, chatSince, formatChat, loadChat, MAX_CHAT_CHARS } from "../src/chat.js";

/** A duel record stub: chat only ever reads `players` from it. */
const DUEL = { id: "g1", players: ["ryan", "claude"], seed: 1, decks: [], responses: [] };

/**
 * Command. Makes a temp duels directory holding one duel record.
 *
 * Returns:
 *     string: The directory path (caller removes it).
 */
function tempDuels() {
  const dir = mkdtempSync(join(tmpdir(), "ygo-chat-"));
  writeFileSync(join(dir, "g1.json"), JSON.stringify(DUEL));
  return dir;
}

test("append/load round-trip: names come from the duel record, order is chronological", () => {
  const dir = tempDuels();
  try {
    assert.deepEqual(loadChat("g1", dir), [], "no file yet = no messages");

    const first = appendChat("g1", 0, "gl hf", "2026-08-16T18:00:00.000Z", dir);
    assert.deepEqual(first, { seat: 0, name: "ryan", text: "gl hf", at: "2026-08-16T18:00:00.000Z" });
    appendChat("g1", 1, "  you too  ", "2026-08-16T18:00:30.000Z", dir);
    appendChat("g1", 2, "nice duel", "2026-08-16T18:01:00.000Z", dir);

    const messages = loadChat("g1", dir);
    assert.equal(messages.length, 3);
    assert.deepEqual(messages.map((m) => m.name), ["ryan", "claude", "spectator"]);
    assert.equal(messages[1].text, "you too", "text is trimmed");
    assert.deepEqual(messages.map((m) => m.seat), [0, 1, 2]);

    assert.equal(chatPath("g1", dir), join(dir, "g1.chat.json"));
    assert.deepEqual(JSON.parse(readFileSync(chatPath("g1", dir), "utf8")), messages);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "g1.json"), "utf8")), DUEL, "the duel record is untouched");
    assert.equal(existsSync(`${chatPath("g1", dir)}.tmp`), false, "the atomic write leaves no temp file");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejected messages: empty, over the length cap, unknown seat, unknown duel", () => {
  const dir = tempDuels();
  try {
    const now = "2026-08-16T18:00:00.000Z";
    assert.throws(() => appendChat("g1", 0, "   ", now, dir), /empty chat message/);
    assert.throws(() => appendChat("g1", 0, "x".repeat(MAX_CHAT_CHARS + 1), now, dir), /too long/);
    assert.throws(() => appendChat("g1", 3, "hi", now, dir), /invalid chat seat/);
    assert.throws(() => appendChat("nope", 0, "hi", now, dir), /no such duel/);
    assert.throws(() => chatPath("../escape", dir), /invalid duel id/);

    const atCap = appendChat("g1", 0, "x".repeat(MAX_CHAT_CHARS), now, dir);
    assert.equal(atCap.text.length, MAX_CHAT_CHARS, "exactly the cap is allowed");
    assert.equal(loadChat("g1", dir).length, 1, "nothing rejected was written");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("chatSince / formatChat", () => {
  const log = [
    { seat: 0, name: "ryan", text: "gl hf", at: "2026-08-16T18:00:00.000Z" },
    { seat: 1, name: "claude", text: "same", at: "2026-08-16T18:05:00.000Z" },
  ];
  assert.deepEqual(chatSince(log, "2026-08-16T18:00:00.000Z"), [log[1]], "strictly newer than the cutoff");
  assert.deepEqual(chatSince(log, "2026-08-16T19:00:00.000Z"), []);
  assert.deepEqual(chatSince(log, "2026-08-16T17:00:00.000Z"), log);
  assert.throws(() => chatSince(log, "yesterday"), /not an ISO timestamp/);

  assert.match(formatChat(log[0]), /^\[\d\d:\d\d:\d\d\] ryan \(P0\): gl hf$/);
  assert.match(formatChat({ ...log[0], seat: 2, name: "spectator" }), /spectator \(spectator\): gl hf$/);
});

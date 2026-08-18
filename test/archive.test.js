/**
 * Export/import of the app's whole state, and the volume abstraction underneath.
 *
 * The round-trip is the point: an archive taken from one host must restore
 * byte-identically on another, because that is how duels move between the Node
 * server and a browser that has no disk.
 *
 * Run: npm test
 */

// Installs the real filesystem as the app volume (src/volume.js).
import "../src/volume-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ARCHIVE_VERSION, exportArchive, importArchive } from "../src/archive.js";
import { join, memoryVolume, setVolume } from "../src/volume.js";
import { installNodeVolume } from "../src/volume-node.js";

test("volume: memory backend implements the six calls store/chat/presence use", () => {
  const v = memoryVolume({ "duels/g1.json": "{\"id\":1}" });
  assert.equal(v.existsSync("duels/g1.json"), true);
  assert.equal(v.existsSync("duels/nope.json"), false);
  assert.equal(v.existsSync("duels"), true, "a directory exists when something lives under it");
  assert.deepEqual(v.readdirSync("duels"), ["g1.json"]);
  v.writeFileSync("duels/g2.json", "{}");
  assert.deepEqual(v.readdirSync("duels").sort(), ["g1.json", "g2.json"]);
  v.renameSync("duels/g2.json", "duels/g3.json");
  assert.deepEqual(v.readdirSync("duels").sort(), ["g1.json", "g3.json"]);
  assert.throws(() => v.readFileSync("duels/missing.json"), /ENOENT/);
});

test("volume: join is browser-safe and collapses separators", () => {
  assert.equal(join("duels", "g1.json"), "duels/g1.json");
  assert.equal(join("", "duels", "", "g1.json"), "duels/g1.json");
  assert.equal(join("/repo", "duels/"), "/repo/duels");
});

test("archive: a real export round-trips into a fresh volume unchanged", () => {
  const original = exportArchive("2026-08-17T12:00:00.000Z");
  assert.equal(original.version, ARCHIVE_VERSION);
  assert.ok(Object.keys(original.files).length > 0, "the repo has state to export");

  // Restore into an empty in-memory volume — the browser's situation exactly.
  const fresh = memoryVolume();
  setVolume(fresh);
  try {
    const { written, skipped } = importArchive(original);
    assert.equal(skipped.length, 0, "nothing pre-exists in an empty volume");
    assert.equal(written.length, Object.keys(original.files).length);

    const restored = exportArchive("2026-08-17T12:00:00.000Z");
    assert.deepEqual(restored.files, original.files, "byte-identical after a round trip");
  } finally {
    installNodeVolume();
  }
});

test("archive: import refuses paths outside the state directories, atomically", () => {
  const fresh = memoryVolume();
  setVolume(fresh);
  try {
    assert.throws(() => importArchive({ version: 1, files: { "../../etc/passwd": "x" } }), /outside the state directories/);
    assert.throws(() => importArchive({ version: 1, files: { "package.json": "x" } }), /outside the state directories/);
    assert.deepEqual(fresh.readdirSync(""), [], "a rejected archive writes nothing at all");
  } finally {
    installNodeVolume();
  }
});

test("archive: a newer version is refused, and existing files are kept unless replacing", () => {
  const fresh = memoryVolume();
  setVolume(fresh);
  try {
    assert.throws(() => importArchive({ version: ARCHIVE_VERSION + 1, files: {} }), /newer than this build/);
    assert.throws(() => importArchive(null), /not an archive/);

    const one = { version: 1, files: { "duels/g1.json": "FIRST" } };
    assert.deepEqual(importArchive(one).written, ["duels/g1.json"]);
    const two = { version: 1, files: { "duels/g1.json": "SECOND" } };
    assert.deepEqual(importArchive(two), { written: [], skipped: ["duels/g1.json"] }, "default never clobbers");
    assert.deepEqual(importArchive(two, true).written, ["duels/g1.json"], "replace overwrites on request");
  } finally {
    installNodeVolume();
  }
});

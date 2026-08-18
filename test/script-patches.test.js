/**
 * Compatibility patches applied to shared Lua on the way into the engine
 * (src/cardsource.js SCRIPT_PATCHES). Pins the one that keeps Droll & Lock Bird
 * — and any effect registered mid-resolution — from deadlocking a duel on the
 * pinned ocgcore-wasm 0.1.2 core, which rejects the newest CHAININFO flags.
 *
 * Run: npm test
 */
import "../src/volume-node.js";
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { scriptReader } from "../src/cards.js";
import { patchScript } from "../src/cardsource.js";
import { replayDuel } from "../src/duel.js";
import { codeOf } from "../src/cards.js";
import { buildMenu } from "../src/menu.js";

test("chain.lua's chaininfo getters are pcall-guarded on every read, idempotently", () => {
  const text = scriptReader("chain.lua");
  assert.match(text, /pcall\(Duel\.GetChainInfo,ch or 0,info\)/, "the shared getter factory is guarded");
  assert.equal(patchScript("chain.lua", text), text, "applying the patch again changes nothing");
  assert.equal(patchScript("utility.lua", "x"), "x", "files without a patch pass through");
  assert.equal(patchScript("chain.lua", null), null);
});

test("Droll & Lock Bird resolves instead of deadlocking (the core rejects CHAININFO flags its snapshot asks for)", async () => {
  // P0 holds Droll; P1 activates Pot of Desires (a draw) so P0 gets the respond window.
  const dir = mkdtempSync(join(tmpdir(), "droll-"));
  const deck0 = { name: "D0", category: "user", format: "classic", main: [["Droll & Lock Bird", 3], ["Mystical Elf", 37]], extra: [], side: [] };
  const deck1 = { name: "D1", category: "user", format: "classic", main: [["Pot of Desires", 3], ["Reinforcement of the Army", 3], ["Celtic Guardian", 34]], extra: [], side: [] };
  writeFileSync(join(dir, "d0.json"), JSON.stringify(deck0));
  writeFileSync(join(dir, "d1.json"), JSON.stringify(deck1));
  try {
    const { loadDeck } = await import("../src/store.js");
    const { expandDeck } = await import("../src/duel.js");
    const codes = [expandDeck(loadDeck(join(dir, "d0.json")).main), expandDeck(loadDeck(join(dir, "d1.json")).main)];
    // Drive the same sequence the CLI probe used, seed 3: P0 end turn; P1 activate Pot of Desires, place s0; P0 activate Droll.
    const step = async (responses) => replayDuel({ seed: 3, deckCodes: codes, responses });
    let r = await step([]);
    const pick = (menuTitleRe, itemRe) => {
      const menu = buildMenu(r.pending, { selectHint: 0n, eventHint: 0n, field: null });
      assert.match(menu.title, menuTitleRe);
      const i = menu.items.findIndex((it) => itemRe.test(it.label));
      assert.ok(i >= 0, `${itemRe} in ${menu.items.map((x) => x.label).join(" | ")}`);
      return menu.build([menu.items[i].value]);
    };
    const responses = [];
    responses.push(pick(/main phase action/, /^End turn/)); r = await step(responses);
    responses.push(pick(/main phase action/, /Activate Pot of Desires/)); r = await step(responses);
    responses.push(pick(/^P1: /, /^P1 s0$/)); r = await step(responses);
    responses.push(pick(/respond\?/, /Activate Droll & Lock Bird/)); r = await step(responses);
    // Before the patch this step ended in "chain.lua:85: Passed invalid CHAININFO flag" and the
    // duel could not advance. Now the effect resolves and it is P1's decision again.
    assert.equal(r.pending?.player, 1, "the duel advanced to P1 after Droll resolved");
    // A core Lua error surfaces as a thrown "card script errors during play" (duel.js), which
    // would have failed the last step() above; reaching here with P1 to move is the proof.
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

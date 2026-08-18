/**
 * Tests for the LLM-seat layer (src/ai/).
 *
 * Everything runs against an in-memory volume (src/volume.js `memoryVolume`),
 * installed once at module load after the real decks have been read — so no test
 * here ever writes into `duels/`, where a real game may be in progress. Node runs
 * each test file in its own process, so swapping the global volume is contained.
 *
 * Two layers are covered:
 *
 * - **Offline**: the choice contract (enum building, answer parsing, validation),
 *   the context strategies, the trace file, and the player loop driven by fake
 *   providers — including the paths that matter most, a model answering off-menu
 *   and a provider failing outright.
 * - **Live**: one real OpenAI duel, skipped unless OPENAI_API_KEY is set
 *   (`set -a; . ./.env.local; set +a; npm test`). It plays the opening moves of a
 *   fresh duel against a random opponent and checks the traces landed.
 *
 * Run: npm test
 */

// Installs the real filesystem as the app volume (src/volume.js) and cards.cdb
// as the card source (src/cardsource.js).
import "../src/volume-node.js";
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync as readRealFile } from "node:fs";
import { fileURLToPath } from "node:url";
import { memoryVolume, readFileSync, setVolume } from "../src/volume.js";
import { createDuel, loadDeck, loadDuel } from "../src/store.js";
import { playChoice, viewDuel } from "../src/session.js";
import {
  MAX_OUTPUT_TOKENS_CEILING, PROVIDER_CATALOG, answerInstruction, decisionSchema, defaultModel, defaultOptions,
  getProvider, legalChoices, nextOutputBudget, parseDecision, providers, registerProvider, usageOf,
} from "../src/ai/provider.js";
import { FullHistoryStrategy, StateOnlyStrategy, frozenSystem, makeStrategy, turnBlock } from "../src/ai/context.js";
import { appendTrace, loadTrace, summarizeTrace, tracePath, traceRecord } from "../src/ai/trace.js";
import { playMove, playSeat } from "../src/ai/player.js";
import { openai } from "../src/ai/openai.js";
import "../src/ai/anthropic.js";
import "../src/ai/gemini.js";

/** The real decks, read while the Node volume is still installed. */
const DECKS = [loadDeck("yugi"), loadDeck("kaiba")];
/** PLAYER.md, read the way a Node host reads it (a browser host bundles it). */
const PLAYER_GUIDE = readRealFile(fileURLToPath(new URL("../PLAYER.md", import.meta.url)), "utf8");

// From here on the whole app writes into memory, never into duels/.
setVolume(memoryVolume());

/** A stand-in guide for offline tests, so their prompts stay small and readable. */
const TINY_GUIDE = "Play legally. Never read the other seat's cards.";

/**
 * Command. Creates a fresh duel in the memory volume.
 *
 * Args:
 *     id (string): Duel id, unique per test.
 *     seed (number): Shuffle seed.
 *
 * Returns:
 *     object: The duel record.
 */
function freshDuel(id, seed = 99) {
  return createDuel({ id, seed, decks: DECKS, players: ["p0", "p1"], created: "2026-08-17T18:00:00.000Z" });
}

/**
 * Pure function. A provider that answers from a fixed script — the test double
 * for everything that does not need a network.
 *
 * Args:
 *     answers (string[]): One raw answer per call; the last repeats forever.
 *     opts.fail (Error|null): Thrown instead of answering, to test the transport
 *         failure path.
 *
 * Returns:
 *     MoveProvider
 *
 * Examples:
 *     >>> const p = scripted(['{"choice":"1","reason":"only move"}'])
 *     >>> (await p.chooseMove({})).text   // '{"choice":"1","reason":"only move"}'
 */
function scripted(answers, { fail = null } = {}) {
  let calls = 0;
  return {
    id: "scripted",
    label: "Scripted",
    listModels: () => [{ id: "scripted-1", label: "Scripted 1", default: true }],
    chooseMove: async () => {
      if (fail) throw fail;
      const text = answers[Math.min(calls++, answers.length - 1)];
      return { text, reasoning: "because the script said so", usage: { in: 10, out: 5, reasoning: 2 }, raw: {}, latencyMs: 3 };
    },
  };
}

/**
 * Command. Plays random legal moves for a seat until aborted or the duel ends —
 * the opponent in the live test.
 *
 * Args:
 *     id (string): Duel id.
 *     seat (0|1): Seat to play.
 *     signal (AbortSignal): Stops the loop.
 *
 * Returns:
 *     Promise<void>
 */
async function randomOpponent(id, seat, signal) {
  while (!signal.aborted) {
    const view = await viewDuel(loadDuel(id), seat);
    if (view.ended) return;
    if (view.pendingPlayer === seat) await playChoice(id, seat, "random");
    else await new Promise((r) => setTimeout(r, 50));
  }
}

// ---------------------------------------------------------------- the contract

test("legalChoices enumerates single-pick menus and refuses the rest", () => {
  assert.deepEqual(legalChoices({ mode: "one", items: ["Yes", "No"], zero: null }), ["1", "2"]);
  assert.deepEqual(legalChoices({ mode: "one", items: ["Activate Trap Hole"], zero: "Do not activate" }), ["1", "0"]);
  assert.equal(legalChoices({ mode: "many", items: ["a", "b"], zero: null }), null, "combinatorial answer space");
  assert.equal(legalChoices({ mode: "order", items: ["a", "b"], zero: null }), null);
  assert.equal(legalChoices({ mode: "counters", items: ["a"], zero: null }), null);
  assert.equal(legalChoices({ mode: "name", items: [], zero: null }), null);
  assert.equal(legalChoices(null), null, "no menu = nothing to constrain");
});

test("decisionSchema puts the legal choices in an enum, or takes a free string", () => {
  const strict = decisionSchema(["1", "2", "0"]);
  assert.deepEqual(strict.properties.choice.enum, ["1", "2", "0"]);
  assert.deepEqual(strict.required, ["choice", "reason"]);
  assert.equal(strict.additionalProperties, false, "OpenAI strict mode requires this");
  assert.equal(decisionSchema(null).properties.choice.enum, undefined);
});

test("answerInstruction names exactly the choices the schema allows", () => {
  assert.match(answerInstruction(["1", "2", "0"]), /one of: 1, 2, 0/);
  assert.match(answerInstruction(null), /name:Card Name/);
});

test("parseDecision reads JSON, fenced JSON and a bare choice; refuses prose", () => {
  assert.deepEqual(parseDecision('{"choice": "2", "reason": "bigger body"}', ["1", "2"]), { choice: "2", reason: "bigger body" });
  assert.deepEqual(parseDecision('```json\n{"choice":"1","reason":"only play"}\n```', null), { choice: "1", reason: "only play" });
  assert.deepEqual(parseDecision('{"choice": 3}', null), { choice: "3", reason: null }, "a number is a choice too");
  assert.deepEqual(parseDecision("1, 4", null), { choice: "1,4", reason: null }, "spaces inside a multi-pick are not an answer");
  assert.deepEqual(parseDecision("name:Dark Hole", null).choice, "name:Dark Hole");
  assert.throws(() => parseDecision("I think option 2 is best", ["1", "2"]), /could not read a choice/);
  assert.throws(() => parseDecision('{"reason": "hmm"}', null), /could not read a choice/);
  assert.throws(() => parseDecision('{"choice": "9"}', ["1", "2"]), /not an option/, "structured output is a promise, not a check");
});

test("usageOf keeps numbers and nulls out everything else", () => {
  assert.deepEqual(usageOf({ in: 5310, out: 412, reasoning: 260 }), { in: 5310, out: 412, reasoning: 260 });
  assert.deepEqual(usageOf({ in: 77, out: 13 }), { in: 77, out: 13, reasoning: null });
  assert.deepEqual(usageOf({}), { in: null, out: null, reasoning: null });
});

// ---------------------------------------------------------------- the registry

test("the three cloud adapters register themselves on import", () => {
  for (const id of ["anthropic", "openai", "gemini"]) {
    const provider = getProvider(id);
    assert.equal(provider.id, id);
    assert.ok(provider.listModels().length, `${id} lists models`);
  }
  assert.throws(() => getProvider("nope"), /unknown provider/);
  assert.throws(() => registerProvider({ id: "x", label: "X" }), /missing "listModels"/);
  assert.ok(providers.has("openai"));
});

test("PROVIDER_CATALOG is self-consistent, so a UI can render it blind", () => {
  for (const [key, entry] of Object.entries(PROVIDER_CATALOG)) {
    assert.equal(entry.id, key, "catalog key is the provider id");
    assert.equal(entry.models.filter((m) => m.default).length, 1, `${key} names exactly one default model`);
    assert.ok(entry.endpoint.startsWith("https://"), `${key} endpoint is https`);
    for (const option of entry.options) {
      assert.ok(option.name && option.label, `${key}.${option.name} is labelled`);
      assert.ok(option.values.includes(option.default), `${key}.${option.name} defaults to one of its values`);
    }
  }
});

test("defaults come from the provider, not a catalog lookup", () => {
  assert.equal(defaultModel(getProvider("openai")), "gpt-5.6-terra");
  assert.equal(defaultModel(getProvider("anthropic")), "claude-sonnet-5");
  assert.deepEqual(defaultOptions(getProvider("gemini")), { thinkingLevel: "low", includeThoughts: true });
  assert.deepEqual(defaultOptions(scripted([])), {}, "a provider with no options needs no catalog entry");
});

// ---------------------------------------------------------- the output budget

/**
 * Command. Runs `body` with `globalThis.fetch` answering from a script of
 * response payloads (the last repeats), and returns what was sent. Restores the
 * real fetch afterwards, whatever happens.
 *
 * Args:
 *     payloads (object[]): One parsed response body per call.
 *     body (function): The code under test; its result comes back as `result`.
 *
 * Returns:
 *     Promise<{sent: Array<{url: string, body: object}>, result: any}>
 */
async function withStubbedFetch(payloads, body) {
  const real = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    const payload = payloads[Math.min(sent.length - 1, payloads.length - 1)];
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };
  try {
    return { sent, result: await body() };
  } finally {
    globalThis.fetch = real;
  }
}

/**
 * Pure function. An OpenAI /v1/responses payload.
 *
 * Args:
 *     text (string|null): The assistant message's text; null for a run that
 *         produced no message at all (all budget spent reasoning).
 *     opts.incomplete (boolean): Cut off at `max_output_tokens`.
 *
 * Returns:
 *     object
 *
 * Examples:
 *     >>> openaiReply('{"choice":"gg"}').status              // "completed"
 *     >>> openaiReply(null, {incomplete: true}).incomplete_details   // {reason: "max_output_tokens"}
 */
function openaiReply(text, { incomplete = false } = {}) {
  return {
    status: incomplete ? "incomplete" : "completed",
    ...(incomplete ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    output: [
      { type: "reasoning", summary: [] },
      ...(text === null ? [] : [{ type: "message", content: [{ type: "output_text", text }] }]),
    ],
    usage: { input_tokens: 100, output_tokens: 500, output_tokens_details: { reasoning_tokens: 480 } },
  };
}

/** The request `openaiCall` makes; only the budget varies between tests. */
const openaiCall = (maxOutputTokens) => openai.chooseMove({
  apiKey: "not-a-real-key", model: "gpt-5.6-terra", system: "You are P0",
  messages: [{ role: "user", content: "hi" }], choices: null, options: { effort: "low" }, maxOutputTokens,
});

test("nextOutputBudget grows the budget geometrically and stops at the ceiling", () => {
  assert.equal(nextOutputBudget(512), 2048);
  assert.equal(nextOutputBudget(8192), MAX_OUTPUT_TOKENS_CEILING);
  assert.equal(nextOutputBudget(16384), MAX_OUTPUT_TOKENS_CEILING, "clamped, never overshot");
  assert.equal(nextOutputBudget(MAX_OUTPUT_TOKENS_CEILING), null, "there is a stop");
});

test("a PARTIAL answer is retried with a bigger budget, not handed back as an answer", async () => {
  // The live bug: gpt-5.6-terra spent 512 tokens reasoning and returned JSON cut
  // mid-string. Because text came back at all, the old retry did not fire and the
  // fragment was posted to the table chat verbatim.
  const cut = '{"choice":"Because Snatch Steal gives me control of Skilled Dark Mag';
  const whole = '{"choice":"It would summon MY Dark Magician.","reason":"control"}';
  const { sent, result } = await withStubbedFetch(
    [openaiReply(cut, { incomplete: true }), openaiReply(whole)],
    () => openaiCall(512),
  );
  assert.equal(sent.length, 2, "the cut-off answer was thrown away and asked again");
  assert.deepEqual(sent.map((r) => r.body.max_output_tokens), [512, 2048]);
  assert.equal(result.text, whole);
  assert.equal(result.truncated, false);
});

test("an answer that never fits stops at the ceiling and says it was cut off", async () => {
  const { sent, result } = await withStubbedFetch(
    [openaiReply('{"choice":"still going', { incomplete: true })],
    () => openaiCall(512),
  );
  // 512 → 2048 → 8192 → 32768, then no more: retrying forever is not a fallback.
  assert.deepEqual(sent.map((r) => r.body.max_output_tokens), [512, 2048, 8192, MAX_OUTPUT_TOKENS_CEILING]);
  assert.equal(result.truncated, true, "the caller can tell this is a fragment, not an answer");
});

test("a run that produced no message at all is retried too, then fails loudly", async () => {
  const { sent, result } = await withStubbedFetch(
    [openaiReply(null, { incomplete: true }), openaiReply('{"choice":"1","reason":"ok"}')],
    () => openaiCall(8192),
  );
  assert.deepEqual(sent.map((r) => r.body.max_output_tokens), [8192, MAX_OUTPUT_TOKENS_CEILING]);
  assert.equal(result.truncated, false);
  await assert.rejects(
    withStubbedFetch([openaiReply(null, { incomplete: true })], () => openaiCall(MAX_OUTPUT_TOKENS_CEILING)),
    /no assistant message/,
    "at the ceiling with nothing to show, the caller is told — never given an empty answer",
  );
});

test("a complete answer is never retried, and carries truncated: false", async () => {
  const { sent, result } = await withStubbedFetch(
    [openaiReply('{"choice":"1","reason":"only move"}')],
    () => openaiCall(512),
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, PROVIDER_CATALOG.openai.endpoint);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.usage, { in: 100, out: 500, reasoning: 480 });
});

// ---------------------------------------------------------------- the context

test("frozenSystem holds the guide, the manual and both decklists — and nothing per-turn", () => {
  const duel = freshDuel("ctx-system");
  const system = frozenSystem({ duelId: duel.id, seat: 1, players: duel.players, decks: duel.decks, format: "classic", playerGuide: TINY_GUIDE, brief: "Set and pass." });
  assert.match(system, /you are P1 \(p1\), playing Kaiba/);
  assert.match(system, /Play legally\./);
  assert.match(system, /Strategy brief/);
  assert.match(system, /## P0 decklist — Yugi \(\d+ cards\)/);
  assert.match(system, /## P1 decklist — Kaiba \(\d+ cards\)/);
  assert.match(system, /Blue-Eyes White Dragon/, "card text, so the model never has to look one up");
  assert.doesNotMatch(system, /Your options/, "the menu is per-turn, never in the frozen prefix");
});

test("turnBlock shows the whole log at cursor 0 and only the delta after", () => {
  const view = {
    logLines: ["== Turn 1 (P0) ==", "P0 draws 1 card", "P0 sets a monster at m2"],
    stateLines: ["P0 LP 8000"],
    menuLines: ["Main Phase 1", "  1. End turn"],
    menu: { mode: "one", items: ["End turn"], zero: null },
  };
  const opening = turnBlock(view, 0);
  assert.match(opening, /## Log so far/);
  assert.match(opening, /P0 draws 1 card/);
  const later = turnBlock(view, 2);
  assert.match(later, /## Since your last decision/);
  assert.doesNotMatch(later, /P0 draws 1 card/, "already seen");
  assert.match(later, /P0 sets a monster at m2/);
  assert.match(later, /one of: 1/, "the answer instruction matches the menu");
  assert.match(turnBlock(view, 3), /\(nothing new\)/);
});

test("state-only sends one message per turn; full history accumulates", () => {
  const view = { logLines: ["a", "b"], stateLines: ["s"], menuLines: ["m"], menu: { mode: "one", items: ["x"], zero: null } };
  const stateOnly = new StateOnlyStrategy();
  const first = stateOnly.messages(view);
  assert.equal(first.length, 1);
  stateOnly.record({ view, messages: first, text: '{"choice":"1"}' });
  assert.equal(stateOnly.logCursor, 2, "cursor advances so the next turn is a delta");
  assert.equal(stateOnly.messages(view).length, 1, "flat cost, forever");

  const full = new FullHistoryStrategy();
  const sent = full.messages(view);
  full.record({ view, messages: sent, text: '{"choice":"1"}' });
  assert.deepEqual(full.messages(view).map((m) => m.role), ["user", "assistant", "user"]);
  full.record({ view, messages: full.messages(view), text: null });
  assert.deepEqual(full.messages(view).map((m) => m.role), ["user", "assistant", "user"], "a failed turn is not recorded");
});

test("makeStrategy defaults to state-only and rejects an unknown id", () => {
  assert.equal(makeStrategy().id, "state-only");
  assert.equal(makeStrategy("full-history").id, "full-history");
  assert.throws(() => makeStrategy("sliding"), /unknown context strategy/);
});

// ---------------------------------------------------------------- the trace

test("traceRecord copies an explicit field list, so a key cannot ride along", () => {
  const record = traceRecord({
    move: 17, at: "2026-08-17T18:04:15.340Z", seat: 0, provider: "openai", model: "gpt-5.6-terra",
    options: { effort: "low" }, system: "sys", messages: [{ role: "user", content: "hi", apiKey: "sk-LEAK" }],
    response: '{"choice":"1"}', reasoning: null, usage: { in: 1, out: 2 }, latencyMs: 5,
    choice: "1", chosenLabel: "End turn", retries: 0, apiKey: "sk-LEAK",
  });
  assert.deepEqual(Object.keys(record).sort(), [
    "at", "chosenLabel", "choice", "error", "latencyMs", "messages", "model", "move", "options", "provider", "reasoning", "response", "retries", "seat", "system", "usage",
  ].sort());
  assert.doesNotMatch(JSON.stringify(record), /LEAK/, "neither the top level nor the messages carry a credential");
  assert.deepEqual(record.usage, { in: 1, out: 2, reasoning: null });
  assert.equal(record.error, null);
});

test("traces round-trip, and the repeated system prefix is stored once", () => {
  const base = { at: "t", seat: 0, provider: "scripted", model: "m", options: {}, system: "FROZEN", messages: [], response: "r", reasoning: null, usage: {}, latencyMs: 1, chosenLabel: "End turn", retries: 0 };
  assert.deepEqual(loadTrace("nothing-here", 0), []);
  appendTrace("tr", 0, traceRecord({ ...base, move: 0, choice: "1" }));
  appendTrace("tr", 0, traceRecord({ ...base, move: 1, choice: "2" }));
  appendTrace("tr", 0, traceRecord({ ...base, move: 2, choice: "3", system: "CHANGED" }));

  const loaded = loadTrace("tr", 0);
  assert.deepEqual(loaded.map((r) => r.choice), ["1", "2", "3"]);
  assert.deepEqual(loaded.map((r) => r.system), ["FROZEN", "FROZEN", "CHANGED"], "rehydrated for the caller");
  const stored = JSON.parse(readFileSync(tracePath("tr", 0), "utf8"));
  assert.deepEqual(stored.map((r) => r.system), ["FROZEN", null, "CHANGED"], "but written once on disk");
  assert.deepEqual(loadTrace("tr", 1), [], "the other seat has its own file");
  assert.throws(() => tracePath("bad/id", 0), /invalid duel id/);
  assert.throws(() => tracePath("ok", 2), /invalid seat/);
});

test("summarizeTrace reads at a glance, including the failures", () => {
  assert.equal(
    summarizeTrace({ move: 17, provider: "openai", model: "gpt-5.6-terra", latencyMs: 4120, usage: { in: 5310, out: 412, reasoning: 260 }, chosenLabel: "Normal Summon Vorse Raider", retries: 0, error: null }),
    "move 17: openai/gpt-5.6-terra -> Normal Summon Vorse Raider (4120ms, 5310 in / 412 out / 260 thinking)",
  );
  assert.match(
    summarizeTrace({ move: 3, provider: "openai", model: "gpt-5-nano", latencyMs: null, usage: {}, chosenLabel: "End turn", retries: 2, error: "off-menu" }),
    /\?ms, \? in \/ \? out\) \[2 retries\] ERROR: off-menu/,
  );
});

// ---------------------------------------------------------------- the loop

test("a scripted provider plays real moves and leaves a trace per move", async () => {
  const id = "loop-ok";
  freshDuel(id);
  const traced = [];
  const result = await playSeat({
    duelId: id, seat: 0, provider: scripted(['{"choice":"1","reason":"first legal option"}']),
    model: "scripted-1", apiKey: "not-a-real-key", playerGuide: TINY_GUIDE,
    maxMoves: 2, pollMs: 10, onTrace: (t) => traced.push(t),
  });
  assert.equal(result.reason, "max-moves");
  assert.equal(result.moves, 2);
  assert.equal(traced.length, 2);

  const traces = loadTrace(id, 0);
  assert.deepEqual(traces.map((t) => t.move), [0, 1], "move index = position in the replay");
  assert.deepEqual(traces.map((t) => t.choice), ["1", "1"]);
  assert.deepEqual(traces.map((t) => t.retries), [0, 0]);
  assert.ok(traces.every((t) => t.error === null && t.chosenLabel));
  assert.equal(traces[0].system, traces[1].system, "the frozen prefix really is frozen");
  assert.equal(loadDuel(id).responses.length, 2, "the moves are in the duel record");
  assert.deepEqual(traces[0].usage, { in: 10, out: 5, reasoning: 2 });
});

test("an off-menu answer is re-asked once, then falls back to a random legal move — loudly", async () => {
  const id = "loop-bad";
  freshDuel(id);
  const result = await playSeat({
    duelId: id, seat: 0, provider: scripted(["I choose violence", '{"choice":"999"}']),
    model: "scripted-1", apiKey: "not-a-real-key", playerGuide: TINY_GUIDE, maxMoves: 1, pollMs: 10,
  });
  assert.equal(result.moves, 1);
  const [trace] = loadTrace(id, 0);
  assert.equal(trace.retries, 2);
  assert.equal(trace.choice, "random");
  assert.match(trace.error, /played a random legal move instead/);
  assert.ok(trace.chosenLabel, "the duel still advanced");
  assert.deepEqual(trace.messages.map((m) => m.role), ["user", "assistant", "user"], "the complaint was sent back to the model");
  assert.match(trace.messages[2].content, /That answer was rejected/);
  assert.equal(loadDuel(id).responses.length, 1);
});

test("a provider failure is traced and re-thrown, never papered over with a random move", async () => {
  const id = "loop-broken";
  freshDuel(id);
  await assert.rejects(
    playSeat({
      duelId: id, seat: 0, provider: scripted([], { fail: new Error("OpenAI API 401: invalid key") }),
      model: "scripted-1", apiKey: "not-a-real-key", playerGuide: TINY_GUIDE, maxMoves: 1, pollMs: 10,
    }),
    /401/,
  );
  const [trace] = loadTrace(id, 0);
  assert.match(trace.error, /scripted: OpenAI API 401/);
  assert.equal(trace.choice, "");
  assert.equal(loadDuel(id).responses.length, 0, "nothing was played");
});

test("playSeat waits for the other seat rather than moving for it", async () => {
  const id = "loop-wait";
  freshDuel(id);
  await playChoice(id, 0, "random");                       // P0 opens
  const view = await viewDuel(loadDuel(id), 1);
  const stop = new AbortController();
  const run = playSeat({
    duelId: id, seat: view.pendingPlayer === 1 ? 1 : 0, provider: scripted(['{"choice":"1","reason":"go"}']),
    model: "scripted-1", apiKey: "not-a-real-key", playerGuide: TINY_GUIDE, pollMs: 10, signal: stop.signal, maxMoves: 1,
  });
  const result = await run;
  assert.equal(result.moves, 1);
  stop.abort();
});

test("an already-aborted signal stops the loop before any call is made", async () => {
  const id = "loop-abort";
  freshDuel(id);
  const stop = new AbortController();
  stop.abort();
  const result = await playSeat({
    duelId: id, seat: 0, provider: scripted(['{"choice":"1"}']), model: "scripted-1",
    apiKey: "not-a-real-key", playerGuide: TINY_GUIDE, signal: stop.signal, pollMs: 10,
  });
  assert.deepEqual({ reason: result.reason, moves: result.moves }, { reason: "aborted", moves: 0 });
  assert.equal(loadDuel(id).responses.length, 0);
});

// ---------------------------------------------------------------- live

test(
  "live: OpenAI plays the opening moves of a fresh duel against a random opponent",
  { skip: process.env.OPENAI_API_KEY ? false : "set OPENAI_API_KEY (set -a; . ./.env.local; set +a)" },
  async () => {
    const id = "live-openai";
    freshDuel(id, 20260817);
    const stop = new AbortController();
    const opponent = randomOpponent(id, 1, stop.signal);

    const result = await playSeat({
      duelId: id, seat: 0, provider: openai,
      // The cheapest reasoning model the key can reach ($0.05/$0.40 per MTok),
      // at the lowest effort it accepts — this test is about wiring, not play.
      model: "gpt-5-nano", options: { effort: "minimal", summary: "off" },
      apiKey: process.env.OPENAI_API_KEY, playerGuide: PLAYER_GUIDE, maxMoves: 3, pollMs: 200,
    });
    stop.abort();
    await opponent;

    assert.equal(result.moves, 3);
    const traces = loadTrace(id, 0);
    assert.equal(traces.length, 3);
    for (const trace of traces) {
      assert.equal(trace.provider, "openai");
      assert.equal(trace.model, "gpt-5-nano");
      assert.equal(trace.error, null, `move ${trace.move}: ${trace.error}`);
      assert.equal(trace.retries, 0, "the enum should make an off-menu answer impossible");
      assert.ok(trace.usage.in > 0 && trace.usage.out > 0, "token counts came back");
      assert.ok(trace.latencyMs > 0);
      assert.ok(trace.chosenLabel.length, "the choice resolved to a real option");
      // Compared, never printed: a failure message must not leak what it found.
      assert.ok(!JSON.stringify(trace).includes(process.env.OPENAI_API_KEY), "the API key is nowhere in the trace");
    }
    assert.equal(new Set(traces.map((t) => t.system)).size, 1, "one frozen prefix for the whole duel");
    console.log(traces.map(summarizeTrace).join("\n"));
    console.log(traces.map((t) => `move ${t.move}: ${t.response}`).join("\n"));
  },
);

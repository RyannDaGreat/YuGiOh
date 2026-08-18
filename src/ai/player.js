/**
 * The loop: an LLM sits one seat of a duel and plays it to the end.
 *
 * ==========================================================================
 * WHAT THIS IS ALLOWED TO SEE.
 * ==========================================================================
 * Everything here goes through `viewDuel(duel, seat)` — the same masked view a
 * human at that seat gets. The duel record is never read directly, the seed is
 * never replayed, and the other seat is never viewed. That is the honour
 * boundary PLAYER.md states, enforced structurally here rather than trusted:
 * there is no code path in this file that can produce the opponent's hand.
 *
 * Chat is not read at all (see context.js).
 *
 * ==========================================================================
 * WHAT HAPPENS WHEN THE MODEL IS WRONG.
 * ==========================================================================
 * Three tiers, none of them silent:
 *
 * 1. **Unreadable or illegal answer** — re-ask ONCE, quoting the exact error
 *    back to the model. Cheap, and usually enough.
 * 2. **Still wrong** — play a uniformly random LEGAL move (`randomChoice`), so
 *    the duel does not stall, and record the failure in the trace's `error`
 *    with `retries`. A duel where an LLM fell back is visibly a duel where an
 *    LLM fell back.
 * 3. **Provider/transport failure** (401, 429, network) — write a trace with the
 *    error and RE-THROW. That is not a bad move, it is a broken setup, and
 *    playing a random move to paper over an unpaid API key would be worse than
 *    stopping.
 *
 * The API key is a parameter of every call and is never held anywhere: not in
 * the strategy, not in the trace, not in a module-level variable.
 */

import { chooseFromMenu } from "../menu.js";
import { loadDuel } from "../store.js";
import { menuSummary, playChoice, viewDuel } from "../session.js";
import { replyToChat } from "./chat.js";
import { makeStrategy } from "./context.js";
import { answerInstruction, defaultModel, defaultOptions, getProvider, legalChoices, parseDecision } from "./provider.js";
import { appendTrace, traceRecord } from "./trace.js";

/** One re-ask after a rejected answer, then the random fallback. A model that
 * cannot name a listed option twice in a row will not manage it on the third try,
 * and every attempt is a paid call. */
const MAX_ATTEMPTS = 2;

/** How often the loop re-checks a duel while waiting for the other seat. Matches
 * the CLI's `wait` poll: fast enough to feel live, slow enough to be free. */
const POLL_MS = 1000;

/**
 * Command. Plays one decision for a seat: builds the prompt, asks the model,
 * validates the answer, records the move, and writes a trace.
 *
 * Assumes it IS this seat's decision — `playSeat` checks. Calling it otherwise
 * fails loudly in `playChoice`.
 *
 * Args:
 *     opts.duelId (string)
 *     opts.seat (0|1)
 *     opts.view (object): The viewDuel result this decision is made on.
 *     opts.provider (MoveProvider): Already resolved.
 *     opts.model (string)
 *     opts.apiKey (string): Passed to the provider, stored nowhere.
 *     opts.options (object): Provider-native options.
 *     opts.system (string): The frozen prefix, built once per duel.
 *     opts.strategy (ContextStrategy): This seat's context strategy; mutated
 *         (its log cursor, and its transcript if it keeps one).
 *     opts.signal (AbortSignal|undefined)
 *     opts.now (string): ISO timestamp for the move and the trace.
 *     opts.chat (boolean): Answer table talk between decisions (default true).
 *     opts.traceDir (string|undefined): Traces directory; tests pass a temp one.
 *
 * Returns:
 *     Promise<object>: The trace record that was appended.
 *
 * Throws:
 *     Error: on a provider/transport failure (after writing a trace for it), or
 *     if the menu is missing (not this seat's decision).
 *
 * Examples:
 *     >>> const trace = await playMove({duelId: "duel1", seat: 1, view, provider: openai,
 *     ...   model: "gpt-5-nano", apiKey, options: {effort: "minimal"}, system, strategy,
 *     ...   now: new Date().toISOString()})
 *     >>> trace.chosenLabel   // "Normal Summon Vorse Raider"
 */
export async function playMove({ duelId, seat, view, provider, model, apiKey, options, system, strategy, signal, now, traceDir }) {
  if (!view.menu) throw new Error(`no menu for P${seat} in duel ${duelId} — it is P${view.pendingPlayer}'s decision`);
  const choices = legalChoices(menuSummary(view.menu));
  const move = view.at;

  let sent = strategy.messages(view);
  let answer = null;
  let last = { text: null, reasoning: null, usage: {}, latencyMs: null };
  let error = null;
  let retries = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && !answer; attempt++) {
    let response;
    try {
      response = await provider.chooseMove({ apiKey, model, system, messages: sent, choices, options, cacheKey: `${duelId}:${seat}`, signal });
    } catch (cause) {
      // Not a bad move — a broken connection or credential. Leave a trace so the
      // failure is visible in the duel's LLM log, then let it propagate.
      appendTrace(duelId, seat, traceRecord({
        move, at: now, seat, provider: provider.id, model, options, system, messages: sent,
        response: null, reasoning: null, usage: {}, latencyMs: null,
        choice: "", chosenLabel: "", retries, error: `${provider.id}: ${cause.message}`,
      }), traceDir);
      throw cause;
    }
    last = response;
    try {
      const decision = parseDecision(response.text, choices);
      // The engine, not the schema, is the authority on what is legal here.
      chooseFromMenu(view.menu, decision.choice);
      answer = decision;
    } catch (rejected) {
      // An expected condition: models do occasionally answer off-menu. Reported
      // in the trace either way, and re-asked with the exact complaint.
      retries += 1;
      error = rejected.message;
      // Only extend the conversation if there is another attempt to send it on;
      // otherwise `sent` would end on a complaint nobody was ever asked to answer.
      if (attempt + 1 < MAX_ATTEMPTS) {
        sent = [
          ...sent,
          { role: "assistant", content: response.text },
          { role: "user", content: `That answer was rejected: ${rejected.message}\n${answerInstruction(choices)}` },
        ];
      }
    }
  }

  const choice = answer ? answer.choice : "random";
  if (!answer) error = `${error} — after ${retries} attempt(s), played a random legal move instead`;
  const played = await playChoice(duelId, seat, choice, now);

  const record = traceRecord({
    move, at: now, seat, provider: provider.id, model, options, system,
    // The messages of the FINAL attempt: what actually produced the played move.
    // `retries` says how many earlier attempts there were.
    messages: sent,
    response: last.text,
    reasoning: last.reasoning ?? answer?.reason ?? null,
    usage: last.usage,
    latencyMs: last.latencyMs,
    choice, chosenLabel: played.chosenLabel, retries, error,
  });
  appendTrace(duelId, seat, record, traceDir);
  strategy.record({ view, messages: sent, text: answer ? last.text : null });
  return record;
}

/**
 * Command. Plays a seat until the duel ends, the move budget runs out, or the
 * caller aborts. Waits (polling) while it is the other seat's turn, so this can
 * run against a human, another model, or the CLI on the other side.
 *
 * Works wherever a volume is installed (volume.js): Node with real files, or a
 * browser holding the duel in OPFS. No filesystem call is made here directly and
 * PLAYER.md is passed IN as text, because a browser cannot read it off disk.
 *
 * Args:
 *     opts.duelId (string)
 *     opts.seat (0|1)
 *     opts.provider (MoveProvider|string): A provider, or a registered id.
 *     opts.model (string|undefined): Defaults to the catalog's default model.
 *     opts.apiKey (string): Never stored.
 *     opts.options (object|undefined): Provider-native options; missing keys
 *         fall back to the catalog defaults.
 *     opts.playerGuide (string): PLAYER.md, read by the caller.
 *     opts.brief (string): Optional extra strategy brief.
 *     opts.strategy (ContextStrategy|string|undefined): Defaults to "state-only".
 *     opts.onTrace (function|undefined): Called with each trace record as it is
 *         written — a UI's "watch it think" hook.
 *     opts.signal (AbortSignal|undefined): Stops the loop; also aborts the
 *         in-flight provider request.
 *     opts.maxMoves (number|undefined): Stop after this many of THIS seat's moves.
 *     opts.pollMs (number): How often to re-check while waiting.
 *     opts.traceDir (string|undefined): Traces directory; tests pass a temp one.
 *
 * Returns:
 *     Promise<{reason: "ended"|"aborted"|"max-moves", moves: number, traces: object[], winner: number|null}>
 *
 * Throws:
 *     Error: on a provider/transport failure, or anything the engine rejects.
 *     Never on a bad model answer — see the module docstring.
 *
 * Examples:
 *     >>> await playSeat({duelId: "duel1", seat: 1, provider: "openai", apiKey,
 *     ...   playerGuide, maxMoves: 3})
 *     {reason: "max-moves", moves: 3, traces: [{move: 1, …}, …], winner: null}
 */
export async function playSeat({ duelId, seat, provider, model, apiKey, options, playerGuide, brief = "", strategy, onTrace, signal, maxMoves, pollMs = POLL_MS, traceDir, chat = true }) {
  const chosen = typeof provider === "string" ? getProvider(provider) : provider;
  const usedModel = model ?? defaultModel(chosen);
  const usedOptions = { ...defaultOptions(chosen), ...options };
  const plan = typeof strategy === "string" || strategy === undefined ? makeStrategy(strategy) : strategy;

  const duel = loadDuel(duelId);
  // Built ONCE and reused verbatim: byte-identical prefixes are what provider
  // prompt caches key on (context.js).
  const system = plan.system({ duelId, seat, players: duel.players, decks: duel.decks, format: duel.format ?? "classic", playerGuide, brief });

  const traces = [];
  // Table talk is answered between decisions, never inside one: a separate request
  // (chat.js) that the move prompt never sees. `seenChat` advances past whatever was
  // considered, so each message is answered at most once.
  let seenChat = new Date().toISOString();
  const answerChat = async () => {
    if (!chat) return;
    const r = await replyToChat({ duelId, seat, provider: chosen, model: usedModel, apiKey, options: usedOptions, system, since: seenChat, signal, traceDir });
    seenChat = r.seenUpTo;
    if (r.posted !== null) onTrace?.({ move: null, at: seenChat, seat, chosenLabel: `chat: ${r.posted}` });
  };
  for (;;) {
    if (signal?.aborted) return { reason: "aborted", moves: traces.length, traces, winner: null };
    const view = await viewDuel(loadDuel(duelId), seat);
    if (view.ended) return { reason: "ended", moves: traces.length, traces, winner: view.winner };
    await answerChat();
    if (view.pendingPlayer !== seat) {
      await sleep(pollMs, signal);
      continue;
    }
    const record = await playMove({ duelId, seat, view, provider: chosen, model: usedModel, apiKey, options: usedOptions, system, strategy: plan, signal, now: new Date().toISOString(), traceDir });
    traces.push(record);
    onTrace?.(record);
    if (maxMoves !== undefined && traces.length >= maxMoves) return { reason: "max-moves", moves: traces.length, traces, winner: null };
  }
}

/**
 * Command. Waits `ms`, or returns early when `signal` aborts. Uses only globals
 * that exist in Node and in browsers, so the loop needs no host-specific timer.
 *
 * Args:
 *     ms (number): Delay.
 *     signal (AbortSignal|undefined): Cuts the wait short when aborted.
 *
 * Returns:
 *     Promise<void>
 *
 * Examples:
 *     >>> await sleep(1000)                       // resolves after ~1s
 *     >>> await sleep(60000, alreadyAbortedSignal) // resolves immediately
 */
function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
}

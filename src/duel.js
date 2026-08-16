/**
 * Duel engine wrapper over ocgcore-wasm.
 *
 * ARCHITECTURE — replay, not persistence:
 * A duel is fully described by `{seed, decks, responses}`. The engine lives in
 * WASM memory and cannot be serialised, so instead of keeping a daemon alive we
 * rebuild the duel from scratch on every command and re-apply the recorded
 * responses. A full duel replays in milliseconds.
 *
 * Three things fall out of this for free, all of which we want:
 *   - Reproducibility: a seed plus a response list is the whole game. Two agent
 *     strategies can be compared on identical shuffles.
 *   - Time travel: truncate the response list to rewind to any earlier decision.
 *   - No daemon: the CLI is stateless, so subagents can each drive their own
 *     duels concurrently without coordinating over a socket.
 */

import createCore, { OcgDuelMode, OcgLocation, OcgMessageType, OcgPosition, OcgProcessResult, OcgResponseType } from "ocgcore-wasm";
import { cardReader, scriptReader, codeOf } from "./cards.js";
import { shuffled, subSeed } from "./rng.js";

/** Standard modern-format duel parameters. */
export const STARTING_LP = 8000;
export const STARTING_HAND = 5;
export const DRAW_PER_TURN = 1;

/**
 * Shared Lua library the core does NOT load on its own. Must be preloaded, in
 * this order, before any card is added — otherwise every card script fails at
 * `GetID` and the duel silently plays with effect-less cards.
 */
const PRELUDE_SCRIPTS = ["constant.lua", "utility.lua"];

/** Guard against a bug spinning the process machine forever. */
const MAX_PROCESS_STEPS = 100000;

/**
 * Pure function. Expands a `[name, count]` decklist into a flat passcode array.
 *
 * Args:
 *     entries (Array<[string, number]>): Card name and copy count pairs.
 *
 * Returns:
 *     number[]: One passcode per physical copy, in list order.
 *
 * Examples:
 *     >>> expandDeck([["Pot of Greed", 2]])                  // [55144522, 55144522]
 *     >>> expandDeck([["Pot of Greed", 1], ["Fissure", 1]])  // [55144522, 66788016]
 */
export function expandDeck(entries) {
  return entries.flatMap(([name, count]) => Array(count).fill(codeOf(name)));
}

/**
 * Command. Builds a duel, plays back the recorded responses, and returns the
 * live engine handle plus everything observed along the way.
 *
 * Mutates nothing outside the freshly created WASM duel instance it returns.
 * The caller owns the handle and must call `core.destroyDuel` when finished.
 *
 * Args:
 *     spec (object): The duel description.
 *     spec.seed (number): 32-bit seed driving both deck shuffles.
 *     spec.decks (Array<Array<[string, number]>>): Decklist per player, [p0, p1].
 *     spec.responses (Array): Recorded OcgResponse objects, applied in order.
 *
 * Returns:
 *     Promise<object>: `{core, handle, messages, pending, ended, applied}` where
 *     `messages` is every message emitted across the whole replay, `pending` is
 *     the message awaiting a response (null if the duel ended), `ended` is true
 *     once a winner was declared or the core reported END, and `applied` counts
 *     recorded responses consumed.
 *
 * Throws:
 *     Error: if the core rejects a recorded response (MSG_RETRY). A rejected
 *     response is a harness bug or a corrupted duel file, never something to
 *     skip over quietly.
 *
 * Examples:
 *     >>> // (await replayDuel({seed: 1, decks: [d, d], responses: []})).pending.type
 *     >>> // 11   — MSG_SELECT_IDLECMD, the first real decision of the game
 */
export async function replayDuel({ seed, decks, responses }) {
  const core = await createCore({ sync: true });
  const errors = [];
  const handle = core.createDuel({
    flags: OcgDuelMode.MODE_MR5,
    seed: [BigInt(subSeed(seed, "core0")), BigInt(subSeed(seed, "core1")), BigInt(subSeed(seed, "core2")), BigInt(subSeed(seed, "core3"))],
    team1: { startingLP: STARTING_LP, startingDrawCount: STARTING_HAND, drawCountPerTurn: DRAW_PER_TURN },
    team2: { startingLP: STARTING_LP, startingDrawCount: STARTING_HAND, drawCountPerTurn: DRAW_PER_TURN },
    cardReader,
    scriptReader,
    errorHandler: (type, text) => errors.push({ type, text }),
  });
  if (!handle) throw new Error("OCG_CreateDuel failed");

  for (const name of PRELUDE_SCRIPTS) {
    const source = scriptReader(name);
    if (source === null) throw new Error(`missing required Lua library: ${name}`);
    if (!core.loadScript(handle, name, source)) throw new Error(`failed to load ${name}`);
  }

  // We shuffle rather than letting the core do it; see src/rng.js for why.
  for (const player of [0, 1]) {
    const deck = shuffled(expandDeck(decks[player]), subSeed(seed, `deck${player}`));
    for (const code of deck) {
      core.duelNewCard(handle, {
        team: player,
        duelist: 0,
        code,
        controller: player,
        location: OcgLocation.DECK,
        sequence: 0,
        position: OcgPosition.FACEDOWN_DEFENSE,
      });
    }
  }
  core.startDuel(handle);

  // A card whose script failed to load plays as an effect-less vanilla, which is
  // a silent rules violation. Loading errors are fatal, never logged-and-ignored.
  if (errors.length > 0) {
    throw new Error(`card script errors while building the duel:\n${formatCoreErrors(errors)}`);
  }

  const messages = [];
  let applied = 0;
  for (let step = 0; step < MAX_PROCESS_STEPS; step++) {
    const status = core.duelProcess(handle);
    messages.push(...core.duelGetMessage(handle));
    if (errors.length > 0) {
      throw new Error(`card script errors during play:\n${formatCoreErrors(errors)}`);
    }
    // The core keeps its state machine running after declaring a winner (it
    // will happily ask the loser for their next move). The real server treats
    // MSG_WIN as terminal, and so do we.
    if (status === OcgProcessResult.END || messages.some((m) => m.type === OcgMessageType.WIN)) {
      return { core, handle, messages, pending: null, ended: true, applied };
    }
    if (status === OcgProcessResult.CONTINUE) continue;

    // AWAITING: the last message is the question the core wants answered.
    const pending = messages[messages.length - 1];
    if (pending.type === OcgMessageType.RETRY) {
      throw new Error(`core rejected recorded response #${applied - 1}: ${JSON.stringify(responses[applied - 1])}`);
    }
    const auto = autoResponse(pending);
    if (auto !== null) {
      core.duelSetResponse(handle, auto);
      continue;
    }
    if (applied >= responses.length) {
      return { core, handle, messages, pending, ended: false, applied };
    }
    core.duelSetResponse(handle, responses[applied]);
    applied++;
  }
  throw new Error(`duel did not settle within ${MAX_PROCESS_STEPS} process steps`);
}

/**
 * Pure function. Answers questions that have exactly one sensible answer, so
 * they never reach a player and never need recording.
 *
 * Today that is only "do you want to chain?" when there is nothing that could
 * be chained (the core asks both players at every timing window regardless).
 * EDOPro's client auto-declines these too. Because this is deterministic, a
 * replay with the same recorded responses always takes the same path.
 *
 * Args:
 *     msg (OcgMessage): The pending question.
 *
 * Returns:
 *     OcgResponse|null: A response to submit silently, or null to ask a player.
 *
 * Examples:
 *     >>> autoResponse({type: 16, forced: false, selects: [], spe_count: 0})  // {type: 8, index: null}
 *     >>> autoResponse({type: 16, forced: false, selects: [{...}], spe_count: 0}) // null
 *     >>> autoResponse({type: 11, summons: []})                              // null
 */
export function autoResponse(msg) {
  if (msg.type === OcgMessageType.SELECT_CHAIN && !msg.forced && msg.selects.length === 0 && msg.spe_count === 0) {
    return { type: OcgResponseType.SELECT_CHAIN, index: null };
  }
  return null;
}

/**
 * Pure function. Renders core error records as one line each.
 *
 * Args:
 *     errors (Array<{type: number, text: string}>): Records from the core's errorHandler.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> formatCoreErrors([{type: 0, text: "bad script"}]) // "  [0] bad script"
 */
function formatCoreErrors(errors) {
  return errors.map(({ type, text }) => `  [${type}] ${text}`).join("\n");
}

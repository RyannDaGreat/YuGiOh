/**
 * What an LLM seat is actually shown each decision — and what it is not.
 *
 * ==========================================================================
 * WHY THE DEFAULT IS STATE-ONLY.
 * ==========================================================================
 * A duel is 150-400 decisions. The obvious design — append every turn to a
 * growing conversation — eventually needs compaction, and compaction is both
 * expensive and lossy. This game does not need it, for a reason specific to
 * this engine rather than a general belief that "state is enough":
 *
 * - `state.js` re-prints the WHOLE board every turn, per viewer, and `field.js`
 *   remembers identities this seat has legitimately learned (a face-down that
 *   was revealed earlier still shows by name). Hidden-card memory therefore
 *   lives in the ENGINE, not in the transcript — a seat that discards its whole
 *   history loses none of it.
 * - Both graveyards, both decklists and the "unseen pool" arithmetic are
 *   recomputed from scratch each turn for the same reason.
 *
 * So the only thing a transcript uniquely holds is the seat's own intent ("why
 * I set that card"). `StateOnlyStrategy` keeps the log delta since this seat's
 * last decision, which recovers enough of that to explain a play and to notice
 * an unexpected board — at a per-turn cost that is FLAT in move number. It
 * structurally cannot run out of context.
 *
 * `FullHistoryStrategy` is kept for debugging and short matches, where reading
 * the model's exact prior turns matters more than the token bill.
 *
 * ==========================================================================
 * THE FROZEN PREFIX.
 * ==========================================================================
 * The system prefix — player guide, deck manual, strategy brief, both
 * decklists with card text (~9k tokens) — is byte-identical for the entire
 * duel and is built ONCE (player.js calls `system()` before the loop). That is
 * what makes provider prompt caching work: Anthropic marks it with a cache
 * breakpoint, OpenAI and Gemini match it implicitly. Cached input is ~10% of
 * the price and, on Anthropic, does not count against the rate limit at all.
 * Never interpolate anything that changes per turn into it.
 *
 * ==========================================================================
 * CHAT IS NOT HERE, ON PURPOSE.
 * ==========================================================================
 * Table talk never enters the move loop. Chat is untrusted speech from the
 * opponent or a spectator (chat.js, PLAYER.md "## Chat"); the cheapest possible
 * guarantee that it cannot steer a move is that the move-choosing prompt has
 * never seen it. A separate reply path can read chat later; this one may not.
 */

import { deckReference } from "../session.js";
import { answerInstruction, legalChoices } from "./provider.js";

/**
 * Pure function. The frozen system prefix: everything about this duel that does
 * not change while it is played.
 *
 * The player guide is included verbatim rather than paraphrased, so the honour
 * boundary and the chat rules have exactly one source (PLAYER.md). It is written
 * for a seat driving the CLI, so a short preamble explains that the harness runs
 * those commands and this seat only picks options — the rules it states apply
 * unchanged either way.
 *
 * Args:
 *     facts.duelId (string)
 *     facts.seat (0|1)
 *     facts.players ([string, string]): Seat labels from the duel record.
 *     facts.decks (Array<{name, manual, codes, extraCodes}>): The record's frozen decks.
 *     facts.format ("classic"|"goat")
 *     facts.playerGuide (string): PLAYER.md, read by the caller (Node reads the
 *         file; the browser bundles or fetches it — this module never does I/O).
 *     facts.brief (string): Optional extra strategy brief; "" for none.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> frozenSystem({duelId: "duel1", seat: 1, players: ["ryan", "claude"], format: "classic",
 *     ...   decks: [yugiDeck, kaibaDeck], playerGuide: "# How to play a seat…", brief: ""})
 *     "# Yu-Gi-Oh! duel duel1 — you are P1 (claude), playing Kaiba\n…"
 */
export function frozenSystem({ duelId, seat, players, decks, format, playerGuide, brief = "" }) {
  const deckSection = (deck, p) => {
    const block = [`## P${p} decklist — ${deck.name} (${deck.codes.length} cards)`, ...deckReference(deck)];
    if (deck.extraCodes?.length) block.push(`### Extra Deck (${deck.extraCodes.length})`, ...deckReference({ codes: deck.extraCodes }));
    return block;
  };
  const mine = decks[seat];
  return [
    `# Yu-Gi-Oh! duel ${duelId} — you are P${seat} (${players[seat]}), playing ${mine.name}`,
    "",
    `P0 (${players[0]}, ${decks[0].name}) took turn 1.${format === "goat" ? " Format: GOAT." : ""} Both decklists are public knowledge.`,
    "You play this seat through an API, not the command line. The harness below runs every",
    "command for you and shows you the result; your whole move is picking one option from the",
    "menu it prints. Everything the guide says about honesty, hidden information and chat",
    "applies to you unchanged.",
    "",
    "## Player guide",
    playerGuide,
    "",
    `## Your deck: ${mine.name} — how to pilot it`,
    mine.manual || "(this deck has no manual; play it on general principles)",
    ...(brief ? ["", "## Strategy brief (from the person who sat you down)", brief] : []),
    "",
    ...deckSection(decks[0], 0),
    "",
    ...deckSection(decks[1], 1),
  ].join("\n");
}

/**
 * Pure function. One turn's volatile block: what happened since this seat last
 * moved, the board now, the menu, and how to answer.
 *
 * `fromLine` is this seat's own log cursor, so the first decision of a session
 * (cursor 0) shows the whole log — which is exactly right when a fresh process
 * picks up a duel in progress.
 *
 * Args:
 *     view (object): A viewDuel result for this seat.
 *     fromLine (number): Index into `view.logLines` to start from.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> turnBlock({logLines: ["== Turn 3 (P1) ==", "P1 draws 1 card"], stateLines: ["P0 LP 8000"],
 *     ...   menuLines: ["Main Phase 1", "  1. End turn"], menu: {mode: "one", items: ["End turn"], zero: null}}, 1)
 *     "## Since your last decision\nP1 draws 1 card\n\n## Board now\nP0 LP 8000\n\n## Your options\nMain Phase 1\n  1. End turn\n\nAnswer with JSON {\"choice\": \"<one of: 1>\", \"reason\": \"<one sentence>\"}."
 */
export function turnBlock(view, fromLine) {
  const fresh = view.logLines.slice(fromLine);
  const heading = fromLine === 0 ? "## Log so far (your view)" : "## Since your last decision";
  return [
    heading,
    ...(fresh.length ? fresh : ["(nothing new)"]),
    "",
    "## Board now",
    ...view.stateLines,
    "",
    "## Your options",
    ...view.menuLines,
    "",
    answerInstruction(legalChoices(view.menu)),
  ].join("\n");
}

/**
 * How a seat's prompt is assembled each turn. Subclasses differ only in how much
 * of the past they carry; the frozen prefix and the turn block are shared, so a
 * new strategy is a few lines rather than a second prompt format.
 *
 * One instance per seat per duel. It holds a log cursor (and, for full history,
 * the transcript), so it must not be shared between seats.
 */
export class ContextStrategy {
  /**
   * Command. Creates a strategy. Subclasses pass their identity.
   *
   * Args:
   *     id (string): Registry key, e.g. "state-only".
   *     label (string): Display name.
   */
  constructor(id, label) {
    this.id = id;
    this.label = label;
    /** How many of this seat's log lines it has already been shown. */
    this.logCursor = 0;
  }

  /**
   * Pure function (given its arguments; holds no state). The frozen system
   * prefix. Call once per duel and reuse the string, so it is byte-identical
   * and provider caches hit.
   *
   * Args:
   *     facts (object): See frozenSystem.
   *
   * Returns:
   *     string
   *
   * Examples:
   *     >>> new StateOnlyStrategy().system(facts).startsWith("# Yu-Gi-Oh! duel")   // true
   */
  system(facts) {
    return frozenSystem(facts);
  }

  /**
   * Query. The messages to send for this decision. Overridden by subclasses.
   *
   * Args:
   *     view (object): A viewDuel result for this seat.
   *
   * Returns:
   *     Array<{role: "user"|"assistant", content: string}>
   */
  messages(view) {
    throw new Error(`${this.constructor.name} must implement messages()`);
  }

  /**
   * Command. Called after the model answered and the move was played. Advances
   * the log cursor; subclasses that keep a transcript extend it here.
   *
   * Args:
   *     outcome.view (object): The view the decision was made on.
   *     outcome.messages (Array): Exactly what was sent.
   *     outcome.text (string): The model's raw answer.
   */
  record({ view }) {
    this.logCursor = view.logLines.length;
  }
}

/**
 * The default. Each turn is one self-contained user message: the log delta, the
 * board, the menu. Nothing accumulates, so cost per turn is flat in move number
 * and the context cannot fill up — see the module docstring for why that loses
 * nothing here.
 */
export class StateOnlyStrategy extends ContextStrategy {
  /** Command. Creates the state-only strategy. */
  constructor() {
    super("state-only", "State only (flat cost, recommended)");
  }

  /**
   * Query. One user message holding this turn's block.
   *
   * Args:
   *     view (object): A viewDuel result for this seat.
   *
   * Returns:
   *     Array<{role: "user", content: string}>: Always length 1.
   *
   * Examples:
   *     >>> new StateOnlyStrategy().messages(view)
   *     [{role: "user", content: "## Since your last decision\n…"}]
   */
  messages(view) {
    return [{ role: "user", content: turnBlock(view, this.logCursor) }];
  }
}

/**
 * The debugging baseline: every prior turn block and every prior answer stay in
 * the conversation. Reproduces "what did it actually see" exactly, at a cost
 * that grows with the duel — and, because trace.js stores the messages of every
 * move, at a trace file that grows quadratically. Fine for a short match or a
 * bug hunt; not the default.
 */
export class FullHistoryStrategy extends ContextStrategy {
  /** Command. Creates the full-history strategy. */
  constructor() {
    super("full-history", "Full history (debugging)");
    /** Every message sent and received so far this session. */
    this.history = [];
  }

  /**
   * Query. The whole conversation so far plus this turn's block.
   *
   * Args:
   *     view (object): A viewDuel result for this seat.
   *
   * Returns:
   *     Array<{role: "user"|"assistant", content: string}>
   *
   * Examples:
   *     >>> const s = new FullHistoryStrategy()
   *     >>> const first = s.messages(view)          // length 1
   *     >>> s.record({view, messages: first, text: '{"choice":"1"}'})
   *     >>> s.messages(nextView).length             // 3: user, assistant, user
   */
  messages(view) {
    return [...this.history, { role: "user", content: turnBlock(view, this.logCursor) }];
  }

  /**
   * Command. Advances the log cursor and appends this exchange to the transcript.
   *
   * A null `text` means the model never produced a usable answer and a random
   * legal move was played instead (player.js). That turn is dropped from the
   * transcript rather than recorded: there is no assistant message to record,
   * and leaving the user block unanswered would break the strict user/assistant
   * alternation some providers require.
   *
   * Args:
   *     outcome.view (object): The view the decision was made on.
   *     outcome.messages (Array): Exactly what was sent.
   *     outcome.text (string|null): The model's raw answer, or null if it failed.
   */
  record({ view, messages, text }) {
    super.record({ view });
    if (text === null) return;
    this.history = [...messages, { role: "assistant", content: text }];
  }
}

/** Every strategy, by id — so a UI or a CLI flag can pick one by name. */
export const STRATEGIES = { "state-only": StateOnlyStrategy, "full-history": FullHistoryStrategy };

/** The strategy used when a caller does not choose. See the module docstring. */
export const DEFAULT_STRATEGY = "state-only";

/**
 * Command. Builds a fresh strategy instance by id.
 *
 * Args:
 *     id (string): A key of STRATEGIES; defaults to DEFAULT_STRATEGY.
 *
 * Returns:
 *     ContextStrategy
 *
 * Throws:
 *     Error: on an unknown id, rather than silently playing with the default.
 *
 * Examples:
 *     >>> makeStrategy().id             // "state-only"
 *     >>> makeStrategy("full-history").label   // "Full history (debugging)"
 */
export function makeStrategy(id = DEFAULT_STRATEGY) {
  const Strategy = STRATEGIES[id];
  if (!Strategy) throw new Error(`unknown context strategy ${JSON.stringify(id)} (have: ${Object.keys(STRATEGIES).join(", ")})`);
  return new Strategy();
}

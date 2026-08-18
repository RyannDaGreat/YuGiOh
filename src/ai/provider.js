/**
 * The LLM-provider interface: one seat's decision, decided by some model.
 *
 * ==========================================================================
 * ONE INTERFACE, MANY MODELS — AND NO SDKs.
 * ==========================================================================
 * A provider is a thin object with `chooseMove()`. It receives a frozen system
 * prefix plus the turn's messages, and returns the model's raw answer text.
 * It does NOT know about duels, menus, or the engine: it is an HTTP call and
 * a normalised reply. Everything game-shaped lives in `player.js`.
 *
 * Every adapter is written on plain `fetch`. The official SDKs all ship a
 * "dangerouslyAllowBrowser" guard that a static page has to switch off anyway,
 * and the only thing that flag actually adds on the wire is one Anthropic
 * header (`anthropic-dangerous-direct-browser-access`) which we send ourselves.
 * So the SDKs would be pure bundle weight. `fetch` exists in Node 18+ and in
 * every browser; nothing under `src/ai/` imports `node:*`.
 *
 * ==========================================================================
 * THE CHOICE CONTRACT.
 * ==========================================================================
 * The engine enumerates only legal answers (menu.js), so a model's entire
 * decision surface is "which numbered option". That is small enough to CONSTRAIN
 * rather than parse: for the common single-pick menu we hand the provider the
 * exact list of legal choice strings and use the provider's own structured-output
 * mechanism (OpenAI `text.format` json_schema, Gemini `responseSchema`,
 * Anthropic forced tool use) with that list as a JSON-Schema `enum`. The model
 * then cannot name an option that does not exist.
 *
 * Menus that are not single-pick (multi-select, ordering, counters, declare-a-
 * card-by-name) have a combinatorial answer space, so no enum can express them.
 * There `legalChoices` returns null, the schema takes a free string, and the
 * answer is validated by `chooseFromMenu` before anything is recorded — an
 * invalid answer is rejected and re-asked, never played.
 */

/** How many output tokens one move decision may cost. Thinking/reasoning tokens
 * count toward this on every provider, so it must leave room for them; a move is
 * a menu index, so the visible answer itself is a few dozen tokens. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/** Largest output budget a truncation retry will ask for; above this the model
 * is not converging and more room will not help. */
export const MAX_OUTPUT_TOKENS_CEILING = 32768;

/** How much bigger each truncation retry's budget is. */
const OUTPUT_BUDGET_GROWTH = 4;

/** Longest `reason` we ask a model to write: enough to explain a play in the
 * trace panel, short enough that it never becomes the bulk of the response. */
export const MAX_REASON_CHARS = 300;

/**
 * @typedef {Object} MoveRequest
 * @property {string} apiKey     - The caller's key. NEVER stored, logged, or traced.
 * @property {string} model      - Provider-native model id (see PROVIDER_CATALOG).
 * @property {string} system     - Frozen system prefix; byte-identical all duel long
 *                                 so provider prompt caches hit (context.js).
 * @property {Array<{role: "user"|"assistant", content: string}>} messages
 * @property {string[]|null} choices - Legal choice strings, or null when the menu
 *                                 is not enumerable (see legalChoices).
 * @property {object} options    - Provider-native options, keys as named in
 *                                 PROVIDER_CATALOG[id].options (e.g. {effort: "low"}).
 * @property {string} [cacheKey] - Stable per-seat string, for providers that take
 *                                 an explicit prompt-cache key.
 * @property {AbortSignal} [signal]
 * @property {number} [maxOutputTokens]
 */

/**
 * @typedef {Object} MoveResponse
 * @property {string} text       - The model's answer, verbatim (usually JSON).
 * @property {boolean} truncated - True when the model ran out of OUTPUT budget
 *                                 mid-answer, so `text` is a fragment (a JSON
 *                                 answer cut mid-string). Adapters retry once
 *                                 with a bigger budget first; this stays true
 *                                 only when even the ceiling was not enough, and
 *                                 exists so a caller never mistakes a fragment
 *                                 for an answer.
 * @property {string|null} reasoning - Thinking/reasoning SUMMARY if the provider
 *                                 returned one. No provider returns raw chain of
 *                                 thought; null when none was requested or given.
 * @property {{in: number|null, out: number|null, reasoning: number|null}} usage
 * @property {object} raw        - The parsed provider response, for live debugging.
 *                                 Never persisted (trace.js drops it) — it is large,
 *                                 provider-shaped, and duplicates every field above.
 * @property {number} latencyMs
 */

/**
 * @typedef {Object} MoveProvider
 * @property {string} id
 * @property {string} label
 * @property {() => Array<{id: string, label: string, default?: boolean}>} listModels
 * @property {(request: MoveRequest) => Promise<MoveResponse>} chooseMove
 * @property {Array<{name, label, values, default}>} [options] - This provider's
 *     own thinking/reasoning knobs, as in PROVIDER_CATALOG. A provider without
 *     any (a local engine, a test double) simply omits it.
 */

/**
 * Every provider this build can talk to, as DATA: models and the provider's own
 * thinking/reasoning knobs, so a settings UI can render dropdowns without a
 * single provider-specific branch.
 *
 * Option names are each provider's NATIVE parameter name, deliberately not
 * unified. The three "effort" dials look alike and are not: OpenAI's
 * `reasoning.effort` and Gemini's `thinkingLevel` scope to reasoning, while
 * Anthropic's `output_config.effort` governs ALL output tokens (text and tool
 * calls too) and is separate from whether thinking is on at all. Collapsing them
 * into one enum would be a lossy fiction; showing each provider's real knob is
 * honest and costs the UI nothing, since it reads this table.
 *
 * Facts here (endpoints, ids, parameter names and values) come from live-fetched
 * vendor documentation recorded in `.frenzy/01..03` and, for OpenAI, from a live
 * `GET /v1/models` against this repo's key. Do not edit from memory.
 */
export const PROVIDER_CATALOG = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    keyEnv: "ANTHROPIC_API_KEY",
    keyHint: "sk-ant-…",
    docs: "https://platform.claude.com/docs/en/api/overview",
    /** `adaptive`: takes `thinking: {type: "adaptive"}` and `output_config.effort`.
     *  Models without it (Haiku 4.5) only support the deprecated `budget_tokens`
     *  form, which we do not send — they simply answer without thinking. */
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", adaptive: true, default: true },
      { id: "claude-opus-5", label: "Claude Opus 5", adaptive: true },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", adaptive: false },
    ],
    options: [
      {
        name: "thinking",
        label: "Thinking",
        values: ["adaptive", "off"],
        default: "adaptive",
        note: "Adaptive thinking; 'off' sends thinking:{type:\"disabled\"}. Ignored on models without adaptive thinking.",
      },
      {
        name: "effort",
        label: "Effort",
        values: ["low", "medium", "high", "xhigh", "max"],
        default: "low",
        note: "output_config.effort — affects ALL output tokens, not only thinking. 'off' thinking is rejected at xhigh/max on Opus 5.",
      },
    ],
  },

  openai: {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/responses",
    keyEnv: "OPENAI_API_KEY",
    keyHint: "sk-…",
    docs: "https://developers.openai.com/api/docs/guides/reasoning",
    models: [
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", default: true },
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna (cheap)" },
      { id: "gpt-5-mini", label: "GPT-5 mini" },
      { id: "gpt-5-nano", label: "GPT-5 nano (cheapest)" },
    ],
    options: [
      {
        name: "effort",
        label: "Reasoning effort",
        values: ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
        default: "low",
        note: "reasoning.effort on the Responses API. Not every model accepts every value; 'none'/'minimal' are the latency picks.",
      },
      {
        name: "summary",
        label: "Reasoning summary",
        values: ["off", "auto", "concise", "detailed"],
        default: "auto",
        note: "reasoning.summary — a readable summary for the trace panel. Never the raw chain of thought. Not sent at effort 'none'.",
      },
    ],
  },

  gemini: {
    id: "gemini",
    label: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    keyEnv: "GEMINI_API_KEY",
    keyHint: "AIza…",
    docs: "https://ai.google.dev/gemini-api/docs/thinking",
    /** `levels` narrows the provider-wide list where a model rejects a value:
     *  gemini-3.7-flash returns an error for "minimal". */
    models: [
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", levels: ["low", "medium", "high"], default: true },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", levels: ["low", "medium", "high"] },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", levels: ["low", "medium", "high"] },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", levels: ["low", "medium", "high"] },
    ],
    options: [
      {
        name: "thinkingLevel",
        label: "Thinking level",
        values: ["minimal", "low", "medium", "high"],
        default: "low",
        note: "generationConfig.thinkingConfig.thinkingLevel. Per-model support varies — see each model's `levels`.",
      },
      {
        name: "includeThoughts",
        label: "Thought summaries",
        values: [true, false],
        default: true,
        note: "generationConfig.thinkingConfig.includeThoughts — returns readable thought summaries for the trace panel.",
      },
    ],
  },
};

/** Every registered provider, by id. Adapters register themselves on import. */
export const providers = new Map();

/**
 * Command. Adds a provider to the registry, so a UI can go from a dropdown id
 * to something that can play. Re-registering the same id replaces it (a build
 * that imports an adapter twice must not end up with two).
 *
 * Args:
 *     provider (MoveProvider): Must have `id`, `label`, `listModels`, `chooseMove`.
 *
 * Returns:
 *     MoveProvider: The same object, so an adapter can `export default registerProvider({...})`.
 *
 * Examples:
 *     >>> registerProvider({id: "echo", label: "Echo", listModels: () => [], chooseMove: async () => ({})})
 *     >>> providers.get("echo").label   // "Echo"
 */
export function registerProvider(provider) {
  for (const field of ["id", "label", "listModels", "chooseMove"]) {
    if (!provider?.[field]) throw new Error(`provider is missing "${field}"`);
  }
  providers.set(provider.id, provider);
  return provider;
}

/**
 * Query. The registered provider with this id.
 *
 * Args:
 *     id (string): e.g. "openai".
 *
 * Returns:
 *     MoveProvider
 *
 * Throws:
 *     Error: when nothing is registered under that id — which almost always
 *     means the adapter module was never imported.
 *
 * Examples:
 *     >>> getProvider("openai").label      // "OpenAI"
 *     >>> // getProvider("nope") throws: unknown provider "nope" (registered: openai)
 */
export function getProvider(id) {
  const provider = providers.get(id);
  if (!provider) throw new Error(`unknown provider ${JSON.stringify(id)} (registered: ${[...providers.keys()].join(", ") || "none"}) — import src/ai/${id}.js to register it`);
  return provider;
}

/**
 * Pure function. A provider's default model id — the one a UI preselects and the
 * one `playSeat` uses when the caller names none.
 *
 * Reads the provider's own model list rather than the catalog by id, so a
 * provider that is not in the catalog (a local engine, a test double) works
 * without a special case.
 *
 * Args:
 *     provider (MoveProvider)
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> defaultModel(getProvider("openai"))     // "gpt-5.6-terra"
 *     >>> defaultModel(getProvider("anthropic"))  // "claude-sonnet-5"
 */
export function defaultModel(provider) {
  const models = provider.listModels();
  if (!models.length) throw new Error(`provider ${JSON.stringify(provider.id)} lists no models`);
  return (models.find((m) => m.default) ?? models[0]).id;
}

/**
 * Pure function. Every option's default, as the options object a caller can pass
 * straight to `chooseMove` — so "just play" needs no knowledge of the provider.
 *
 * Args:
 *     provider (MoveProvider)
 *
 * Returns:
 *     object: {optionName: defaultValue}; {} for a provider with no options.
 *
 * Examples:
 *     >>> defaultOptions(getProvider("openai"))   // {effort: "low", summary: "auto"}
 *     >>> defaultOptions(getProvider("gemini"))   // {thinkingLevel: "low", includeThoughts: true}
 */
export function defaultOptions(provider) {
  return Object.fromEntries((provider.options ?? []).map((o) => [o.name, o.default]));
}

/**
 * Pure function. The complete list of choice strings a single-pick menu accepts,
 * or null when the menu's answers cannot be enumerated.
 *
 * Only `mode: "one"` menus are enumerable: exactly one option, so the answer set
 * is "1".."N" plus "0" when the menu offers a pass/cancel. Multi-select ("many"),
 * ordering ("order"), counter splits ("counters") and card-name declarations
 * ("name") each have a combinatorial or open answer space; those get null, and
 * the caller must validate with `chooseFromMenu` instead of constraining.
 *
 * Args:
 *     menu ({mode, items, zero}|null): A menuSummary (session.js) or a raw Menu.
 *
 * Returns:
 *     string[]|null
 *
 * Examples:
 *     >>> legalChoices({mode: "one", items: ["Yes", "No"], zero: null})
 *     ["1", "2"]
 *     >>> legalChoices({mode: "one", items: ["Activate Trap Hole"], zero: "Do not activate"})
 *     ["1", "0"]
 *     >>> legalChoices({mode: "many", items: ["a", "b"], zero: null})   // null
 *     >>> legalChoices(null)                                            // null
 */
export function legalChoices(menu) {
  if (!menu || menu.mode !== "one") return null;
  const picks = menu.items.map((_, i) => `${i + 1}`);
  return menu.zero ? [...picks, "0"] : picks;
}

/**
 * Pure function. The JSON Schema a model must answer with: the chosen option and
 * a one-line reason. When `choices` is given, `choice` is an enum and the answer
 * is structurally guaranteed to name a real option.
 *
 * The reason is required rather than optional because a "why" that only appears
 * sometimes is worse than useless in a trace: you cannot tell a silent model from
 * a model that had no reason.
 *
 * Args:
 *     choices (string[]|null): Legal choice strings, or null for a free-form answer.
 *
 * Returns:
 *     object: JSON Schema for {choice, reason}.
 *
 * Examples:
 *     >>> decisionSchema(["1", "2"]).properties.choice
 *     {type: "string", enum: ["1", "2"], description: "The option you pick."}
 *     >>> decisionSchema(null).properties.choice.enum   // undefined
 */
export function decisionSchema(choices) {
  const choice = choices
    ? { type: "string", enum: choices, description: "The option you pick." }
    : { type: "string", description: "Your answer in the menu's choice syntax, e.g. \"3\", \"1,4\", \"0\", \"name:Dark Hole\"." };
  return {
    type: "object",
    properties: { choice, reason: { type: "string", description: `Why, in one sentence (max ${MAX_REASON_CHARS} chars).` } },
    required: ["choice", "reason"],
    additionalProperties: false,
  };
}

/**
 * Pure function. The line of prompt telling the model how to answer, matching
 * the schema it is being constrained by. Kept beside `decisionSchema` so the two
 * can never drift: the words and the schema describe one contract.
 *
 * Args:
 *     choices (string[]|null): From legalChoices.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> answerInstruction(["1", "2", "0"])
 *     'Answer with JSON {"choice": "<one of: 1, 2, 0>", "reason": "<one sentence>"}.'
 *     >>> answerInstruction(null)
 *     'Answer with JSON {"choice": "<menu choice: \"3\", or \"1,4\" for several, or \"0\" to pass, or \"name:Card Name\">", "reason": "<one sentence>"}.'
 */
export function answerInstruction(choices) {
  const choice = choices
    ? `<one of: ${choices.join(", ")}>`
    : '<menu choice: "3", or "1,4" for several, or "0" to pass, or "name:Card Name">';
  return `Answer with JSON {"choice": "${choice}", "reason": "<one sentence>"}.`;
}

/** A menu answer's syntax (menu.js): "3", "1,4", "0", "3:2,5:1", "name:Dark Hole". */
const CHOICE_SYNTAX = /^(?:\d+(?:\s*,\s*\d+)*|\d+:\d+(?:\s*,\s*\d+:\d+)*|name:.+)$/;

/**
 * Pure function. Reads a model's answer into {choice, reason}.
 *
 * Accepts, in order: the JSON object it was asked for; that JSON inside a
 * markdown fence (some models wrap it despite the schema); or a bare choice
 * string ("3") for the free-form case. Anything else throws — a move is never
 * guessed at from prose, because a wrong guess is a real move in a real duel.
 *
 * `choices`, when given, is enforced here as well as in the request schema:
 * structured output is a provider promise, and a promise is not a check.
 *
 * Args:
 *     text (string): The model's raw answer.
 *     choices (string[]|null): Legal choice strings, or null to skip the membership check.
 *
 * Returns:
 *     {choice: string, reason: string|null}
 *
 * Throws:
 *     Error: on unreadable text, or a choice outside `choices`.
 *
 * Examples:
 *     >>> parseDecision('{"choice": "2", "reason": "Vorse Raider out-bodies it."}', ["1", "2"])
 *     {choice: "2", reason: "Vorse Raider out-bodies it."}
 *     >>> parseDecision('```json\n{"choice":"1","reason":"only play"}\n```', null)
 *     {choice: "1", reason: "only play"}
 *     >>> parseDecision("1,4", null)
 *     {choice: "1,4", reason: null}
 *     >>> // parseDecision("I think option 7", ["1"]) throws: could not read a choice
 *     >>> // parseDecision('{"choice": "9"}', ["1", "2"]) throws: chose "9", which is not an option
 */
export function parseDecision(text, choices) {
  const trimmed = String(text ?? "").trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const decision = readJsonDecision(unfenced) ?? (CHOICE_SYNTAX.test(unfenced) ? { choice: unfenced, reason: null } : null);
  if (!decision) throw new Error(`could not read a choice from the model's answer: ${JSON.stringify(trimmed.slice(0, 200))}`);
  // "1, 4" and "1,4" are the same pick, so spaces go — except inside a declared
  // card name, where they are part of the name ("name:Dark Hole").
  const trimmedChoice = decision.choice.trim();
  const choice = trimmedChoice.startsWith("name:") ? trimmedChoice : trimmedChoice.replace(/\s+/g, "");
  if (choices && !choices.includes(choice)) throw new Error(`the model chose ${JSON.stringify(choice)}, which is not an option (legal: ${choices.join(", ")})`);
  return { choice, reason: decision.reason };
}

/**
 * Pure function. `{choice, reason}` out of a JSON object, or null if the text is
 * not JSON carrying a choice. Separated from parseDecision only to keep that
 * function's fallback chain readable.
 *
 * Args:
 *     text (string): Candidate JSON.
 *
 * Returns:
 *     {choice: string, reason: string|null}|null
 *
 * Examples:
 *     >>> readJsonDecision('{"choice": 3}')            // {choice: "3", reason: null}
 *     >>> readJsonDecision('{"choice": "0", "reason": "nothing worth it"}')
 *     {choice: "0", reason: "nothing worth it"}
 *     >>> readJsonDecision("not json")                 // null
 */
function readJsonDecision(text) {
  if (!text.startsWith("{")) return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON at all — the caller's next fallback handles it, and reports
    // loudly if that fails too. Nothing is swallowed: a bad answer never plays.
    return null;
  }
  if (parsed?.choice === undefined || parsed.choice === null) return null;
  return { choice: String(parsed.choice), reason: parsed.reason === undefined ? null : String(parsed.reason) };
}

/**
 * Command. POSTs JSON and returns the parsed reply, failing loudly on anything
 * that is not a 2xx — with the provider's own error body in the message, which
 * is the difference between "OpenAI request failed" and "your key is invalid".
 *
 * Args:
 *     opts.url (string)
 *     opts.headers (object): Request headers, including the caller's credential.
 *     opts.body (object): Serialised as JSON.
 *     opts.label (string): Provider name, for error messages.
 *     opts.signal (AbortSignal|undefined)
 *
 * Returns:
 *     Promise<{json: object, latencyMs: number}>
 *
 * Throws:
 *     Error: on a non-2xx status (message carries status + response body) or on
 *     a reply that is not JSON.
 *
 * Examples:
 *     >>> await postJson({url, headers, body: {model: "gpt-5-nano"}, label: "OpenAI"})
 *     {json: {id: "resp_…", output: [...]}, latencyMs: 1672}
 */
export async function postJson({ url, headers, body, label, signal }) {
  const started = Date.now();
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  const latencyMs = Date.now() - started;
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} API ${res.status}: ${text.slice(0, 600)}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    // A 2xx that is not JSON means the contract is broken (a proxy, a captive
    // portal, an HTML error page). Re-thrown with the body so it is diagnosable.
    throw new Error(`${label} returned a ${res.status} that is not JSON: ${text.slice(0, 300)}`, { cause });
  }
  return { json, latencyMs };
}

/**
 * Pure function. Normalises a provider's token counts to the trace's three
 * fields, tolerating absent ones (not every provider reports reasoning tokens,
 * and none reports them when reasoning is off).
 *
 * Args:
 *     counts.in (number|undefined): Input/prompt tokens.
 *     counts.out (number|undefined): Output/completion tokens.
 *     counts.reasoning (number|undefined): Thinking/reasoning tokens, billed as output.
 *
 * Returns:
 *     {in: number|null, out: number|null, reasoning: number|null}
 *
 * Examples:
 *     >>> usageOf({in: 5310, out: 412, reasoning: 260})
 *     {in: 5310, out: 412, reasoning: 260}
 *     >>> usageOf({in: 77, out: 13})
 *     {in: 77, out: 13, reasoning: null}
 */
export function usageOf(counts) {
  const num = (v) => (typeof v === "number" ? v : null);
  return { in: num(counts.in), out: num(counts.out), reasoning: num(counts.reasoning) };
}

/**
 * Pure function. The budget to retry a truncated answer with, or null once the
 * ceiling has been reached.
 *
 * Every provider hits the same wall — a reasoning model can spend the whole
 * OUTPUT budget thinking and then emit its answer into whatever is left, so the
 * answer arrives cut off (or not at all). The cure is identical everywhere: ask
 * again with far more room. Only the field that reports it differs (OpenAI
 * `status: "incomplete"`, Anthropic `stop_reason: "max_tokens"`, Gemini
 * `finishReason: "MAX_TOKENS"`), so only the DETECTION lives in the adapters.
 *
 * Args:
 *     current (number): The budget that was not enough.
 *
 * Returns:
 *     number|null
 *
 * Examples:
 *     >>> nextOutputBudget(512)     // 2048
 *     >>> nextOutputBudget(8192)    // 32768
 *     >>> nextOutputBudget(16384)   // 32768   (clamped to the ceiling)
 *     >>> nextOutputBudget(32768)   // null    (already there — stop retrying)
 */
export function nextOutputBudget(current) {
  if (current >= MAX_OUTPUT_TOKENS_CEILING) return null;
  return Math.min(current * OUTPUT_BUDGET_GROWTH, MAX_OUTPUT_TOKENS_CEILING);
}

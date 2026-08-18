/**
 * Anthropic adapter — `POST https://api.anthropic.com/v1/messages`.
 *
 * UNTESTED against the live API: no Anthropic key exists in this environment.
 * Every field below comes from documentation fetched live in `.frenzy/01` and
 * `.frenzy/10`, including one finding that is not in the docs at all and that
 * this file depends on:
 *
 * **`anthropic-dangerous-direct-browser-access: true` is required for CORS.**
 * The OPTIONS preflight succeeds without it, but the ACTUAL response then carries
 * no `Access-Control-Allow-Origin`, so browser JS cannot read it — the request
 * goes through and the answer is thrown away, which reads as a mysterious CORS
 * error rather than an HTTP failure. We send the header unconditionally: it is
 * inert from Node, and forgetting it in the browser build would be a bug that
 * only appears in production.
 *
 * Structured output: Anthropic has no JSON-schema response format, so the strict
 * choice is forced through a tool — `tool_choice: {type: "tool", name: …}` with
 * the choice enum in the tool's `input_schema`. Forcing a tool is incompatible
 * with the deprecated manual thinking (`budget_tokens`) but IS supported with
 * adaptive thinking, which is the only thinking mode this adapter sends.
 */

import { DEFAULT_MAX_OUTPUT_TOKENS, PROVIDER_CATALOG, decisionSchema, postJson, registerProvider, usageOf } from "./provider.js";

const CATALOG = PROVIDER_CATALOG.anthropic;
/** The API version header Anthropic requires on every request. */
const API_VERSION = "2023-06-01";
/** Name of the forced tool. Arbitrary, but it appears in the model's view of the task. */
const TOOL_NAME = "choose_move";

/**
 * Command. Asks a Claude model for one move. Untested (no key available here);
 * the request shape is documentation-derived, see the module docstring.
 *
 * The system prefix is sent as a cached content block: it holds PLAYER.md, the
 * deck manual and both decklists, it is byte-identical for the whole duel, and
 * a cache read is 0.1x input price and does not count against the ITPM rate
 * limit. That is the single biggest cost lever in a long duel.
 *
 * Args:
 *     request (MoveRequest): See provider.js. `options.thinking` is "adaptive"
 *         or "off"; `options.effort` is `output_config.effort` — note this is
 *         NOT a thinking parameter, it governs all output tokens. Both are
 *         ignored on models without adaptive thinking (catalog `adaptive: false`),
 *         which take only the deprecated `budget_tokens` form we never send.
 *
 * Returns:
 *     Promise<MoveResponse>
 *
 * Throws:
 *     Error: on any non-2xx (message carries Anthropic's error body), or when
 *     the forced tool call is absent from the reply.
 *
 * Examples:
 *     >>> await chooseMove({apiKey, model: "claude-sonnet-5", system: "You are P1…",
 *     ...   messages: [{role: "user", content: "## Your options\n1. Attack\n2. End turn"}],
 *     ...   choices: ["1", "2"], options: {thinking: "adaptive", effort: "low"}})
 *     {text: '{"choice":"1","reason":"Vorse Raider out-bodies their set monster."}',
 *      reasoning: "Their only monster is 1400 DEF…", usage: {in: 5310, out: 412, reasoning: 260},
 *      raw: {…}, latencyMs: 4120}
 */
async function chooseMove({ apiKey, model, system, messages, choices, options = {}, signal, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS }) {
  const adaptive = CATALOG.models.find((m) => m.id === model)?.adaptive ?? true;
  const thinkingOn = adaptive && (options.thinking ?? "adaptive") !== "off";
  const body = {
    model,
    max_tokens: maxOutputTokens,
    // A cache breakpoint on the frozen prefix: every later turn of the duel
    // reads it instead of re-paying for it.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [{ name: TOOL_NAME, description: "Play one option from the menu you were shown.", input_schema: decisionSchema(choices) }],
    tool_choice: { type: "tool", name: TOOL_NAME },
    // "summarized" is what makes a readable thinking summary come back at all:
    // current models default to "omitted", which returns an empty thinking block.
    ...(thinkingOn ? { thinking: { type: "adaptive", display: "summarized" } } : {}),
    ...(adaptive && !thinkingOn ? { thinking: { type: "disabled" } } : {}),
    ...(adaptive && options.effort ? { output_config: { effort: options.effort } } : {}),
  };

  const { json, latencyMs } = await postJson({
    url: CATALOG.endpoint,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body,
    label: "Anthropic",
    signal,
  });

  const call = (json.content ?? []).find((block) => block.type === "tool_use" && block.name === TOOL_NAME);
  if (!call) throw new Error(`Anthropic returned no ${TOOL_NAME} tool call (stop_reason ${json.stop_reason}); content types: ${(json.content ?? []).map((b) => b.type).join(", ") || "none"}`);
  return {
    text: JSON.stringify(call.input),
    reasoning: thinkingText(json),
    usage: usageOf({ in: json.usage?.input_tokens, out: json.usage?.output_tokens, reasoning: json.usage?.output_tokens_details?.thinking_tokens }),
    raw: json,
    latencyMs,
  };
}

/**
 * Pure function. The thinking summary out of a Messages reply, or null when the
 * model returned none (thinking off, or `display: "omitted"`).
 *
 * Args:
 *     json (object): A parsed /v1/messages body.
 *
 * Returns:
 *     string|null
 *
 * Examples:
 *     >>> thinkingText({content: [{type: "thinking", thinking: "Their set card could be Waboku."},
 *     ...   {type: "tool_use", input: {choice: "1"}}]})
 *     "Their set card could be Waboku."
 *     >>> thinkingText({content: [{type: "tool_use", input: {choice: "1"}}]})   // null
 */
function thinkingText(json) {
  const parts = (json.content ?? []).filter((b) => b.type === "thinking").map((b) => b.thinking ?? "").filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

/**
 * Query. The Claude models this app offers, from PROVIDER_CATALOG.
 *
 * Static rather than a live `GET /v1/models` call, for the same reason as the
 * OpenAI adapter: a settings dropdown must render before a key exists.
 *
 * Returns:
 *     Array<{id: string, label: string, adaptive: boolean}>
 *
 * Examples:
 *     >>> listModels()[0]   // {id: "claude-sonnet-5", label: "Claude Sonnet 5", adaptive: true, default: true}
 */
function listModels() {
  return CATALOG.models;
}

/** The Anthropic provider. Registered on import, so `getProvider("anthropic")` works. */
/**
 * Command. Checks a key with GET /v1/models — the browser header is required
 * here exactly as it is for messages, or the response is unreadable cross-origin.
 *
 * Args:
 *     apiKey (string): The key to test.
 *
 * Returns:
 *     Promise<{ok: boolean, detail: string}>
 *
 * Examples:
 *     >>> // await verifyKey("sk-ant-…")   // {ok: true, detail: "9 models visible"}
 */
async function verifyKey(apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: { "x-api-key": apiKey, "anthropic-version": API_VERSION, "anthropic-dangerous-direct-browser-access": "true" },
  });
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
  const body = await res.json();
  return { ok: true, detail: `${body.data?.length ?? "?"} models visible` };
}

export const anthropic = registerProvider({ id: CATALOG.id, label: CATALOG.label, listModels, chooseMove, verifyKey, options: CATALOG.options });
export default anthropic;

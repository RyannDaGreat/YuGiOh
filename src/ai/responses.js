/**
 * The Responses-API provider implementation, shared by every vendor that
 * speaks it (OpenAI, and DeepSeek since V4 — verified live against both: same
 * request body, same typed-output payload, same incomplete/max_output_tokens
 * truncation shape). One implementation, N catalog bindings: openai.js and
 * deepseek.js are one call each.
 *
 * The catalog entry supplies `endpoint` (POST …/responses), `modelsEndpoint`
 * (GET, the cheapest authenticated call — verifyKey uses it), `models` and
 * `options`. Everything else — strict json_schema enum output, reasoning
 * effort/summary, the truncation retry, usage accounting — is identical.
 */

import { DEFAULT_MAX_OUTPUT_TOKENS, decisionSchema, nextOutputBudget, postJson, registerProvider, usageOf } from "./provider.js";

/**
 * Command. Builds and REGISTERS a Responses-API provider for one catalog entry
 * (registerProvider self-registers; importing the binding module is enough).
 *
 * Args:
 *     catalog (object): A PROVIDER_CATALOG entry with `endpoint` and `modelsEndpoint`.
 *
 * Returns:
 *     object: The registered provider.
 *
 * Examples:
 *     >>> // responsesProvider(PROVIDER_CATALOG.openai).id   // "openai"
 */
export function responsesProvider(catalog) {
  /**
   * Command. Asks a model for one move. Sends the whole request over
   * `fetch`; the key is used as a header and never stored anywhere.
   *
   * Args:
   *     request (MoveRequest): See provider.js. `options.effort` is
   *         `reasoning.effort`; `options.summary` is `reasoning.summary` ("off"
   *         omits it). Effort "none" suppresses the summary, which the API has
   *         nothing to summarise at that setting.
   *
   * Returns:
   *     Promise<MoveResponse>
   *
   * Throws:
   *     Error: on any non-2xx (message carries OpenAI's own error body), or when
   *     the response contains no assistant message — e.g. a run that hit
   *     `max_output_tokens` while still reasoning, which must not be mistaken for
   *     an empty answer.
   *
   * Examples:
   *     >>> // await chooseMove({apiKey, model: "gpt-5-nano", system: "You are P0…",
   *     ...   messages: [{role: "user", content: "## Your options\n1. End turn"}],
   *     ...   choices: ["1"], options: {effort: "minimal", summary: "off"}})
   *     {text: '{"choice":"1","reason":"Nothing else is legal."}', truncated: false,
   *      reasoning: null, usage: {in: 77, out: 13, reasoning: 0}, raw: {…}, latencyMs: 1672}
   */
  async function chooseMove({ apiKey, model, system, messages, choices, options = {}, cacheKey, signal, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS }) {
    const effort = options.effort ?? "low";
    const summary = options.summary ?? "auto";
    const body = {
      model,
      input: [
        { role: "developer", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      reasoning: { effort, ...(summary !== "off" && effort !== "none" ? { summary } : {}) },
      text: { format: { type: "json_schema", name: "menu_choice", strict: true, schema: decisionSchema(choices) } },
      max_output_tokens: maxOutputTokens,
      ...(cacheKey ? { prompt_cache_key: cacheKey } : {}),
    };

    const { json, latencyMs } = await postJson({
      url: catalog.endpoint,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body,
      label: catalog.label,
      signal,
    });

    const text = messageText(json);
    // A reasoning model can spend the whole output budget thinking, leaving the
    // answer half-written or absent (seen: gpt-5-nano at 8k with nothing at all;
    // gpt-5.6-terra at 512 with JSON cut mid-string). Not a context problem — the
    // input is small — it is the OUTPUT budget, so ask again with far more room.
    //
    // PARTIAL TEXT IS STILL A RETRY. It used to be retried only when NOTHING came
    // back, and the fragment that did come back was handed to the caller as if it
    // were an answer: a truncated `{"choice":"Because Snatch Steal…` was posted
    // verbatim to the table chat. Half a JSON object is not worth less than none;
    // it is worth exactly the same, which is nothing.
    const truncated = json.status === "incomplete" && json.incomplete_details?.reason === "max_output_tokens";
    const retryBudget = truncated ? nextOutputBudget(maxOutputTokens) : null;
    if (retryBudget) return chooseMove({ apiKey, model, system, messages, choices, options, cacheKey, signal, maxOutputTokens: retryBudget });
    if (text === null) throw new Error(`${catalog.label} returned no assistant message (status ${json.status}${json.incomplete_details ? `, incomplete: ${json.incomplete_details.reason}` : ""})`);
    return {
      text,
      // Only reachable at the ceiling: the caller is told the text is a fragment
      // rather than being left to guess (chat.js refuses to post one).
      truncated,
      reasoning: reasoningSummary(json),
      usage: usageOf({ in: json.usage?.input_tokens, out: json.usage?.output_tokens, reasoning: json.usage?.output_tokens_details?.reasoning_tokens }),
      raw: json,
      latencyMs,
    };
  }

  /**
   * Pure function. The assistant's text out of a Responses payload, or null when
   * there is no message item at all.
   *
   * `output` is a list of typed items — reasoning items, message items, tool calls
   * — so the answer is the concatenated text of the message item(s), not
   * `output[0]`, which on a reasoning model is the (empty) reasoning block.
   *
   * Args:
   *     json (object): A parsed /v1/responses body.
   *
   * Returns:
   *     string|null
   *
   * Examples:
   *     >>> messageText({output: [{type: "reasoning", summary: []},
   *     ...   {type: "message", content: [{type: "output_text", text: '{"choice":"1"}'}]}]})
   *     '{"choice":"1"}'
   *     >>> messageText({output: [{type: "reasoning", summary: []}]})   // null
   */
  function messageText(json) {
    const parts = (json.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => (item.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text));
    return parts.length ? parts.join("") : null;
  }

  /**
   * Pure function. The readable reasoning summary, or null when none was returned.
   * OpenAI never exposes the raw chain of thought — `encrypted_content` is opaque
   * and is deliberately ignored here.
   *
   * Args:
   *     json (object): A parsed /v1/responses body.
   *
   * Returns:
   *     string|null
   *
   * Examples:
   *     >>> reasoningSummary({output: [{type: "reasoning", summary: [{type: "summary_text", text: "Their set card is likely Trap Hole."}]}]})
   *     "Their set card is likely Trap Hole."
   *     >>> reasoningSummary({output: [{type: "reasoning", summary: [], encrypted_content: "gAAAA…"}]})   // null
   */
  function reasoningSummary(json) {
    const items = (json.output ?? []).filter((item) => item.type === "reasoning");
    const parts = items
      // OpenAI: human-readable `summary` items (the raw chain of thought stays encrypted).
      // DeepSeek: the reasoning itself, as `content` items of type "reasoning_text".
      .flatMap((item) => [...(item.summary ?? []), ...(item.content ?? []).filter((c) => c.type === "reasoning_text")].map((s) => s.text ?? ""))
      .filter(Boolean);
    return parts.length ? parts.join("\n\n") : null;
  }

  /**
   * Query. The models this app offers for this provider, from its catalog entry.
   *
   * Deliberately the curated list rather than a live `GET /v1/models`: that call
   * needs a key before a UI can draw a dropdown, and returns ~130 ids that are
   * mostly image, audio and embedding models. Every id here was confirmed present
   * in a live `GET /v1/models` for this repo's key.
   *
   * Returns:
   *     Array<{id: string, label: string}>
   *
   * Examples:
   *     >>> listModels()[0]   // {id: "gpt-5.6-terra", label: "GPT-5.6 Terra", default: true}
   */
  function listModels() {
    return catalog.models;
  }


  /**
   * Command. Checks a key against the API with the cheapest authenticated call
   * (GET /v1/models). Never logs the key.
   *
   * Args:
   *     apiKey (string): The key to test.
   *
   * Returns:
   *     Promise<{ok: boolean, detail: string}>
   *
   * Examples:
   *     >>> // await verifyKey("sk-…")   // {ok: true, detail: "126 models visible"}
   */
  async function verifyKey(apiKey) {
    const res = await fetch(catalog.modelsEndpoint, { headers: { authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
    const body = await res.json();
    return { ok: true, detail: `${body.data?.length ?? "?"} models visible` };
  }

    return registerProvider({ id: catalog.id, label: catalog.label, listModels, chooseMove, verifyKey, options: catalog.options });
}

/**
 * Google Gemini adapter — `POST …/v1beta/models/<model>:generateContent`.
 *
 * UNTESTED against the live API: no Gemini key exists in this environment. The
 * request shape comes from documentation and a live CORS probe recorded in
 * `.frenzy/03`, which confirmed that `generativelanguage.googleapis.com`
 * reflects any `Origin` and whitelists `x-goog-api-key` — so a static page can
 * call it with no proxy and no opt-in header (the most permissive of the three).
 *
 * Two Gemini-specific shapes to know:
 *
 * - **The classic `:generateContent` endpoint, not the newer Interactions API.**
 *   Interactions is GA and uses snake_case (`thinking_level`, `response_format`),
 *   but `:generateContent` is the surface that was actually probed live, and it
 *   is the one whose `generationConfig.thinkingConfig` / `responseSchema` field
 *   names are confirmed against the REST reference.
 * - **`responseSchema` is OpenAPI-shaped, not full JSON Schema.** It has no
 *   `additionalProperties`, so `geminiSchema` strips it; sending it is a 400.
 */

import { DEFAULT_MAX_OUTPUT_TOKENS, PROVIDER_CATALOG, decisionSchema, postJson, registerProvider, usageOf } from "./provider.js";

const CATALOG = PROVIDER_CATALOG.gemini;

/**
 * Command. Asks a Gemini model for one move. Untested (no key available here);
 * the request shape is documentation-derived, see the module docstring.
 *
 * Args:
 *     request (MoveRequest): See provider.js. `options.thinkingLevel` is
 *         `generationConfig.thinkingConfig.thinkingLevel` (per-model support
 *         varies — gemini-3.7-flash errors on "minimal"); `options.includeThoughts`
 *         asks for readable thought summaries.
 *
 * Returns:
 *     Promise<MoveResponse>
 *
 * Throws:
 *     Error: on any non-2xx (message carries Google's error body), when the
 *     candidate was blocked (no content), or when it carries no answer text.
 *
 * Examples:
 *     >>> await chooseMove({apiKey, model: "gemini-2.5-flash", system: "You are P0…",
 *     ...   messages: [{role: "user", content: "## Your options\n1. Set a monster"}],
 *     ...   choices: ["1"], options: {thinkingLevel: "low", includeThoughts: true}})
 *     {text: '{"choice":"1","reason":"Their board is bigger; set and pass."}',
 *      reasoning: "Setting keeps the 1400 body safe…", usage: {in: 5310, out: 96, reasoning: 180},
 *      raw: {…}, latencyMs: 2400}
 */
async function chooseMove({ apiKey, model, system, messages, choices, options = {}, signal, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    // Gemini names the assistant role "model", not "assistant".
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      thinkingConfig: {
        thinkingLevel: options.thinkingLevel ?? "low",
        includeThoughts: options.includeThoughts ?? true,
      },
      responseMimeType: "application/json",
      responseSchema: geminiSchema(choices),
      maxOutputTokens,
    },
  };

  const { json, latencyMs } = await postJson({
    url: `${CATALOG.endpoint}/${model}:generateContent`,
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body,
    label: "Gemini",
    signal,
  });

  const candidate = json.candidates?.[0];
  if (!candidate?.content) throw new Error(`Gemini returned no content (finishReason ${candidate?.finishReason ?? "none"}, promptFeedback ${JSON.stringify(json.promptFeedback ?? null)})`);
  const text = partsText(candidate, false);
  if (!text) throw new Error(`Gemini returned no answer text (finishReason ${candidate.finishReason})`);
  const thoughts = partsText(candidate, true);
  return {
    text,
    reasoning: thoughts || null,
    usage: usageOf({ in: json.usageMetadata?.promptTokenCount, out: json.usageMetadata?.candidatesTokenCount, reasoning: json.usageMetadata?.thoughtsTokenCount }),
    raw: json,
    latencyMs,
  };
}

/**
 * Pure function. Gemini's `responseSchema` dialect of the decision schema:
 * OpenAPI-shaped, so `additionalProperties` (JSON Schema only) is dropped.
 *
 * Args:
 *     choices (string[]|null): Legal choice strings, or null for a free answer.
 *
 * Returns:
 *     object: The schema, without `additionalProperties`.
 *
 * Examples:
 *     >>> geminiSchema(["1", "2"]).properties.choice.enum   // ["1", "2"]
 *     >>> "additionalProperties" in geminiSchema(null)       // false
 */
function geminiSchema(choices) {
  const { additionalProperties, ...schema } = decisionSchema(choices);
  return schema;
}

/**
 * Pure function. Concatenates a candidate's text parts, taking either the
 * thought-summary parts or the answer parts. Gemini interleaves both in one
 * `parts` array, distinguished only by a `thought: true` flag — read the wrong
 * ones and the "answer" is the model's musing.
 *
 * Args:
 *     candidate (object): `json.candidates[0]`.
 *     wantThoughts (boolean): true for thought summaries, false for the answer.
 *
 * Returns:
 *     string: Empty when there are no matching parts.
 *
 * Examples:
 *     >>> const c = {content: {parts: [{text: "Set is safer.", thought: true}, {text: '{"choice":"1"}'}]}}
 *     >>> partsText(c, false)   // '{"choice":"1"}'
 *     >>> partsText(c, true)    // "Set is safer."
 */
function partsText(candidate, wantThoughts) {
  return (candidate.content.parts ?? [])
    .filter((p) => Boolean(p.thought) === wantThoughts && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

/**
 * Query. The Gemini models this app offers, from PROVIDER_CATALOG. Each carries
 * its own `levels`, because thinking-level support is genuinely per-model.
 *
 * Returns:
 *     Array<{id: string, label: string, levels: string[]}>
 *
 * Examples:
 *     >>> listModels()[0]   // {id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", levels: ["low", "medium", "high"], default: true}
 */
function listModels() {
  return CATALOG.models;
}

/** The Gemini provider. Registered on import, so `getProvider("gemini")` works. */
/**
 * Command. Checks a key with GET /v1beta/models.
 *
 * Args:
 *     apiKey (string): The key to test.
 *
 * Returns:
 *     Promise<{ok: boolean, detail: string}>
 *
 * Examples:
 *     >>> // await verifyKey("AIza…")   // {ok: true, detail: "50 models visible"}
 */
async function verifyKey(apiKey) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": apiKey } });
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
  const body = await res.json();
  return { ok: true, detail: `${body.models?.length ?? "?"} models visible` };
}

export const gemini = registerProvider({ id: CATALOG.id, label: CATALOG.label, listModels, chooseMove, verifyKey, options: CATALOG.options });
export default gemini;

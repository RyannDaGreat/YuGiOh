/**
 * OpenAI — the Responses API (`POST https://api.openai.com/v1/responses`).
 *
 * Verified live against the real API from this repo (`.frenzy/02`, plus real
 * `GET /v1/models` and `POST /v1/responses` round trips): CORS is open to
 * browser origins with no extra header, the Responses API is the endpoint the
 * reasoning guide itself uses, and a strict `json_schema` response format with
 * an `enum` returns exactly one of the listed choices.
 *
 * Two things are deliberate in the shared implementation (responses.js):
 *
 * - **Responses, not Chat Completions.** OpenAI's reasoning guide: "Reasoning
 *   models work better with the Responses API." The reasoning parameter differs
 *   between the two (`reasoning: {effort}` here, flat `reasoning_effort` there).
 * - **The system prefix is the first `input` item, role "developer"**, rather
 *   than the top-level `instructions` field.
 */

import { PROVIDER_CATALOG } from "./provider.js";
import { responsesProvider } from "./responses.js";

/** The OpenAI provider. Registered on import, so `getProvider("openai")` works. */
export const openai = responsesProvider(PROVIDER_CATALOG.openai);
export default openai;

/**
 * DeepSeek — the same Responses API OpenAI speaks, at DeepSeek's endpoint
 * (`POST https://api.deepseek.com/responses`, since DeepSeek-V4).
 *
 * Verified live with a real key (2026-08-19): `GET /models` lists
 * deepseek-v4-flash and deepseek-v4-pro; the exact request body responses.js
 * sends (developer role, reasoning.effort, strict json_schema enum output,
 * prompt_cache_key) returns the exact payload shape it reads, for every effort
 * value none…max on both models; CORS preflight allows browser origins
 * (checked against https://ryanndagreat.github.io). One DeepSeek difference is
 * handled in the shared reader: reasoning arrives as `content` items of type
 * "reasoning_text" (the actual reasoning) rather than OpenAI's `summary` items.
 */

import { PROVIDER_CATALOG } from "./provider.js";
import { responsesProvider } from "./responses.js";

/** The DeepSeek provider. Registered on import, so `getProvider("deepseek")` works. */
export const deepseek = responsesProvider(PROVIDER_CATALOG.deepseek);
export default deepseek;

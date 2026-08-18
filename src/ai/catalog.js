/**
 * The engine-free half of the AI layer: provider adapters and their catalog.
 *
 * Importing this registers every adapter but pulls in NO engine code, so a UI
 * can render provider/model/option controls and test API keys on any host
 * without bundling ocgcore-wasm. The play loop itself lives behind ./index.js.
 */
import "./anthropic.js";
import "./gemini.js";
import "./openai.js";

export { PROVIDER_CATALOG, defaultModel, defaultOptions, getProvider, providers } from "./provider.js";

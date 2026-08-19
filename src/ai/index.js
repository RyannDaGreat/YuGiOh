/**
 * The AI player layer, as one import. Importing this registers every provider
 * adapter (each self-registers on import) and re-exports what a UI or a script
 * needs: the catalog to render controls from, the registry, and the loop.
 */
import "./anthropic.js";
import "./deepseek.js";
import "./gemini.js";
import "./openai.js";

export { PROVIDER_CATALOG, defaultModel, defaultOptions, getProvider, providers } from "./provider.js";
export { playSeat, playMove } from "./player.js";
export { loadTrace, summarizeTrace, tracePath } from "./trace.js";
export { STRATEGIES, DEFAULT_STRATEGY } from "./context.js";
export { TALK_LEVELS, DEFAULT_TALK } from "./chat.js";

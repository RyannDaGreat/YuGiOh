/**
 * Deck library browser: every built-in deck as a tile (signature art, name,
 * format, counts). Data comes from engine.deckLibrary so this page and the
 * duel engine cannot disagree about what a deck is.
 */
import { deckLibrary } from "$lib/server/engine.js";

export function load() {
  return { library: deckLibrary() };
}

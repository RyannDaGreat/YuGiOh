/**
 * Static-host boot: installs the browser volume and card source before the
 * engine is touched. Node never runs this — hooks.server.js does the equivalent
 * with real files. Runs once per page load; every call after the first returns
 * the same promise, so concurrent loads never double-install.
 */
import { base } from "$app/paths";
import { STATIC } from "./host.js";

let booted = null;

/**
 * Command. Ensures the in-browser engine has storage and card data. No-op on
 * the Node host. Idempotent.
 *
 * Returns:
 *     Promise<{volume: string, cards: number, seededDecks: number}|null>: what
 *     was installed, or null on the Node host.
 *
 * Examples:
 *     >>> // await boot()   // {volume: "opfs", cards: 584, seededDecks: 40}   (first visit)
 *     >>> // await boot()   // {volume: "opfs", cards: 584, seededDecks: 0}    (decks already there)
 */
export function boot() {
  if (!STATIC) return Promise.resolve(null);
  if (!booted) {
    booted = (async () => {
      const [{ openBrowserVolume }, { openBrowserCardSource }] = await Promise.all([
        import("../../../src/volume-browser.js"),
        import("../../../src/cardsource-browser.js"),
      ]);
      const [vol, cards] = await Promise.all([openBrowserVolume(), openBrowserCardSource(`${base}/carddata`)]);
      // A fresh browser has an empty volume, so the built-in decks are seeded from
      // the same archive format `ygo export` writes. replace=false: they appear once,
      // and anything the user has since edited or added is left alone.
      const seed = await (await fetch(`${base}/carddata/decks-seed.json`)).json();
      const { importArchive } = await import("../../../src/archive.js");
      const { written } = importArchive(seed, false);
      return { volume: vol.backend, cards: cards.cards ?? cards, seededDecks: written.length };
    })();
  }
  return booted;
}

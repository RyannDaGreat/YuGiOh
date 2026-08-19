/**
 * The browser backing store for `cardsource.js`: the baked bundle under
 * `web/static/carddata/`, fetched over HTTP.
 *
 * A static host has no SQLite and no 250 MB vendor tree, so `bin/bake-carddata.js`
 * reduces both to what the built-in decks actually reference — a few hundred
 * cards as one JSON file, their Lua as loose `.lua` files, and EDOPro's
 * `strings.conf` verbatim. This module is the reader for that bundle.
 *
 * Two details make it work against a synchronous source API:
 *
 *  1. **Fetch once, serve from memory.** The ocgcore WASM core calls
 *     `cardReader`/`scriptReader` synchronously from inside a duel step and
 *     cannot await a `fetch`, so `openBrowserCardSource` pulls the whole bundle
 *     down first (a couple of megabytes) and installs a `memoryCardSource`.
 *     Nothing may start a duel until that promise resolves.
 *  2. **`baseUrl` is not optional.** The site is served from a sub-path on
 *     GitHub Pages (`/YuGiOh/`), so every URL is built from the base the caller
 *     passes — typically SvelteKit's `base` plus `/carddata`. Hardcoding "/"
 *     would 404 in production and only in production.
 *
 * `manifest.json` names every script file the bake emitted (a static host has
 * no directory listing), so exactly those are fetched — shared libraries plus the
 * scripts of cards that have one; vanillas have none and are never requested.
 * The manifest's counts are cross-checked against that list, so a stale bake
 * fails loudly at startup rather than as an inexplicable Lua error mid-duel.
 */

import { packLevel } from "./cards.js";
import { memoryCardSource, patchScript, setCardSource } from "./cardsource.js";

/**
 * The bundle is several hundred small files. Firing them all at once buries the
 * browser's own per-host connection limit under a queue it cannot reorder, and
 * one slow response then blocks the whole boot; a bounded pool keeps the pipe
 * full without that.
 */
const FETCH_CONCURRENCY = 24;
/** Pause before the single retry of a failed bundle fetch. */
const FETCH_RETRY_MS = 400;

/**
 * Command. Fetches one bundle file as text, throwing on anything but a 2xx —
 * every file the manifest names must be there, so a miss is a broken build.
 *
 * Args:
 *     url (string): Absolute or base-relative URL.
 *
 * Returns:
 *     Promise<string>
 *
 * Examples:
 *     >>> // await fetchText("/YuGiOh/carddata/strings.conf")   // "!system 20 Draw Phase\n..."
 */
async function fetchText(url) {
  // One retry: a freshly deployed CDN edge or a dropped connection can fail a single
  // file out of several hundred, and that must not take the whole boot down.
  for (let attempt = 0; ; attempt++) {
    try {
      // Revalidate rather than trust the HTTP cache: a deploy that adds a card
      // must not be undone by a tab holding yesterday's cards.json (GitHub Pages
      // answers 304 with an ETag, so this costs a round trip, not a download).
      const response = await fetch(url, { cache: "no-cache" });
      if (response.ok) return await response.text();
      if (response.status < 500 || attempt) throw new Error(`carddata fetch failed: ${response.status} ${url}`);
    } catch (err) {
      if (attempt) throw err;
    }
    await new Promise((r) => setTimeout(r, FETCH_RETRY_MS));
  }
}

/**
 * Command. Runs `task` over every item with at most `limit` in flight, keeping
 * results in input order.
 *
 * Args:
 *     items (Array): Inputs.
 *     limit (number): Maximum concurrent tasks.
 *     task (function): `(item) => Promise<any>`.
 *
 * Returns:
 *     Promise<Array>: Results, positionally matching `items`.
 *
 * Examples:
 *     >>> // await mapPool([1, 2, 3], 2, async (n) => n * 2)   // [2, 4, 6]
 */
async function mapPool(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Pure function. Converts one baked card record into the merged datas+texts row
 * `cardsource.js` defines.
 *
 * The bake stores Level and both Pendulum Scales as separate fields; cards.cdb
 * packs them into one column and `cards.js` decodes that packing, so they are
 * folded back here rather than teaching the decoder a second layout.
 *
 * Args:
 *     card (object): A `cards.json` entry: {code, name, desc, atk, def, level,
 *         lscale, rscale, type, race, attribute, alias}, optionally `setcode`
 *         and `strings`.
 *
 * Returns:
 *     object: {id, alias, setcode, type, atk, def, level, race, attribute, name,
 *     desc, strings}
 *
 * Examples:
 *     >>> bakedRow({code: 89631139, name: "Blue-Eyes White Dragon", level: 8, lscale: 0, rscale: 0, race: "8192"}).level
 *     8
 *     >>> bakedRow({code: 16178681, name: "Odd-Eyes Pendulum Dragon", level: 7, lscale: 4, rscale: 4}).level
 *     67371015
 */
export function bakedRow(card) {
  return {
    id: card.code,
    alias: card.alias ?? 0,
    setcode: card.setcode ?? 0,
    type: card.type,
    atk: card.atk,
    def: card.def,
    level: packLevel(card.level, card.lscale, card.rscale),
    race: card.race,
    attribute: card.attribute,
    name: card.name,
    desc: card.desc,
    strings: card.strings ?? [],
  };
}

/**
 * Command. Fetches the baked card bundle and installs it as the app's card
 * source. Call once, and await it, before any card is looked up or any duel is
 * created — the core cannot wait for a fetch once a duel is running.
 *
 * Args:
 *     baseUrl (string): URL of the `carddata` directory, with no trailing slash.
 *         Under GitHub Pages this is `${base}/carddata`, not `/carddata`.
 *
 * Returns:
 *     Promise<{cards: number, scripts: number}>: What was loaded, for logging.
 *     `strings.conf` comes down with it and is served by the same source.
 *
 * Throws:
 *     Error: if the bundle is missing, or holds fewer scripts than its own
 *     manifest claims — a silently half-loaded database would surface much later
 *     as an unexplainable duel desync.
 *
 * Examples:
 *     >>> // await openBrowserCardSource("/YuGiOh/carddata")   // {cards: 584, scripts: 530}
 */
export async function openBrowserCardSource(baseUrl, { fallbackUrl = null } = {}) {
  if (!baseUrl) throw new Error("openBrowserCardSource needs the carddata base URL (e.g. `${base}/carddata`)");
  const root = baseUrl.replace(/\/$/, "");
  const fallback = fallbackUrl ? fallbackUrl.replace(/\/$/, "") : null;

  const [manifestText, cardsText, systemStrings, corpusText] = await Promise.all([
    fetchText(`${root}/manifest.json`),
    fetchText(`${root}/cards.json`),
    fetchText(`${root}/strings.conf`),
    fetchText(`${root}/corpus-scripts.json`),
  ]);
  const corpus = new Set(JSON.parse(corpusText));
  const manifest = JSON.parse(manifestText);
  const baked = JSON.parse(cardsText);
  const codes = Object.keys(baked);

  // The manifest names every script file the bake emitted (a static host has no
  // directory listing), so exactly those are fetched: shared libraries and the
  // scripts of cards that have one. Vanillas have none and are never requested.
  const names = manifest.scripts;
  if (!Array.isArray(names) || !names.length) throw new Error("carddata manifest has no `scripts` list — re-run bin/bake-carddata.js");
  const sources = await mapPool(names, FETCH_CONCURRENCY, (name) => fetchText(`${root}/scripts/${name}`));
  // Compatibility patches are applied HERE, at hydration, so every road that
  // serves a pre-fetched script serves the patched text. They used to be applied
  // only on the miss-fetch road below and in memoryCardSource's reader — but
  // completeSource's fast path returns pre-hydrated entries directly, so the
  // static site ran an UNPATCHED chain.lua and Sky Striker Ace - Zeke deadlocked
  // a live game on "Passed invalid CHAININFO flag" (2026-08-19; the same bug the
  // Droll fix addressed, reachable because Node patches on read and the browser
  // did not). patchScript is idempotent, so the re-patch in memoryCardSource is harmless.
  const scripts = Object.fromEntries(names.map((name, i) => [name, patchScript(name, sources[i])]));

  const expected = manifest.sharedScripts + manifest.cardScripts;
  if (names.length !== expected) {
    throw new Error(`carddata is incomplete: manifest lists ${names.length} scripts but counts ${expected}`);
  }
  if (codes.length !== manifest.cards) {
    throw new Error(`carddata is incomplete: cards.json holds ${codes.length} cards, manifest says ${manifest.cards}`);
  }
  if (!codes.some((code) => baked[code].setcode)) {
    console.warn("carddata has no setcodes: archetype checks (IsSetCard) will not match — re-bake with the setcode column");
  }

  const cards = {};
  for (const code of codes) cards[code] = bakedRow(baked[code]);
  setCardSource(fallback ? completeSource(cards, scripts, systemStrings, fallback, corpus) : memoryCardSource(cards, scripts, systemStrings));

  return { cards: codes.length, scripts: names.length, complete: Boolean(fallback) };
}

/**
 * Command. Fetches a URL SYNCHRONOUSLY on the main thread. Deprecated by browsers
 * for good reason, and used here for exactly the one case it exists for: the
 * ocgcore reader callbacks are synchronous WASM->JS calls that cannot await, and
 * a card the core asks for mid-duel that was not prefetched (a token, a card a
 * script names by number) must be answered NOW or the duel dies. It blocks for
 * one round trip, on a rare miss.
 *
 * Args:
 *     url (string): Absolute URL.
 *
 * Returns:
 *     string|null: The body, or null on 404. Throws on any other failure.
 *
 * Examples:
 *     >>> // fetchSync("https://raw.githubusercontent.com/…/assets/scripts/c73915051.lua")   // "--Scapegoat\n…"
 *     >>> // fetchSync(".../scripts/c99999999.lua")   // null
 */
function fetchSync(url) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.send();
  if (xhr.status === 404) return null;
  if (xhr.status < 200 || xhr.status >= 300) throw new Error(`card corpus fetch failed: ${xhr.status} ${url}`);
  return xhr.responseText;
}

/**
 * Command. A card source that can reach EVERY card and script, like Node's:
 * the baked bundle first (resident, fast), then the complete database from the
 * assets branch (fetched in the background right after boot; fetched
 * synchronously the first time something is missing before that lands), then
 * for scripts a synchronous fetch of the one file the core asked for. Misses
 * are remembered as null so nothing is fetched twice.
 *
 * This is what retires "the bundle forgot the token" as a class of bug: the
 * bundle is a cache, and correctness never depends on what it guessed.
 *
 * Args:
 *     cards (object): Baked rows by code (mutated as the full database lands).
 *     scripts (object): Script text by basename (mutated as misses are fetched).
 *     systemStrings (string): strings.conf.
 *     fallback (string): Base URL of the assets branch.
 *     corpus (Set<string>): Every script basename that exists at all, so a
 *         nonexistent one is answered null with no network round trip.
 *
 * Returns:
 *     object: A card source implementing the interface in cardsource.js.
 *
 * Examples:
 *     >>> // completeSource(cards, scripts, conf, "https://raw.githubusercontent.com/RyannDaGreat/YuGiOh/assets").rowById(73915053)
 *     >>> // {id: 73915053, name: "Sheep Token", …}   (fetched, even though no deck lists it)
 */
function completeSource(cards, scripts, systemStrings, fallback, corpus) {
  const rows = new Map(Object.entries(cards).map(([code, row]) => [Number(code), row]));
  let full = null; // the whole database, once it has landed
  const allUrl = `${fallback}/carddata/cards-all.json`;

  const absorb = (text) => {
    full = JSON.parse(text);
    for (const [code, card] of Object.entries(full)) if (!rows.has(Number(code))) rows.set(Number(code), bakedRow(card));
    return full;
  };
  // Background load: by the time a mid-duel token is needed this has usually landed.
  fetch(allUrl, { cache: "no-cache" }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${allUrl}`))))
    .then((text) => { if (!full) absorb(text); })
    .catch((err) => console.warn("full card database did not load in the background; misses will fetch it synchronously:", err.message));

  const row = (code) => {
    const have = rows.get(code);
    if (have) return have;
    if (!full) {
      const text = fetchSync(allUrl);
      if (text) absorb(text);
    }
    return rows.get(code) ?? null;
  };
  const script = (name) => {
    const base = name.split("/").pop();
    if (base in scripts) return scripts[base];
    // Known not to exist anywhere (a vanilla, or a library the core merely probes
    // for): answer null without a round trip. Otherwise fetch that one script
    // now, and remember the answer either way.
    scripts[base] = corpus.has(base) ? patchScript(base, fetchSync(`${fallback}/scripts/${base}`)) : null;
    return scripts[base];
  };

  const memory = memoryCardSource(cards, scripts, systemStrings);
  return {
    ...memory,
    rowById: row,
    textById: row,
    script,
    // Name lookups and listings stay bundle-scoped: they serve decklists and the
    // deck viewer, which only ever name cards the bundle already holds.
  };
}

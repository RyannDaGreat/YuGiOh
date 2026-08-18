/**
 * The card database the engine reads: passcodes, stats, effect text, and Lua.
 *
 * ==========================================================================
 * ONE INTERFACE, TWO HOSTS.
 * ==========================================================================
 * Served from Node, card data comes from the vendored Project Ignis
 * `cards.cdb` — 7.5 MB of SQLite plus 13k Lua scripts, read straight off disk.
 * Served as a static page there is no SQLite, no `node:fs` and no vendor tree,
 * so the same facts arrive pre-baked as JSON and `.lua` files fetched over HTTP
 * (`bin/bake-carddata.js` emits them; `cardsource-browser.js` reads them).
 *
 * This module is the seam: the six lookups `cards.js` actually performs.
 * Swapping the backend is the ONLY difference between the two hosts; every
 * decoder, label table and memo above it is shared verbatim.
 *
 * **Staying synchronous is the whole trick.** The ocgcore WASM core calls
 * `cardReader` and `scriptReader` re-entrantly from inside a duel step and
 * cannot await, so a source must answer immediately. `fetch` cannot, which is
 * why the browser backend loads its whole bundle up front and serves it from
 * memory — see `memoryCardSource` below.
 *
 * ROW SHAPES. Both backends speak `cards.cdb`'s own layout, because that is what
 * the core wants and what `cards.js` already knows how to decode:
 *
 *     datas row: {id, alias, setcode, type, atk, def, level, race, attribute}
 *       setcode  four 16-bit archetype codes packed into one integer
 *       level    level/rank/link rating in the low byte, Pendulum Scales above
 *       race     a DECIMAL STRING — 64-bit in modern cores, so it can exceed 2^53
 *     texts row: {name, desc, strings}
 *       strings  the card's up-to-16 script strings, "" where a slot is empty
 *
 * EDOPro's `strings.conf` rides along here rather than in its own module: it is
 * the other half of the same card knowledge (the core's prompts and effect names
 * resolve against it), it ships from the same vendor tree, and it is baked into
 * the same browser bundle. One seam, not two.
 */

/** Thrown instead of silently pretending an absent database is an empty one. */
const NO_CARD_SOURCE =
  "no card source installed: import cardsource-node.js (Node) or await openBrowserCardSource() first";

/** @type {null | {rowById, textById, idByName, script, search, all, strings}} */
let backend = null;

/**
 * Command. Installs the backing card database. Call exactly once at startup,
 * before any card is read or any duel is created.
 *
 * Args:
 *     src (object): An object providing the seven lookups this module re-exports.
 *
 * Returns:
 *     void
 *
 * Examples:
 *     >>> setCardSource(memoryCardSource({89631139: {id: 89631139, name: "Blue-Eyes White Dragon"}}))
 *     >>> textById(89631139).name   // "Blue-Eyes White Dragon"
 */
export function setCardSource(src) {
  backend = src;
}

/**
 * Query. The installed backend, or throws if there is none.
 *
 * Returns:
 *     object
 *
 * Examples:
 *     >>> setCardSource(memoryCardSource({})); typeof currentCardSource().rowById   // "function"
 */
export function currentCardSource() {
  if (!backend) throw new Error(NO_CARD_SOURCE);
  return backend;
}

/** Query. One card's engine-facing `datas` row, or null when the passcode is unknown. */
export const rowById = (code) => currentCardSource().rowById(code);
/** Query. One card's `texts` row — name, effect text, script strings — or null. */
export const textById = (code) => currentCardSource().textById(code);
/** Query. Passcode for an exact card name, or null. Prefers the canonical printing. */
export const idByName = (name) => currentCardSource().idByName(name);
/** Query. A Lua script's source by file name, e.g. "c89631139.lua", or null. */
export const script = (name) => currentCardSource().script(name);
/** Query. Up to `limit` cards whose name contains `term`, shortest name first. */
export const search = (term, limit) => currentCardSource().search(term, limit);
/** Query. Every card as {code, name, desc}, ordered by name. */
export const all = () => currentCardSource().all();
/** Query. EDOPro's `strings.conf` verbatim, for `strings.js` to parse. */
export const strings = () => currentCardSource().strings();

/**
 * Pure function. An in-memory card source — what the browser installs once its
 * baked bundle has been fetched, and the smallest possible source for a test.
 *
 * Merging `datas` and `texts` into one row per card is deliberate: the two
 * tables are 1:1 and every caller that wants one usually wants the other, so a
 * split would only buy an extra index to keep consistent.
 *
 * Name lookup mirrors the SQL it replaces: exact match, canonical printing
 * (`alias === 0`) ahead of alternate arts, lowest passcode to break a tie.
 *
 * Args:
 *     cards (object): `{passcode: row}` where row carries both shapes documented
 *         at the top of this file, i.e. {id, alias, setcode, type, atk, def,
 *         level, race, attribute, name, desc, strings}.
 *     scripts (object): `{fileName: luaSource}`.
 *     systemStrings (string): `strings.conf` verbatim.
 *
 * Returns:
 *     object: A source implementing the seven lookups.
 *
 * Examples:
 *     >>> const blueEyes = {id: 89631139, alias: 0, name: "Blue-Eyes White Dragon", atk: 3000}
 *     >>> const src = memoryCardSource({89631139: blueEyes}, {"c89631139.lua": "-- vanilla"})
 *     >>> src.rowById(89631139).atk              // 3000
 *     >>> src.idByName("Blue-Eyes White Dragon") // 89631139
 *     >>> src.idByName("Pot of Greed")           // null
 *     >>> src.search("Blue-Eyes", 5)             // [{id: 89631139, name: "Blue-Eyes White Dragon"}]
 *     >>> memoryCardSource({}, {}, "!system 20 Draw Phase").strings()   // "!system 20 Draw Phase"
 */
export function memoryCardSource(cards = {}, scripts = {}, systemStrings = "") {
  const rows = new Map(Object.entries(cards).map(([code, row]) => [Number(code), row]));
  const byName = new Map();
  for (const row of rows.values()) {
    const held = byName.get(row.name);
    const better = !held || (held.alias !== 0 && row.alias === 0) || (held.alias === row.alias && row.id < held.id);
    if (better) byName.set(row.name, row);
  }
  // SQLite orders TEXT by byte value, not locale, so plain `<` matches it.
  const byBytes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    rowById: (code) => rows.get(code) ?? null,
    textById: (code) => rows.get(code) ?? null,
    idByName: (name) => byName.get(name)?.id ?? null,
    script: (name) => scripts[name.split("/").pop()] ?? null,
    search: (term, limit) => {
      const needle = term.toLowerCase();
      return [...rows.values()]
        .filter((row) => row.name.toLowerCase().includes(needle))
        .sort((a, b) => a.name.length - b.name.length || byBytes(a.name, b.name))
        .slice(0, limit)
        .map((row) => ({ id: row.id, name: row.name }));
    },
    all: () =>
      [...rows.values()]
        .sort((a, b) => byBytes(a.name, b.name) || a.id - b.id)
        .map((row) => ({ code: row.id, name: row.name, desc: row.desc })),
    strings: () => systemStrings,
  };
}

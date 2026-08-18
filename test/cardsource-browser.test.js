/**
 * The browser card source must reach EVERY card and script, like Node's:
 * bundle first, then the complete database, then a synchronous fetch of a
 * single script. Transport is stubbed (fetch + XMLHttpRequest) to serve from
 * this checkout's web/static/carddata (the bundle) and vendor/ (the corpus), so
 * the test proves the resolver chain, not the network.
 *
 * Run: npm test
 */

// Node backends give us the ground truth to compare against.
import "../src/volume-node.js";
import "../src/cardsource-node.js";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO_ROOT, cardInfo } from "../src/cards.js";
import { currentCardSource, setCardSource } from "../src/cardsource.js";
import { openBrowserCardSource } from "../src/cardsource-browser.js";

const BUNDLE = join(REPO_ROOT, "web/static/carddata");
const CORPUS = join(REPO_ROOT, "vendor/CardScripts");
/** The bundle's own inventory, so the probes below are chosen OUTSIDE it — whatever the bake's closure grew to. */
const BUNDLE_CARDS = new Set(Object.keys(JSON.parse(readFileSync(join(BUNDLE, "cards.json"), "utf8"))).map(Number));
const BUNDLE_SCRIPTS = new Set(JSON.parse(readFileSync(join(BUNDLE, "manifest.json"), "utf8")).scripts);
/**
 * Query. A card outside the bundle: with a script if `withScript`, else one whose
 * script does not exist (a vanilla) so the fallback must answer null.
 */
function outsideBundle({ withScript }) {
  const { all } = currentCardSource();
  for (const { code } of all()) {
    if (BUNDLE_CARDS.has(code)) continue;
    const has = existsSync(join(CORPUS, "official", `c${code}.lua`));
    if (has === withScript) return code;
  }
  throw new Error("no probe card found outside the bundle");
}

/** Query. Serves a URL from disk the way the two hosts would: bundle under /carddata, corpus under the assets base. */
function serve(url) {
  const bundle = url.match(/^bundle:\/carddata\/(.+)$/);
  if (bundle) { const p = join(BUNDLE, bundle[1]); return existsSync(p) ? readFileSync(p, "utf8") : null; }
  if (/^assets:\/carddata\/cards-all\.json$/.test(url)) return DATABASE;
  const script = url.match(/^assets:\/scripts\/(.+)$/);
  if (script) {
    for (const dir of [CORPUS, join(CORPUS, "official")]) { const p = join(dir, script[1]); if (existsSync(p)) return readFileSync(p, "utf8"); }
    return null;
  }
  throw new Error(`unexpected URL in test: ${url}`);
}

const fetches = [];
const syncFetches = [];
function installTransport({ backgroundFails = false } = {}) {
  globalThis.fetch = async (url) => {
    fetches.push(url);
    if (backgroundFails && /cards-all\.json$/.test(url)) return { ok: false, status: 503, text: async () => "" };
    const body = serve(url);
    return { ok: body !== null, status: body === null ? 404 : 200, text: async () => body ?? "" };
  };
  globalThis.XMLHttpRequest = class {
    open(_m, url) { this.url = url; }
    send() { syncFetches.push(this.url); const body = serve(this.url); this.status = body === null ? 404 : 200; this.responseText = body ?? ""; }
  };
}

let PROBE, PROBE_VANILLA;
/** The "complete database" served for the probes — built from the NODE source, before the browser source is installed. */
let DATABASE = "{}";

/** Query. Bakes the given cards exactly as bin/bake-carddata.js does, from whatever source is current. */
function bakeNow(codes) {
  const { rowById, textById } = currentCardSource();
  const out = {};
  for (const code of codes) {
    const info = cardInfo(code); const row = rowById(code); const text = textById(code);
    out[code] = { code: info.code, name: info.name, desc: info.desc, atk: info.atk, def: info.def, level: info.level, lscale: info.lscale, rscale: info.rscale,
      type: info.type, race: String(info.race), attribute: info.attribute, alias: info.alias ?? 0, setcode: String(row?.setcode ?? "0"), strings: text?.strings ?? [] };
  }
  return JSON.stringify(out);
}

test("browser card source: bundle first, then the complete database, then a synchronous script fetch", async () => {
  PROBE = outsideBundle({ withScript: true });
  PROBE_VANILLA = outsideBundle({ withScript: false });
  DATABASE = bakeNow([PROBE, PROBE_VANILLA]);
  const nodeSource = currentCardSource();
  // Compare at the SOURCE level: cards.js memoises cardReader/scriptReader, which
  // would make a second call answer from cache and prove nothing.
  const nodeProbe = nodeSource.rowById(PROBE);
  const nodeProbeScript = nodeSource.script(`c${PROBE}.lua`);
  installTransport({ backgroundFails: true }); // force the SYNCHRONOUS path for the database
  try {
    await openBrowserCardSource("bundle:/carddata", { fallbackUrl: "assets:" });
    // 1. A bundle card is answered from memory: no fetch happens for it.
    const src = currentCardSource();
    const before = syncFetches.length;
    assert.ok(src.rowById(89631139), "Blue-Eyes is in the bundle");
    assert.equal(syncFetches.length, before, "no synchronous fetch for a bundled card");

    // 2. A card no deck lists is reached through the complete database — synchronously here,
    //    because the background load was made to fail — and matches Node exactly.
    const got = src.rowById(PROBE);
    assert.ok(got, "the fallback reached a card no deck lists");
    for (const k of ["id", "type", "level", "attribute", "atk", "def"]) assert.equal(got[k], nodeProbe[k], `${k} matches Node`);
    assert.equal(String(got.race), String(nodeProbe.race), "race matches Node");
    assert.ok(syncFetches.some((u) => /cards-all\.json$/.test(u)), "the database was fetched synchronously on the miss");
    const dbFetches = syncFetches.filter((u) => /cards-all\.json$/.test(u)).length;
    src.rowById(PROBE_VANILLA);
    assert.equal(syncFetches.filter((u) => /cards-all\.json$/.test(u)).length, dbFetches, "the database is fetched at most once");

    // 3. A script the bundle lacks is fetched synchronously the moment the core asks, once,
    //    byte-identical to Node's copy; a card with no script anywhere answers null, once.
    assert.equal(src.script(`c${PROBE}.lua`), nodeProbeScript, `c${PROBE}.lua fetched on demand`);
    assert.ok(nodeProbeScript, "the probe really has a script");
    const vanilla = `c${PROBE_VANILLA}.lua`;
    assert.equal(src.script(vanilla), null, "a vanilla has no script anywhere: null, same as Node");
    assert.equal(syncFetches.filter((u) => u.endsWith(vanilla)).length, 0, "and the corpus index answered that with NO fetch at all");
    assert.equal(src.script("c0.lua"), null, "a library the core merely probes for: null, no fetch");
    assert.equal(syncFetches.filter((u) => u.endsWith("c0.lua")).length, 0);
    assert.ok(!BUNDLE_SCRIPTS.has(`c${PROBE}.lua`), "the probe script was genuinely outside the bundle");
  } finally {
    setCardSource(nodeSource);
  }
});

test("browser card source: the complete database lands in the background and misses need no synchronous fetch", async () => {
  const nodeSource = currentCardSource();
  installTransport();
  const beforeSync = syncFetches.length;
  try {
    await openBrowserCardSource("bundle:/carddata", { fallbackUrl: "assets:" });
    // Let the background fetch resolve.
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(currentCardSource().rowById(PROBE), "reachable");
    assert.equal(syncFetches.filter((u) => /cards-all\.json$/.test(u)).length - syncFetches.slice(0, beforeSync).filter((u) => /cards-all\.json$/.test(u)).length, 0, "no synchronous database fetch was needed");
  } finally {
    setCardSource(nodeSource);
  }
});

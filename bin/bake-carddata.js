#!/usr/bin/env node
/**
 * Bakes everything the engine needs about cards into a small, committable bundle
 * so a statically hosted build works with no `setup.sh`, no SQLite and no vendor/.
 *
 * The full vendor tree is ~250 MB: a 7.5 MB SQLite database of every card ever
 * printed, and 13k+ Lua scripts. A build only ever needs the cards its own decks
 * contain, which is two orders of magnitude smaller — so this walks the built-in
 * decks, resolves their passcodes, and emits:
 *
 *     web/static/carddata/cards.json      every field cards.js reads, per card
 *     web/static/carddata/scripts/*.lua   the card scripts those cards need
 *     web/static/carddata/strings.conf    EDOPro's system strings
 *     web/static/carddata/manifest.json   what is here, and what produced it
 *
 * Run after setup.sh, and re-run whenever a deck gains a card:
 *     node bin/bake-carddata.js
 */

import "../src/volume-node.js";
import "../src/cardsource-node.js";
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { exportArchive } from "../src/archive.js";
import { REPO_ROOT, allCards, codeOf } from "../src/cards.js";
import { rowById } from "../src/cardsource.js";
import { bakedCard } from "../src/cardsource-browser.js";
import { listDecks, loadDeck } from "../src/store.js";

const OUT = join(REPO_ROOT, "web/static/carddata");
/**
 * `--assets <dir>`: also write the COMPLETE card database into <dir>/carddata/
 * cards-all.json (every card ever printed, ~8.5 MB, 1.5 MB gzipped). That file
 * lives on the assets branch (bin/publish-assets.sh), never in main; the browser
 * fetches it in the background after boot and falls back to it synchronously
 * for anything the small bundle lacks. It is what makes the in-browser engine
 * equivalent to Node instead of a guess at what a duel will need.
 */
const { values: args } = parseArgs({ options: { assets: { type: "string" } } });
const SCRIPTS_SRC = join(REPO_ROOT, "vendor/CardScripts");
const STRINGS_SRC = join(REPO_ROOT, "vendor/strings.conf");

if (!existsSync(SCRIPTS_SRC)) throw new Error(`missing ${SCRIPTS_SRC} — run ./setup.sh first`);

/** Every passcode any built-in deck references. */
const codes = new Set();
for (const name of listDecks()) {
  const deck = loadDeck(name);
  for (const list of [deck.main, deck.extra, deck.side]) {
    for (const [cardName] of list ?? []) codes.add(codeOf(cardName));
  }
}

/** How far around a card's own passcode `id±…` arithmetic may reach (Scapegoat's four tokens are id+1..id+4). */
const ID_NEIGHBOURHOOD = 8;

/**
 * Query. The passcodes a card script can reach for at runtime: tokens it
 * creates (`id+1`, `id+2`), and any card it names by number (`IsCode(N)`,
 * `CreateToken(tp,N)`, `aux.*(…,N,…)`). Read from the script text, resolved
 * against cards.cdb so ordinary numbers are ignored.
 *
 * Why: Hornet Drones (52340444) creates a "Sky Striker Ace Token" (52340445)
 * that sits in no decklist, so a decklist-only bake shipped neither its data
 * nor its script and the browser duel died mid-effect. Scripts reference other
 * cards; the bundle has to close over that.
 *
 * Args:
 *     code (number): A card whose script is in the bundle.
 *
 * Returns:
 *     number[]: Passcodes referenced (may include ones already known).
 *
 * Examples:
 *     >>> referencedCodes(52340444)   // [52340445]  (Hornet Drones -> its token)
 */
function referencedCodes(code) {
  const path = join(SCRIPTS_SRC, "official", `c${code}.lua`);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const found = new Set();
  // `id+N` / `id-N`: tokens and sibling printings are addressed relative to the
  // card — and not always with a literal (Scapegoat: `Duel.CreateToken(tp,id+i)`
  // for i=1..4). Any relative arithmetic therefore pulls in the whole small
  // neighbourhood that exists in cards.cdb; a few spare cards is nothing next to
  // a duel dying mid-effect.
  if (/\bid\s*[+-]/.test(text)) for (let d = -ID_NEIGHBOURHOOD; d <= ID_NEIGHBOURHOOD; d++) if (d) found.add(code + d);
  // Bare 5-9 digit literals that are real passcodes.
  for (const m of text.matchAll(/(?<![\w.])(\d{5,9})(?![\w.])/g)) found.add(Number(m[1]));
  // Named token constants from the shared Lua; `TOKEN_X+i` reaches a neighbourhood too.
  for (const m of text.matchAll(/\b(TOKEN_\w+)\b(\s*[+-])?/g)) {
    const base = TOKEN_CONSTANTS.get(m[1]);
    if (base === undefined) continue;
    found.add(base);
    if (m[2]) for (let d = -ID_NEIGHBOURHOOD; d <= ID_NEIGHBOURHOOD; d++) if (d) found.add(base + d);
  }
  return [...found].filter((c) => c !== code && rowById(c) !== null);
}

/**
 * Query. Token passcodes the shared Lua defines by name (`TOKEN_OJAMA = 29843092`
 * in constant.lua and friends), so a card script that says `TOKEN_OJAMA+i` can
 * be resolved without executing Lua.
 *
 * Returns:
 *     Map<string, number>: constant name -> passcode.
 *
 * Examples:
 *     >>> tokenConstants().get("TOKEN_OJAMA")   // 29843092
 */
function tokenConstants() {
  const map = new Map();
  for (const name of readdirSync(SCRIPTS_SRC)) {
    if (!name.endsWith(".lua")) continue;
    for (const m of readFileSync(join(SCRIPTS_SRC, name), "utf8").matchAll(/^\s*(TOKEN_\w+)\s*=\s*(\d+)/gm)) map.set(m[1], Number(m[2]));
  }
  return map;
}
const TOKEN_CONSTANTS = tokenConstants();

// Close the deck cards over what their scripts reference, transitively.
const queue = [...codes];
while (queue.length) {
  for (const ref of referencedCodes(queue.pop())) {
    if (!codes.has(ref)) { codes.add(ref); queue.push(ref); }
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "scripts"), { recursive: true });

// 1. Card data — `bakedCard` (src/cardsource-browser.js) is the one definition of
//    the record, sitting beside the `bakedRow` that reads it back, so the browser
//    adapter serves cardInfo() from this with no reshaping.
const cards = {};
for (const code of [...codes].sort((a, b) => a - b)) {
  const card = bakedCard(code);
  if (!card) throw new Error(`no card data for passcode ${code} — is cards.cdb current?`);
  cards[code] = card;
}
writeFileSync(join(OUT, "cards.json"), JSON.stringify(cards));

if (args.assets) {
  const dir = join(args.assets, "carddata");
  mkdirSync(dir, { recursive: true });
  const everything = {};
  for (const { code } of allCards()) {
    const card = bakedCard(code);
    if (card) everything[code] = card;
  }
  writeFileSync(join(dir, "cards-all.json"), JSON.stringify(everything));
  console.log(`  -> ${dir}/cards-all.json  ${Object.keys(everything).length} cards (the whole database, for the assets branch)`);
}

// 2. Lua. Shared libraries are needed by every duel; card scripts only for cards
//    in play. A card with no script is a vanilla and needs none — that is normal.
let shared = 0;
for (const name of readdirSync(SCRIPTS_SRC)) {
  if (!name.endsWith(".lua")) continue;
  writeFileSync(join(OUT, "scripts", name), readFileSync(join(SCRIPTS_SRC, name)));
  shared++;
}
let scripts = 0;
let vanilla = 0;
for (const code of codes) {
  const from = join(SCRIPTS_SRC, "official", `c${code}.lua`);
  if (!existsSync(from)) { vanilla++; continue; }
  writeFileSync(join(OUT, "scripts", `c${code}.lua`), readFileSync(from));
  scripts++;
}

// 2b. The corpus index: every script that exists at all, by basename. With it the
//     browser answers "no such script" for a vanilla or a library ocgcore probes
//     (c0.lua, proc_unofficial.lua) without a network round trip; without it, each
//     such probe would be a fetch that 404s. ~13k names, ~60 KB gzipped.
const corpus = [...readdirSync(SCRIPTS_SRC), ...readdirSync(join(SCRIPTS_SRC, "official"))].filter((n) => n.endsWith(".lua")).sort();
writeFileSync(join(OUT, "corpus-scripts.json"), JSON.stringify(corpus));

// 3. System strings (phase names, prompts, victory reasons).
writeFileSync(join(OUT, "strings.conf"), readFileSync(STRINGS_SRC));

// 4. The built-in decks, as an archive (src/archive.js) holding only src/decks/*.
//    A fresh browser has an empty volume; boot imports this with replace=false,
//    so the decks appear once and a user's later edits are never overwritten.
const decksOnly = exportArchive();
decksOnly.files = Object.fromEntries(Object.entries(decksOnly.files).filter(([path]) => path.startsWith("src/decks/")));
writeFileSync(join(OUT, "decks-seed.json"), JSON.stringify(decksOnly));

const manifest = {
  bakedFrom: "vendor/CardScripts + vendor/BabelCDB (see setup.sh for the pinned commits)",
  // The exact script files present, so a browser fetches these and nothing else:
  // a static host has no directory listing, and a vanilla card legitimately has no
  // script -- guessing "c<code>.lua" for every card would 404 on all 79 of them.
  scripts: readdirSync(join(OUT, "scripts")).filter((n) => n.endsWith(".lua")).sort(),
  cards: Object.keys(cards).length,
  corpusScripts: corpus.length,
  seededDecks: Object.keys(decksOnly.files).length,
  sharedScripts: shared,
  cardScripts: scripts,
  vanillaCards: vanilla,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));

const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) =>
  n + (e.isDirectory() ? size(join(dir, e.name)) : readFileSync(join(dir, e.name)).length), 0);
console.log(`baked ${manifest.cards} cards, ${shared} shared + ${scripts} card scripts (${vanilla} vanillas need none), ${manifest.seededDecks} decks`);
console.log(`  -> web/static/carddata  ${(size(OUT) / 1024 / 1024).toFixed(2)} MB`);

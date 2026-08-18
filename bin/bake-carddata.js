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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { exportArchive } from "../src/archive.js";
import { REPO_ROOT, cardInfo, codeOf } from "../src/cards.js";
import { rowById, textById } from "../src/cardsource.js";
import { listDecks, loadDeck } from "../src/store.js";

const OUT = join(REPO_ROOT, "web/static/carddata");
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

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "scripts"), { recursive: true });

// 1. Card data — exactly the fields cards.js exposes, so the browser adapter can
//    serve cardInfo() from this with no reshaping.
const cards = {};
for (const code of [...codes].sort((a, b) => a - b)) {
  const info = cardInfo(code);
  if (!info) throw new Error(`no card data for passcode ${code} — is cards.cdb current?`);
  // setcode is what archetype checks (IsSetCard) match on, and the per-card
  // script strings are the effect names prompts show — both invisible until a
  // card misbehaves in the browser, so they ride along from the raw rows.
  const row = rowById(code);
  const text = textById(code);
  cards[code] = {
    code: info.code, name: info.name, desc: info.desc,
    atk: info.atk, def: info.def, level: info.level,
    lscale: info.lscale, rscale: info.rscale,
    type: info.type, race: String(info.race), attribute: info.attribute,
    alias: info.alias ?? 0,
    setcode: String(row?.setcode ?? "0"),
    strings: text?.strings ?? [],
  };
}
writeFileSync(join(OUT, "cards.json"), JSON.stringify(cards));

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

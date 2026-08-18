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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, cardInfo, codeOf } from "../src/cards.js";
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
  cards[code] = {
    code: info.code, name: info.name, desc: info.desc,
    atk: info.atk, def: info.def, level: info.level,
    lscale: info.lscale, rscale: info.rscale,
    type: info.type, race: String(info.race), attribute: info.attribute,
    alias: info.alias ?? 0,
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

const manifest = {
  bakedFrom: "vendor/CardScripts + vendor/BabelCDB (see setup.sh for the pinned commits)",
  cards: Object.keys(cards).length,
  sharedScripts: shared,
  cardScripts: scripts,
  vanillaCards: vanilla,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));

const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) =>
  n + (e.isDirectory() ? size(join(dir, e.name)) : readFileSync(join(dir, e.name)).length), 0);
console.log(`baked ${manifest.cards} cards, ${shared} shared + ${scripts} card scripts (${vanilla} vanillas need none)`);
console.log(`  -> web/static/carddata  ${(size(OUT) / 1024 / 1024).toFixed(2)} MB`);

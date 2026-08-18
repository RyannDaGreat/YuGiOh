/**
 * The Node backing store for `cardsource.js`: the vendored Project Ignis
 * `cards.cdb` and `CardScripts` tree, read straight off disk.
 *
 * Importing this module installs it, so every Node entry point (the CLI, the
 * web server, the tests) does `import "./cardsource-node.js"` exactly once and
 * every card lookup below it hits the same database EDOPro ships — which is why
 * passcodes line up 1:1 with the Lua the engine executes. A browser build never
 * imports this file, which is what keeps `node:sqlite` and the 250 MB vendor
 * tree out of the bundle entirely.
 *
 * `strings.conf` is served from here too, so `strings.js` needs no filesystem of
 * its own — see the ROW SHAPES note in `cardsource.js` for why it belongs here.
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./cards.js";
import { setCardSource, patchScript } from "./cardsource.js";

const CDB_PATH = join(REPO_ROOT, "vendor/BabelCDB/cards.cdb");
const STRINGS_PATH = join(REPO_ROOT, "vendor/strings.conf");

/** Script lookup order: official card scripts first, then the shared library. */
const SCRIPT_DIRS = [
  join(REPO_ROOT, "vendor/CardScripts/official"),
  join(REPO_ROOT, "vendor/CardScripts"),
];

/** cards.cdb's `texts` table holds sixteen per-card script strings, str1..str16. */
const CARD_STRINGS = 16;

const db = new DatabaseSync(CDB_PATH, { readOnly: true });
// setcode (4 packed 16-bit codes) and race (64-bit in modern cores) can exceed
// 2^53; node:sqlite refuses to hand those over as numbers, so read them as text.
const stmtById = db.prepare("SELECT id, alias, CAST(setcode AS TEXT) AS setcode, type, atk, def, level, CAST(race AS TEXT) AS race, attribute FROM datas WHERE id = ?");
const stmtTextById = db.prepare("SELECT * FROM texts WHERE id = ?");
// Prefer the canonical printing (alias = 0) and TCG/OCG-legal cards (ot & 3)
// over alternate arts, anime, and video-game versions that share a name.
const stmtIdByName = db.prepare("SELECT t.id FROM texts t JOIN datas d ON d.id = t.id WHERE t.name = ? ORDER BY (d.alias != 0), ((d.ot & 3) = 0), t.id LIMIT 1");
const stmtSearch = db.prepare("SELECT t.id, t.name FROM texts t WHERE t.name LIKE ? ORDER BY length(t.name), t.name LIMIT ?");
const stmtAll = db.prepare("SELECT t.id AS code, t.name, t.desc FROM texts t JOIN datas d ON d.id = t.id ORDER BY t.name, t.id");

/**
 * Pure function. Flattens a `texts` row's str1..str16 columns into an array, so
 * callers index script strings from 0 the way the core's description codes do.
 *
 * Args:
 *     row (object): A `texts` row, or null.
 *
 * Returns:
 *     {name: string, desc: string, strings: string[]}|null
 *
 * Examples:
 *     >>> textsRow({name: "Trap Hole", desc: "...", str1: "", str2: null}).strings.length   // 16
 *     >>> textsRow({name: "X", desc: "", str1: "Effect A"}).strings[0]                      // "Effect A"
 *     >>> textsRow(null)                                                                    // null
 */
function textsRow(row) {
  if (!row) return null;
  const strings = [];
  for (let slot = 1; slot <= CARD_STRINGS; slot++) strings.push(row[`str${slot}`] ?? "");
  return { name: row.name, desc: row.desc, strings };
}

/**
 * Query. Reads a Lua card or library script from the vendored CardScripts tree.
 *
 * Args:
 *     name (string): Script path the core requests, e.g. "c89631139.lua".
 *
 * Returns:
 *     string|null: Source, or null if no such script exists — a vanilla card
 *     has none, which is normal and not an error.
 *
 * Examples:
 *     >>> readScript("utility.lua").includes("GetID")   // true
 *     >>> readScript("c999999999.lua")                  // null
 */
function readScript(name) {
  const base = name.split("/").pop();
  for (const dir of SCRIPT_DIRS) {
    const path = join(dir, base);
    if (existsSync(path)) return patchScript(name, readFileSync(path, "utf8"));
  }
  return null;
}

/**
 * Command. Installs cards.cdb and the vendored scripts as the app's card
 * source. Idempotent.
 *
 * Returns:
 *     void
 *
 * Examples:
 *     >>> installNodeCardSource(); rowById(89631139).atk   // 3000
 */
export function installNodeCardSource() {
  setCardSource({
    rowById: (code) => stmtById.get(code) ?? null,
    textById: (code) => textsRow(stmtTextById.get(code)),
    idByName: (name) => stmtIdByName.get(name)?.id ?? null,
    script: readScript,
    search: (term, limit) => stmtSearch.all(`%${term}%`, limit),
    all: () => stmtAll.all(),
    strings: () => readFileSync(STRINGS_PATH, "utf8"),
  });
}

installNodeCardSource();

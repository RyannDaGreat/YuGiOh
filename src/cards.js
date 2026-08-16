/**
 * Offline card database access.
 *
 * Everything here reads the vendored Project Ignis `cards.cdb`, the exact same
 * database EDOPro ships, so passcodes line up 1:1 with the Lua scripts the
 * engine executes. No network access at any point — an agent mid-duel must be
 * able to look up any card's full effect text without leaving the machine.
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CDB_PATH = join(REPO_ROOT, "vendor/BabelCDB/cards.cdb");

/** Script lookup order: official card scripts first, then the shared library. */
const SCRIPT_DIRS = [
  join(REPO_ROOT, "vendor/CardScripts/official"),
  join(REPO_ROOT, "vendor/CardScripts"),
];

/** cards.cdb packs up to 4 archetype setcodes into one integer, 16 bits each. */
const SETCODE_BITS = 16;
const SETCODE_SLOTS = 4;
const SETCODE_MASK = 0xffff;

/**
 * The `level` column is overloaded: low byte is level/rank/link rating, and the
 * two high bytes carry the Pendulum scales.
 */
const LEVEL_MASK = 0xff;
const RSCALE_SHIFT = 16;
const LSCALE_SHIFT = 24;

/** Bit in the `type` column marking a Link monster, whose `def` column holds markers. */
const TYPE_LINK = 0x4000000;

const db = new DatabaseSync(CDB_PATH, { readOnly: true });
// setcode (4 packed 16-bit codes) and race (64-bit in modern cores) can exceed
// 2^53; node:sqlite refuses to hand those over as numbers, so read them as text.
const stmtById = db.prepare("SELECT id, ot, alias, CAST(setcode AS TEXT) AS setcode, type, atk, def, level, CAST(race AS TEXT) AS race, attribute, category FROM datas WHERE id = ?");
const stmtTextById = db.prepare("SELECT * FROM texts WHERE id = ?");
// Prefer the canonical printing (alias = 0) and TCG/OCG-legal cards (ot & 3)
// over alternate arts, anime, and video-game versions that share a name.
const stmtIdByName = db.prepare("SELECT t.id FROM texts t JOIN datas d ON d.id = t.id WHERE t.name = ? ORDER BY (d.alias != 0), ((d.ot & 3) = 0), t.id LIMIT 1");
const stmtSearch = db.prepare(
  "SELECT t.id, t.name FROM texts t WHERE t.name LIKE ? ORDER BY length(t.name), t.name LIMIT ?",
);

/**
 * Pure function. Unpacks cards.cdb's packed setcode integer into archetype codes.
 *
 * Args:
 *     packed (number|bigint): The `datas.setcode` column value.
 *
 * Returns:
 *     number[]: Non-zero 16-bit archetype codes, least-significant slot first.
 *
 * Examples:
 *     >>> unpackSetcodes(0)           // []
 *     >>> unpackSetcodes(0x1234)      // [4660]
 *     >>> unpackSetcodes(0x00420001n) // [1, 66]
 */
export function unpackSetcodes(packed) {
  const value = BigInt(packed ?? 0);
  const codes = [];
  for (let slot = 0; slot < SETCODE_SLOTS; slot++) {
    const code = Number((value >> BigInt(slot * SETCODE_BITS)) & BigInt(SETCODE_MASK));
    if (code !== 0) codes.push(code);
  }
  return codes;
}

/**
 * Query. Reads one card's engine-facing data from cards.cdb.
 *
 * This is the function handed to the core as its `cardReader`. Returning null
 * for an unknown passcode is expected behaviour, not an error — the core asks
 * about codes speculatively.
 *
 * Args:
 *     code (number): Card passcode.
 *
 * Returns:
 *     OcgCardData|null: null when the passcode is absent from the database.
 *
 * Examples:
 *     >>> cardReader(89631139).attack // 3000  (Blue-Eyes White Dragon)
 *     >>> cardReader(1)               // null
 */
export function cardReader(code) {
  const row = stmtById.get(code);
  if (!row) return null;
  const isLink = (row.type & TYPE_LINK) !== 0;
  return {
    code: row.id,
    alias: row.alias,
    setcodes: unpackSetcodes(row.setcode),
    type: row.type,
    level: row.level & LEVEL_MASK,
    attribute: row.attribute,
    race: BigInt(row.race),
    attack: row.atk,
    // Link monsters have no DEF; the column stores their marker bitmask instead.
    defense: isLink ? 0 : row.def,
    lscale: (row.level >> LSCALE_SHIFT) & LEVEL_MASK,
    rscale: (row.level >> RSCALE_SHIFT) & LEVEL_MASK,
    link_marker: isLink ? row.def : 0,
  };
}

/**
 * Query. Loads a Lua card or library script by name from the vendored scripts.
 *
 * Args:
 *     name (string): Script path the core requests, e.g. "c89631139.lua".
 *
 * Returns:
 *     string|null: Script source, or null if no such script exists.
 *
 * Examples:
 *     >>> scriptReader("utility.lua").includes("GetID") // true
 *     >>> scriptReader("c999999999.lua")                // null
 */
export function scriptReader(name) {
  const base = name.split("/").pop();
  for (const dir of SCRIPT_DIRS) {
    const path = join(dir, base);
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  return null;
}

/**
 * Query. Resolves an exact English card name to its passcode.
 *
 * Args:
 *     name (string): Exact card name as printed.
 *
 * Returns:
 *     number: The passcode.
 *
 * Throws:
 *     Error: if the name is not in the database — a typo in a decklist must be
 *     loud, never a silently missing card.
 *
 * Examples:
 *     >>> codeOf("Blue-Eyes White Dragon") // 89631139
 *     >>> codeOf("Pot of Greed")           // 55144522
 */
export function codeOf(name) {
  const row = stmtIdByName.get(name);
  if (!row) throw new Error(`Card not found in cards.cdb: ${JSON.stringify(name)}`);
  return row.id;
}

/**
 * Query. Full human/agent-facing detail for one card, including effect text.
 *
 * Args:
 *     code (number): Card passcode.
 *
 * Returns:
 *     {code, name, desc, atk, def, level, type, race, attribute}|null
 *
 * Examples:
 *     >>> cardInfo(89631139).name // "Blue-Eyes White Dragon"
 *     >>> cardInfo(89631139).desc.startsWith("This legendary dragon") // true
 */
export function cardInfo(code) {
  const data = stmtById.get(code);
  const text = stmtTextById.get(code);
  if (!data || !text) return null;
  return {
    code: data.id,
    name: text.name,
    desc: text.desc,
    atk: data.atk,
    def: data.def,
    level: data.level & LEVEL_MASK,
    type: data.type,
    race: Number(data.race),
    attribute: data.attribute,
  };
}

/**
 * Query. Card name for a passcode.
 *
 * Args:
 *     code (number): Passcode.
 *
 * Returns:
 *     string: The name, or `card#<code>` if unknown — never blank.
 *
 * Examples:
 *     >>> cardName(89631139) // "Blue-Eyes White Dragon"
 *     >>> cardName(0)        // "card#0"
 */
export function cardName(code) {
  return stmtTextById.get(code)?.name ?? `card#${code}`;
}

/**
 * Query. One of a card's up-to-16 script strings (effect names, prompts).
 *
 * Args:
 *     code (number): Passcode.
 *     index (number): 0-based string index (str1 is index 0).
 *
 * Returns:
 *     string|null: null when the card or the slot is empty.
 *
 * Examples:
 *     >>> cardString(89631139, 0)  // null   (vanilla monster, no strings)
 *     >>> cardString(46986414, 0)  // "Dark Magician" script string 0 (if defined) or null
 */
export function cardString(code, index) {
  const row = stmtTextById.get(code);
  if (!row) return null;
  const value = row[`str${index + 1}`];
  return value ? value : null;
}

/** Type bits from OcgType that name what kind of card this is. */
const TYPE_MONSTER = 0x1;
const TYPE_SPELL = 0x2;
const TYPE_TRAP = 0x4;
const TYPE_LABELS = [
  [0x10, "Normal"], [0x20, "Effect"], [0x40, "Fusion"], [0x80, "Ritual"], [0x100, "Trap Monster"],
  [0x200, "Spirit"], [0x400, "Union"], [0x800, "Gemini"], [0x1000, "Tuner"], [0x2000, "Synchro"],
  [0x4000, "Token"], [0x10000, "Quick-Play"], [0x20000, "Continuous"], [0x40000, "Equip"],
  [0x80000, "Field"], [0x100000, "Counter"], [0x200000, "Flip"], [0x400000, "Toon"], [0x800000, "Xyz"],
  [0x1000000, "Pendulum"], [0x4000000, "Link"],
];
const ATTRIBUTE_LABELS = { 1: "EARTH", 2: "WATER", 4: "FIRE", 8: "WIND", 16: "LIGHT", 32: "DARK", 64: "DIVINE" };
const RACE_LABELS = {
  1: "Warrior", 2: "Spellcaster", 4: "Fairy", 8: "Fiend", 16: "Zombie", 32: "Machine", 64: "Aqua",
  128: "Pyro", 256: "Rock", 512: "Winged Beast", 1024: "Plant", 2048: "Insect", 4096: "Thunder",
  8192: "Dragon", 16384: "Beast", 32768: "Beast-Warrior", 65536: "Dinosaur", 131072: "Fish",
  262144: "Sea Serpent", 524288: "Reptile", 1048576: "Psychic", 2097152: "Divine-Beast",
  4194304: "Creator God", 8388608: "Wyrm", 16777216: "Cyberse", 33554432: "Illusion",
};

/**
 * Pure function. Human label for a card's type bitmask.
 *
 * Args:
 *     type (number): OcgType bitmask from cards.cdb.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> typeLabel(0x11)      // "Normal Monster"
 *     >>> typeLabel(0x21)      // "Effect Monster"
 *     >>> typeLabel(0x2)       // "Spell"
 *     >>> typeLabel(0x20004)   // "Continuous Trap"
 *     >>> typeLabel(0x200021)  // "Flip Effect Monster"
 */
export function typeLabel(type) {
  const words = TYPE_LABELS.filter(([bit]) => type & bit).map(([, label]) => label);
  if (type & TYPE_MONSTER) words.push("Monster");
  else if (type & TYPE_SPELL) words.push("Spell");
  else if (type & TYPE_TRAP) words.push("Trap");
  return words.join(" ");
}

/**
 * Query. Compact one-line summary of a card: what an agent needs at a glance.
 *
 * Args:
 *     code (number): Passcode.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> summarizeCard(89631139)
 *     "Blue-Eyes White Dragon [LIGHT Dragon Normal Monster Lv8 ATK3000 DEF2500]"
 *     >>> summarizeCard(4206964)
 *     "Trap Hole [Trap]"
 */
export function summarizeCard(code) {
  const info = cardInfo(code);
  if (!info) return `card#${code}`;
  if (!(info.type & TYPE_MONSTER)) return `${info.name} [${typeLabel(info.type)}]`;
  const attribute = ATTRIBUTE_LABELS[info.attribute] ?? `attr#${info.attribute}`;
  const race = RACE_LABELS[info.race] ?? `race#${info.race}`;
  return `${info.name} [${attribute} ${race} ${typeLabel(info.type)} Lv${info.level} ATK${info.atk} DEF${info.def}]`;
}

/**
 * Query. Substring search over card names, for agent lookup by partial name.
 *
 * Args:
 *     term (string): Substring to match, case-insensitive.
 *     limit (number): Maximum rows to return.
 *
 * Returns:
 *     Array<{id: number, name: string}>: Shortest names first.
 *
 * Examples:
 *     >>> searchCards("Blue-Eyes White", 1) // [{id: 89631139, name: "Blue-Eyes White Dragon"}]
 *     >>> searchCards("zzzznotacard", 5)    // []
 */
export function searchCards(term, limit) {
  return stmtSearch.all(`%${term}%`, limit);
}

/**
 * Query. Every card in the database as {code, name, desc}, ordered by name.
 *
 * Returns:
 *     Array<{code: number, name: string, desc: string}>
 *
 * Examples:
 *     >>> allCards().length > 14000 // true
 */
export function allCards() {
  return db.prepare("SELECT t.id AS code, t.name, t.desc FROM texts t JOIN datas d ON d.id = t.id ORDER BY t.name, t.id").all();
}

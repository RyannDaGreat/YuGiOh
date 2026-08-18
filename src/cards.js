/**
 * Offline card knowledge: decoding, labelling and memoizing what the card
 * database says.
 *
 * The bytes themselves come from `cardsource.js` — cards.cdb under Node, a
 * baked JSON bundle in a browser — but every card *fact* is derived here, so
 * both hosts agree on what a card is down to the last bit. No network access at
 * any point: an agent mid-duel must be able to look up any card's full effect
 * text without leaving the machine.
 *
 * This module owns the decoding of cards.cdb's cramped column layout (packed
 * setcodes, a `level` column carrying three numbers, DEF doubling as Link
 * markers) and the type/attribute/race label tables. A source hands over rows;
 * nothing below this line knows where they came from.
 */

import { all, idByName, rowById, script, search, textById } from "./cardsource.js";

/**
 * Query. Absolute path of the repository root — where `vendor/`, `duels/` and
 * `src/decks/` live — derived from this file's own location rather than the
 * process's cwd, so `ygo` works from any directory.
 *
 * In a browser there is no repo and no disk: the module URL is `http(s):`, and
 * the answer is "". Callers there must not be building filesystem paths at all,
 * so an empty root makes that mistake obvious instead of inventing one. This
 * avoids `node:url`/`node:path`, which a browser bundle cannot resolve.
 *
 * Returns:
 *     string: Absolute path with no trailing slash, or "" off-disk.
 *
 * Examples:
 *     >>> repoRoot().endsWith("/YuGi")   // true   (under Node, from a clone in YuGi/)
 *     >>> // served from https://example.com/YuGiOh/_app/...  ->  ""
 */
function repoRoot() {
  const dir = new URL(".", import.meta.url);
  if (dir.protocol !== "file:") return "";
  // dir is ".../<root>/src/"; dropping the last segment leaves the root.
  return decodeURIComponent(dir.pathname).replace(/\/[^/]*\/$/, "");
}

export const REPO_ROOT = repoRoot();

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

// The card database is immutable for the life of the process, so the per-code / per-name
// lookups below are memoized. deckLibrary() alone resolves several thousand names
// (37 decks × validate + signature), and the core calls cardReader on every
// replayed card — without caching, /decks and each replay re-query the source for
// the same rows every time. Successful and null results are cached; an unknown NAME
// throws in codeOf and is never cached (so a real typo still fails loudly).
const codeByNameCache = new Map();
const readerByCodeCache = new Map();
const infoByCodeCache = new Map();
const nameByCodeCache = new Map();

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
 * Pure function. The inverse of the LEVEL_MASK/RSCALE_SHIFT/LSCALE_SHIFT split
 * above: folds a Level and its two Pendulum Scales back into cards.cdb's single
 * `level` column.
 *
 * Only a source that stores the three numbers separately needs this — the baked
 * browser bundle does — and it lives here so the packed layout is described in
 * exactly one place.
 *
 * Args:
 *     level (number): Level, Rank, or Link Rating (0-255).
 *     lscale (number): Left Pendulum Scale (0 for a non-Pendulum card).
 *     rscale (number): Right Pendulum Scale.
 *
 * Returns:
 *     number: The packed `datas.level` value.
 *
 * Examples:
 *     >>> packLevel(8, 0, 0)   // 8         (Blue-Eyes White Dragon)
 *     >>> packLevel(7, 4, 4)   // 67371015  (Odd-Eyes Pendulum Dragon, Scale 4)
 */
export function packLevel(level, lscale, rscale) {
  return (level & LEVEL_MASK) | (rscale << RSCALE_SHIFT) | (lscale << LSCALE_SHIFT);
}

/**
 * Query. Reads one card's engine-facing data from the installed card source.
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
  if (readerByCodeCache.has(code)) return readerByCodeCache.get(code);
  const row = rowById(code);
  if (!row) { readerByCodeCache.set(code, null); return null; }
  const isLink = (row.type & TYPE_LINK) !== 0;
  const data = {
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
  readerByCodeCache.set(code, data);
  return data;
}

/**
 * Query. Loads a Lua card or library script by name from the installed source.
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
  return script(name);
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
  const cached = codeByNameCache.get(name);
  if (cached !== undefined) return cached;
  const id = idByName(name);
  if (id === null) throw new Error(`Card not found in cards.cdb: ${JSON.stringify(name)}`);
  codeByNameCache.set(name, id);
  return id;
}

/**
 * Pure function. Card text as a player wants to read it: the database's
 * boilerplate footers ("* The above text is unofficial and describes the card's
 * functionality in the OCG.") are noise in the preview, the deck viewer and the
 * LLM prompt alike, so they are dropped here, once, for every consumer.
 *
 * Args:
 *     desc (string): Effect text from cards.cdb.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> cleanDesc("Draw 2 cards.\n* The above text is unofficial and describes the card's functionality in the OCG.")   // "Draw 2 cards."
 *     >>> cleanDesc("Draw 2 cards.")   // "Draw 2 cards."
 */
export function cleanDesc(desc) {
  return String(desc ?? "").split("\n").filter((line) => !/^\*\s*The above text is unofficial/i.test(line.trim())).join("\n").trim();
}

/**
 * Query. Full human/agent-facing detail for one card, including effect text.
 *
 * Args:
 *     code (number): Card passcode.
 *
 * Returns:
 *     {code, name, desc, atk, def, level, lscale, rscale, type, race, attribute}|null
 *     `lscale`/`rscale` are the printed Pendulum Scales, 0 for a non-Pendulum card.
 *
 * Examples:
 *     >>> cardInfo(89631139).name // "Blue-Eyes White Dragon"
 *     >>> cardInfo(89631139).desc.startsWith("This legendary dragon") // true
 *     >>> cardInfo(16178681).lscale // 4   (Odd-Eyes Pendulum Dragon, Scale 4)
 */
export function cardInfo(code) {
  if (infoByCodeCache.has(code)) return infoByCodeCache.get(code);
  const data = rowById(code);
  const text = textById(code);
  const info = (!data || !text) ? null : {
    code: data.id,
    name: text.name,
    desc: cleanDesc(text.desc),
    atk: data.atk,
    def: data.def,
    level: data.level & LEVEL_MASK,
    lscale: (data.level >> LSCALE_SHIFT) & LEVEL_MASK,
    rscale: (data.level >> RSCALE_SHIFT) & LEVEL_MASK,
    type: data.type,
    race: Number(data.race),
    attribute: data.attribute,
  };
  infoByCodeCache.set(code, info);
  return info;
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
  if (nameByCodeCache.has(code)) return nameByCodeCache.get(code);
  const name = textById(code)?.name ?? `card#${code}`;
  nameByCodeCache.set(code, name);
  return name;
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
  const row = textById(code);
  if (!row) return null;
  return row.strings[index] || null;
}

/** Type bits from OcgType that name what kind of card this is. */
const TYPE_MONSTER = 0x1;
const TYPE_SPELL = 0x2;
const TYPE_TRAP = 0x4;
/** Pendulum Monster: doubles as a Spell in a Pendulum Zone, where its Scale matters. */
const TYPE_PENDULUM = 0x1000000;
const TYPE_LABELS = [
  [0x10, "Normal"], [0x20, "Effect"], [0x40, "Fusion"], [0x80, "Ritual"], [0x100, "Trap Monster"],
  [0x200, "Spirit"], [0x400, "Union"], [0x800, "Gemini"], [0x1000, "Tuner"], [0x2000, "Synchro"],
  [0x4000, "Token"], [0x10000, "Quick-Play"], [0x20000, "Continuous"], [0x40000, "Equip"],
  [0x80000, "Field"], [0x100000, "Counter"], [0x200000, "Flip"], [0x400000, "Toon"], [0x800000, "Xyz"],
  [TYPE_PENDULUM, "Pendulum"], [TYPE_LINK, "Link"],
];
/**
 * Monster type bits that force a card into the Extra Deck rather than the Main
 * Deck: Fusion (0x40), Synchro (0x2000), Xyz (0x800000), Link (0x4000000). A
 * card with any of these bits is illegal in `main` and must live in `extra`.
 */
export const EXTRA_DECK_TYPES = 0x40 | 0x2000 | 0x800000 | 0x4000000;
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
 * Query. Does this card belong in the Extra Deck? True for Fusion/Synchro/Xyz/
 * Link monsters (see EXTRA_DECK_TYPES), which the core keeps in OcgLocation.EXTRA
 * and which are illegal in a deck's `main`.
 *
 * Args:
 *     code (number): Card passcode.
 *
 * Returns:
 *     boolean
 *
 * Throws:
 *     Error: if the passcode is absent from the database (a deck typo must fail).
 *
 * Examples:
 *     >>> isExtraDeckCard(63519819) // true   (Thousand-Eyes Restrict, a Fusion)
 *     >>> isExtraDeckCard(89631139) // false  (Blue-Eyes White Dragon, a Normal Monster)
 */
export function isExtraDeckCard(code) {
  const info = cardInfo(code);
  if (!info) throw new Error(`unknown passcode: ${code}`);
  return (info.type & EXTRA_DECK_TYPES) !== 0;
}

/**
 * Query. Is this a Pendulum Monster — i.e. a card that can sit in a Pendulum
 * Zone as a scale? Its Pendulum Scale is then the only stat that matters, so
 * every renderer that shows such a card must show `scaleText` beside it.
 *
 * Args:
 *     code (number): Passcode (0 or unknown gives false).
 *
 * Returns:
 *     boolean
 *
 * Examples:
 *     >>> isPendulumMonster(16178681) // true   (Odd-Eyes Pendulum Dragon)
 *     >>> isPendulumMonster(89631139) // false  (Blue-Eyes White Dragon)
 *     >>> isPendulumMonster(0)        // false
 */
export function isPendulumMonster(code) {
  return ((cardInfo(code)?.type ?? 0) & TYPE_PENDULUM) !== 0;
}

/**
 * Pure function. A Pendulum Monster's scale as text. Every card in cards.cdb
 * prints the same number on both sides, so that is the usual answer; a card
 * whose sides differ is spelled out rather than silently shown as one number.
 *
 * Args:
 *     lscale (number): Left Pendulum Scale.
 *     rscale (number): Right Pendulum Scale.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> scaleText(4, 4) // "4"
 *     >>> scaleText(0, 0) // "0"
 *     >>> scaleText(4, 8) // "L4/R8"
 */
export function scaleText(lscale, rscale) {
  return lscale === rscale ? `${lscale}` : `L${lscale}/R${rscale}`;
}

/**
 * Query. Compact one-line summary of a card: what an agent needs at a glance.
 * A Pendulum Monster also shows its Scale, which decides which Levels it lets
 * you Pendulum Summon and is invisible in every other stat.
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
 *     >>> summarizeCard(16178681)
 *     "Odd-Eyes Pendulum Dragon [DARK Dragon Effect Pendulum Monster Lv7 Scale4 ATK2500 DEF2000]"
 */
export function summarizeCard(code) {
  const info = cardInfo(code);
  if (!info) return `card#${code}`;
  if (!(info.type & TYPE_MONSTER)) return `${info.name} [${typeLabel(info.type)}]`;
  const attribute = ATTRIBUTE_LABELS[info.attribute] ?? `attr#${info.attribute}`;
  const race = RACE_LABELS[info.race] ?? `race#${info.race}`;
  const scale = info.type & TYPE_PENDULUM ? ` Scale${scaleText(info.lscale, info.rscale)}` : "";
  return `${info.name} [${attribute} ${race} ${typeLabel(info.type)} Lv${info.level}${scale} ATK${info.atk} DEF${info.def}]`;
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
  return search(term, limit);
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
  return all().map((c) => ({ ...c, desc: cleanDesc(c.desc) }));
}

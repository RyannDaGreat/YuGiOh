/**
 * EDOPro system strings and effect-description decoding.
 *
 * The core never sends prose. Selection prompts ("Select the card(s) to
 * destroy"), effect names, phase names and victory reasons all arrive as
 * integer codes that EDOPro resolves through `strings.conf` plus each card's
 * own string table in cards.cdb. This module is that resolver.
 *
 * Decode rule (EDOPro `DataManager::GetDesc`, non-compat mode, core >= 10):
 *     card  = desc >> 20
 *     index = desc & 0xfffff
 *     card == 0  ->  system string `index`      (strings.conf, `!system`, decimal ids)
 *     card != 0  ->  card `card`'s string #index (cards.cdb texts.str1..str16)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, cardName, cardString } from "./cards.js";

const STRINGS_PATH = join(REPO_ROOT, "vendor/strings.conf");

/** Bit split of a description code, per EDOPro's GetDesc. */
const DESC_CARD_SHIFT = 20n;
const DESC_INDEX_MASK = 0xfffffn;

/**
 * Pure function. Parses strings.conf text into per-section lookup tables.
 *
 * Format: lines starting with `!<section> <id> <text>`; everything else is
 * ignored. `!system` ids are decimal; `!victory`, `!counter`, `!setname` ids are
 * hexadecimal — that asymmetry is EDOPro's, not ours.
 *
 * Args:
 *     text (string): Raw file contents.
 *
 * Returns:
 *     {system: Map<number,string>, victory: Map<number,string>,
 *      counter: Map<number,string>, setname: Map<number,string>}
 *
 * Examples:
 *     >>> parseStringsConf("!system 20 Draw Phase\n!victory 0x2 Cards can't be drawn\n# note").system.get(20)
 *     "Draw Phase"
 *     >>> parseStringsConf("!victory 0x2 Cards can't be drawn").victory.get(2)
 *     "Cards can't be drawn"
 */
export function parseStringsConf(text) {
  const tables = { system: new Map(), victory: new Map(), counter: new Map(), setname: new Map() };
  for (const line of text.split("\n")) {
    if (!line.startsWith("!")) continue;
    const firstSpace = line.indexOf(" ");
    const secondSpace = line.indexOf(" ", firstSpace + 1);
    if (firstSpace < 0 || secondSpace < 0) continue;
    const section = line.slice(1, firstSpace);
    const idText = line.slice(firstSpace + 1, secondSpace);
    const value = line.slice(secondSpace + 1).replace(/\r$/, "");
    if (!(section in tables)) continue;
    const id = section === "system" ? Number.parseInt(idText, 10) : Number.parseInt(idText, 16);
    tables[section].set(id, value);
  }
  return tables;
}

const TABLES = parseStringsConf(readFileSync(STRINGS_PATH, "utf8"));

/**
 * Query. System string by id (reads the loaded strings table).
 *
 * Args:
 *     id (number): `!system` id.
 *
 * Returns:
 *     string: The text, or `sys#<id>` when the id is unknown so nothing is
 *     ever silently blank.
 *
 * Examples:
 *     >>> sysString(502)    // "Select the card(s) to destroy"
 *     >>> sysString(999999) // "sys#999999"
 */
export function sysString(id) {
  return TABLES.system.get(Number(id)) ?? `sys#${id}`;
}

/**
 * Query. Victory-reason string for MSG_WIN.
 *
 * Args:
 *     reason (number): The `reason` byte of MSG_WIN.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> victoryString(1) // "LP reached 0"
 *     >>> victoryString(2) // "Cards can't be drawn"
 */
export function victoryString(reason) {
  return TABLES.victory.get(Number(reason)) ?? `victory#${reason}`;
}

/**
 * Query. Counter type name (e.g. Spell Counter) for MSG_ADD_COUNTER.
 *
 * Args:
 *     counterType (number): The counter id.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> counterName(1) // "Spell Counter"
 */
export function counterName(counterType) {
  return TABLES.counter.get(Number(counterType)) ?? `counter#${counterType}`;
}

/**
 * Query. Resolves a core description code to text.
 *
 * Args:
 *     desc (bigint|number): Description code from any core message.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> describe(502n)                        // "Select the card(s) to destroy"
 *     >>> describe(0n)                          // ""            (0 = "no description")
 *     >>> describe((89631139n << 20n) | 0n)     // Blue-Eyes White Dragon str1, or "" if that slot is empty
 */
export function describe(desc) {
  const value = BigInt(desc);
  if (value === 0n) return "";
  const card = Number(value >> DESC_CARD_SHIFT);
  const index = Number(value & DESC_INDEX_MASK);
  if (card === 0) return sysString(index);
  return cardString(card, index) ?? "";
}

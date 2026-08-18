// The tournament field: every deck in src/decks with category "structure" —
// i.e. an official Konami product (Starter Deck or Structure Deck), a fixed
// printed list. Curated/user decks are deliberately excluded.
//
// ORDER IS THE MATRIX ORDER (rows and columns), and it is Konami release order,
// so the grid reads chronologically from the 2002 Starter Decks to SDMP (2015).

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeck } from "../../../src/store.js";

const DECKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "decks");

/** Konami release order of the products in the field; anything not listed sorts last by set code. */
const RELEASE_ORDER = ["SDY", "SDK", "SDP", "SD1", "SD2", "SD3", "SD4", "SD6", "SD10", "SDSC", "SDMP"];

/**
 * Query (reads src/decks/*.json). The structure-deck field, in matrix order.
 *
 * @returns {Array<{file: string, name: string, setCode: string, format: string}>}
 *
 * @example
 * roster()[0]  // {file: "yugi", name: "Yugi", setCode: "SDY", format: "classic"}
 * roster().length  // 11
 */
export function roster() {
  const decks = readdirSync(DECKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .map((file) => ({ file, deck: loadDeck(file) }))
    .filter(({ deck }) => deck.category === "structure")
    .map(({ file, deck }) => ({ file, name: deck.name, setCode: deck.setCode, format: deck.format }));

  for (const d of decks) {
    if (!d.setCode) throw new Error(`structure deck ${d.file} has no setCode; the matrix keys on set codes`);
  }
  return decks.sort((a, b) => rank(a.setCode) - rank(b.setCode));
}

/**
 * Pure function. Position of a set code in RELEASE_ORDER; unlisted codes sort
 * after every listed one, alphabetically among themselves.
 *
 * @param {string} setCode - e.g. "SD1"
 * @returns {number}
 *
 * @example rank("SDY")  // 0
 * @example rank("SDMP") // 10
 */
function rank(setCode) {
  const i = RELEASE_ORDER.indexOf(setCode);
  return i === -1 ? RELEASE_ORDER.length : i;
}

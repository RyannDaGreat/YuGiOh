/**
 * Per-player card sleeves (card-back themes). Pure presentation: keyed by the
 * player label used in duel records ("ryan", "claude", ...), stored in
 * web/data/sleeves.json so the engine's duel records stay cosmetics-free.
 */
import { base } from "$app/paths";
import { REPO_ROOT } from "../../../src/store.js";
import { existsSync, join, mkdirSync, readFileSync, writeFileSync } from "../../../src/volume.js";

// Both live on the app volume (src/volume.js), so a static build keeps a player's
// sleeve choice in the browser's own storage exactly as Node keeps it on disk.
const STORE = join(REPO_ROOT, "web/data/sleeves.json");
const MANIFEST = join(REPO_ROOT, "web/static/img/sleeves/manifest.json");
/** Sleeve used when a player has not chosen one. */
export const DEFAULT_SLEEVE = "default";

/**
 * Query. Available sleeves from the manifest, plus the built-in default back.
 *
 * Returns:
 *     Array<{id, name, file}>  (file is relative to /img/)
 */
export function listSleeves() {
  const base = [{ id: DEFAULT_SLEEVE, name: "Dark Cosmic (default)", file: "card-back.png" }];
  if (!existsSync(MANIFEST)) return base;
  const extra = JSON.parse(readFileSync(MANIFEST, "utf8")).map((s) => ({ id: s.id, name: s.name, file: `sleeves/${s.file}` }));
  return [...base, ...extra];
}

/**
 * Query. Sleeve choices by player label.
 *
 * Returns:
 *     Record<string, string>  label -> sleeve id
 */
export function loadChoices() {
  return existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {};
}

/**
 * Command. Records a player's sleeve choice.
 *
 * Args:
 *     player (string): Player label.
 *     sleeve (string): Sleeve id from listSleeves().
 */
export function chooseSleeve(player, sleeve) {
  if (!listSleeves().some((s) => s.id === sleeve)) throw new Error(`unknown sleeve: ${sleeve}`);
  const choices = { ...loadChoices(), [player]: sleeve };
  mkdirSync(STORE.slice(0, STORE.lastIndexOf("/")), { recursive: true });
  writeFileSync(STORE, JSON.stringify(choices, null, 2));
}

/**
 * Query. Back image URL for each seat of a duel.
 *
 * Args:
 *     players ([string, string]): Player labels.
 *
 * Returns:
 *     [string, string]  URLs under /img/
 */
export function seatBacks(players) {
  const sleeves = listSleeves();
  const choices = loadChoices();
  return players.map((label) => {
    const chosen = sleeves.find((s) => s.id === (choices[label] ?? DEFAULT_SLEEVE)) ?? sleeves[0];
    return `${base}/img/${chosen.file}`;
  });
}

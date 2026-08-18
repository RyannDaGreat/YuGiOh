/**
 * Export and import the app's entire state as one portable file.
 *
 * "State" is everything the app itself created and would be sad to lose: the
 * duel records, the chat log beside each one, and the decks. It is deliberately
 * NOT the card database, the card scripts or the art — those are large, are
 * re-fetchable, and are identical for everyone.
 *
 * Because it reads and writes through `volume.js`, the same two functions serve
 * both hosts: from Node they move real files under the repo, and from a static
 * page they move entries in the browser's own filesystem. An archive taken from
 * one imports cleanly into the other, which is the whole point — you can play in
 * the browser, export, and carry the duels back to the CLI.
 *
 * Format: `{version, exportedAt, files: {repoRelativePath: contents}}` — a plain
 * JSON object, so it diffs, greps and gzips like anything else.
 */

import { DECKS_DIR, DUELS_DIR, REPO_ROOT } from "./store.js";
import { existsSync, join, mkdirSync, readdirSync, readFileSync, writeFileSync } from "./volume.js";

/** Bump when the shape changes incompatibly; `importArchive` refuses newer ones. */
export const ARCHIVE_VERSION = 1;

/**
 * The directories that make up the app's own state. Card data, scripts and art
 * are excluded on purpose: they are bulky, identical everywhere, and rebuilt by
 * `setup.sh` (Node) or fetched by the page (browser).
 */
const STATE_DIRS = [DUELS_DIR, DECKS_DIR];

/** Pure function. Strips REPO_ROOT so archive paths are host-independent. */
const relative = (path) => String(path).slice(REPO_ROOT.length).replace(/^\//, "");

/**
 * Query. Every state file as `{repoRelativePath: contents}`.
 *
 * Recurses one level, which is all the state tree ever uses, and skips the
 * `.presence` heartbeat directory — that is live runtime chatter about who is
 * sitting at a table, meaningless once exported.
 *
 * Args:
 *     dirs (string[]): Directories to walk. Defaults to the state dirs.
 *
 * Returns:
 *     object: `{path: contents}`, sorted by path so archives are reproducible.
 *
 * Examples:
 *     >>> Object.keys(collectState())[0]     // "duels/duel1.chat.json"
 */
export function collectState(dirs = STATE_DIRS) {
  const files = {};
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const path = join(dir, name);
      let contents;
      try {
        contents = readFileSync(path, "utf8");
      } catch {
        continue; // a directory, not a file — the state tree has no nested dirs
      }
      files[relative(path)] = contents;
    }
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Query. The whole app state as one archive object, ready to be stringified.
 *
 * Args:
 *     now (string): ISO timestamp to stamp the archive with.
 *
 * Returns:
 *     {version: number, exportedAt: string, files: object}
 *
 * Examples:
 *     >>> const a = exportArchive("2026-08-17T12:00:00.000Z")
 *     >>> a.version                          // 1
 *     >>> typeof a.files["duels/duel1.json"] // "string"
 */
export function exportArchive(now = new Date().toISOString()) {
  return { version: ARCHIVE_VERSION, exportedAt: now, files: collectState() };
}

/**
 * Command. Writes an archive's files into the volume.
 *
 * Every path is validated against the state directories before anything is
 * written, so a hand-edited archive cannot drop a file outside `duels/` or the
 * deck directory. Validation happens up front: either the whole archive applies
 * or nothing does.
 *
 * Args:
 *     archive (object): As produced by `exportArchive`.
 *     replace (boolean): When true, existing files are overwritten. When false
 *         (the default), a path that already exists is skipped, so importing
 *         someone else's duels never clobbers your own.
 *
 * Returns:
 *     {written: string[], skipped: string[]}
 *
 * Throws:
 *     Error: on a newer archive version, a malformed archive, or a path that
 *     escapes the state directories.
 *
 * Examples:
 *     >>> importArchive({version: 1, files: {"duels/g1.json": "{}"}})
 *     {written: ["duels/g1.json"], skipped: []}
 */
export function importArchive(archive, replace = false) {
  if (!archive || typeof archive !== "object" || typeof archive.files !== "object") {
    throw new Error("not an archive: expected {version, files}");
  }
  if (Number(archive.version) > ARCHIVE_VERSION) {
    throw new Error(`archive version ${archive.version} is newer than this build understands (${ARCHIVE_VERSION})`);
  }
  const allowed = STATE_DIRS.map((d) => relative(d));
  for (const path of Object.keys(archive.files)) {
    if (path.includes("..") || !allowed.some((dir) => path.startsWith(`${dir}/`))) {
      throw new Error(`archive path outside the state directories: ${JSON.stringify(path)}`);
    }
  }
  const written = [];
  const skipped = [];
  for (const [path, contents] of Object.entries(archive.files)) {
    const full = join(REPO_ROOT, path);
    if (!replace && existsSync(full)) {
      skipped.push(path);
      continue;
    }
    mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true });
    writeFileSync(full, contents);
    written.push(path);
  }
  return { written, skipped };
}

/**
 * The Node backing store for `volume.js`: real files on real disk.
 *
 * Importing this module installs it, so every Node entry point (the CLI, the
 * web server, the tests) does `import "./volume-node.js"` exactly once and every
 * `store`/`chat`/`presence` call below it lands on the filesystem as before.
 * A browser build never imports this file, which is what keeps `node:fs` out of
 * the bundle entirely.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { setVolume } from "./volume.js";

/**
 * Command. Installs the real filesystem as the app's volume. Idempotent.
 *
 * Returns:
 *     void
 *
 * Examples:
 *     >>> installNodeVolume(); readFileSync("package.json", "utf8").length > 0   // true
 */
export function installNodeVolume() {
  setVolume({ existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync });
}

installNodeVolume();

/**
 * The filesystem the app's own state lives on — duel records, chat logs, decks.
 *
 * ==========================================================================
 * ONE INTERFACE, TWO HOSTS.
 * ==========================================================================
 * Served from Node, state lives in real files under the repo. Served as a
 * static page, there is no server and no disk — but a browser has its own
 * private filesystem (OPFS, with IndexedDB as the fallback), so the same idea
 * still holds: a tree of paths holding bytes.
 *
 * This module is that tree, as the six synchronous calls `store.js`,
 * `chat.js` and `presence.js` actually use. Swapping the backend is the ONLY
 * difference between the two hosts; every line of game logic above it is
 * shared verbatim.
 *
 * **Staying synchronous is the whole trick.** OPFS and IndexedDB are async,
 * and every caller in this codebase is sync. Rather than colour the entire
 * call graph async, the browser backend keeps the whole volume in memory
 * (the app's full state is on the order of a megabyte) and writes through to
 * persistent storage in the background. Reads never wait; a refresh restores
 * the tree it hydrated from.
 *
 * Paths are plain "/"-separated strings. There is no cwd and no symlink
 * resolution — this is a flat map that pretends to have directories, which is
 * all the callers ever needed.
 */

/** Thrown instead of silently pretending a missing volume is an empty one. */
const NO_VOLUME = "no volume installed: import volume-node.js (Node) or install a browser volume first";

/** @type {null | {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync}} */
let backend = null;

/**
 * Command. Installs the backing store. Call exactly once at startup, before any
 * duel is read or written.
 *
 * Args:
 *     v (object): An object providing the six calls this module re-exports.
 *
 * Returns:
 *     void
 *
 * Examples:
 *     >>> setVolume(memoryVolume({"duels/a.json": "{}"}))
 *     >>> readFileSync("duels/a.json", "utf8")   // "{}"
 */
export function setVolume(v) {
  backend = v;
}

/**
 * Query. The installed backend, or throws if there is none.
 *
 * Returns:
 *     object
 *
 * Examples:
 *     >>> setVolume(memoryVolume()); typeof currentVolume().readFileSync   // "function"
 */
export function currentVolume() {
  if (!backend) throw new Error(NO_VOLUME);
  return backend;
}

export const existsSync = (p) => currentVolume().existsSync(p);
export const mkdirSync = (p, o) => currentVolume().mkdirSync(p, o);
export const readdirSync = (p) => currentVolume().readdirSync(p);
export const readFileSync = (p, e) => currentVolume().readFileSync(p, e);
export const renameSync = (a, b) => currentVolume().renameSync(a, b);
export const writeFileSync = (p, d) => currentVolume().writeFileSync(p, d);

/** Normalises a path to the flat map's key form: no leading "./", no trailing "/". */
const key = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");

/** The directory part of a path, or "" for a top-level entry. */
const dirOf = (p) => (key(p).includes("/") ? key(p).slice(0, key(p).lastIndexOf("/")) : "");

/**
 * Pure function. An in-memory volume — the browser's backing store, and the
 * one tests use so they never touch disk.
 *
 * Directories are implied by the paths present rather than stored, so mkdirSync
 * is a no-op and readdirSync lists the immediate children of a prefix.
 *
 * Args:
 *     files (object): Optional initial `{path: contents}` map.
 *     onChange (function): Optional callback after every mutation, for a backend
 *         that persists asynchronously. Receives the whole `{path: contents}` map.
 *
 * Returns:
 *     object: A volume implementing the six calls.
 *
 * Examples:
 *     >>> const v = memoryVolume({"duels/g1.json": "{\"id\":1}"})
 *     >>> v.existsSync("duels/g1.json")     // true
 *     >>> v.readdirSync("duels")            // ["g1.json"]
 *     >>> v.writeFileSync("duels/g2.json", "{}"); v.readdirSync("duels").length   // 2
 */
export function memoryVolume(files = {}, onChange = () => {}) {
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  const touched = () => onChange(Object.fromEntries(map));
  return {
    existsSync: (p) => map.has(key(p)) || [...map.keys()].some((k) => k.startsWith(key(p) + "/")),
    mkdirSync: () => {},
    readdirSync: (p) => {
      const prefix = key(p) === "" ? "" : key(p) + "/";
      const names = new Set();
      for (const k of map.keys()) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (rest) names.add(rest.split("/")[0]);
      }
      return [...names];
    },
    readFileSync: (p) => {
      const v = map.get(key(p));
      if (v === undefined) throw Object.assign(new Error(`ENOENT: no such file, open '${p}'`), { code: "ENOENT" });
      return v;
    },
    renameSync: (a, b) => {
      map.set(key(b), map.get(key(a)));
      map.delete(key(a));
      touched();
    },
    writeFileSync: (p, d) => {
      map.set(key(p), typeof d === "string" ? d : String(d));
      touched();
    },
    /** Not part of the six; used by export/import and by the persistence backends. */
    snapshot: () => Object.fromEntries(map),
    dirOf,
  };
}

/**
 * Pure function. Joins path segments with "/", the only separator this volume
 * knows. Replaces node:path's `join` so the same code runs in a browser, where
 * there is no node:path and no platform-specific separator to care about.
 *
 * Args:
 *     ...parts (string): Segments; empty ones are skipped.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> join("duels", "g1.json")            // "duels/g1.json"
 *     >>> join("", "duels", "", "g1.json")    // "duels/g1.json"
 *     >>> join("/repo", "duels/")             // "/repo/duels"
 */
export function join(...parts) {
  const joined = parts.filter((p) => p !== "" && p !== undefined && p !== null).join("/");
  return joined.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
}

/**
 * Query. A random id, from the Web Crypto API that Node 19+ and every browser
 * both expose on `globalThis` — so this needs no node:crypto import.
 *
 * Returns:
 *     string: A UUID v4.
 *
 * Examples:
 *     >>> randomId().length   // 36
 */
export function randomId() {
  return globalThis.crypto.randomUUID();
}

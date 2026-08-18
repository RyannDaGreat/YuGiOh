/**
 * The browser backing store for `volume.js`: the Origin Private File System.
 *
 * OPFS is a real, private, persistent filesystem the browser gives every origin
 * — directories and files, not key/value soup — so the app's state tree mirrors
 * into it exactly as it sits on disk under Node. Refreshing the page restores
 * the duels because they were never in page memory alone.
 *
 * Two details make this work against a synchronous volume API:
 *
 *  1. **Hydrate once, serve from memory.** OPFS is async and every caller in
 *     this codebase is sync, so `openBrowserVolume` reads the whole tree up
 *     front (the state is well under a megabyte) into a `memoryVolume`. Reads
 *     never wait.
 *  2. **Write through, diffed and debounced.** Each mutation schedules a flush
 *     that writes only the files whose contents actually changed, and deletes
 *     the ones that vanished. A burst of writes during one move collapses into
 *     a single flush.
 *
 * If OPFS is missing (older Safari, some private modes) the same snapshot is
 * kept in IndexedDB instead — one record holding the tree. The volume API above
 * is identical either way; only durability characteristics differ.
 */

import { memoryVolume, setVolume } from "./volume.js";

/** Coalesce a burst of writes from one move into a single flush. */
const FLUSH_DEBOUNCE_MS = 150;
/** IndexedDB names used only by the fallback path. */
const DB_NAME = "ygo-volume";
const STORE_NAME = "snapshot";
const SNAPSHOT_KEY = "state";

/** Query. Whether this browser exposes OPFS. */
const hasOPFS = () => typeof navigator !== "undefined" && Boolean(navigator.storage?.getDirectory);

/** Command. Resolves the directory handle for a path's parent, creating it. */
async function parentDir(root, path) {
  const parts = path.split("/");
  let dir = root;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
  return { dir, name: parts.at(-1) };
}

/** Query. Every file under an OPFS directory as `{path: contents}`. */
async function readTree(dir, prefix = "") {
  const files = {};
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") Object.assign(files, await readTree(handle, path));
    else files[path] = await (await handle.getFile()).text();
  }
  return files;
}

/** Command. Applies a snapshot diff to OPFS: writes changed files, removes vanished ones. */
async function writeTree(root, next, previous) {
  for (const [path, contents] of Object.entries(next)) {
    if (previous[path] === contents) continue;
    const { dir, name } = await parentDir(root, path);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
  }
  for (const path of Object.keys(previous)) {
    if (path in next) continue;
    const { dir, name } = await parentDir(root, path);
    await dir.removeEntry(name).catch(() => {});
  }
}

/** Query. Opens (or creates) the fallback IndexedDB store. */
const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Query. The snapshot stored in IndexedDB, or `{}`. */
async function readDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    request.onsuccess = () => resolve(request.result ?? {});
    request.onerror = () => reject(request.error);
  });
}

/** Command. Replaces the IndexedDB snapshot. */
async function writeDB(files) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(files, SNAPSHOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Command. Hydrates the app's state from browser storage and installs it as the
 * volume. Call once, and await it, before reading or writing any duel.
 *
 * Args:
 *     onError (function): Called with any flush failure. Persistence happens
 *         after the fact, so a failure cannot be thrown at the caller — it must
 *         be surfaced, never swallowed.
 *
 * Returns:
 *     Promise<{backend: string, files: number, flush: function}>: `flush` awaits
 *     any pending write, for tests and for beforeunload.
 *
 * Examples:
 *     >>> // await openBrowserVolume()   // {backend: "opfs", files: 64, flush: [Function]}
 */
/** The flush of the currently open browser volume, or a no-op before one is open. */
let currentFlush = async () => {};

/**
 * Command. Waits until everything written to the browser volume so far is on
 * disk. Callers that are about to navigate (create a duel, then open it) must
 * await this: writes are debounced, and a page unload cannot wait for an async
 * OPFS write, so without it a fast navigation can lose the last write.
 *
 * Returns:
 *     Promise<void>
 *
 * Examples:
 *     >>> // saveDuel(duel); await flushBrowserVolume(); location.href = "/duel/x"   // safe
 */
export function flushBrowserVolume() {
  return currentFlush();
}

export async function openBrowserVolume(onError = (e) => console.error("volume flush failed:", e)) {
  const opfs = hasOPFS();
  const root = opfs ? await navigator.storage.getDirectory() : null;
  let persisted = opfs ? await readTree(root) : await readDB();

  let timer = null;
  let inFlight = Promise.resolve();
  let pending = null;

  const flushNow = async () => {
    const next = pending;
    pending = null;
    if (!next) return;
    if (opfs) await writeTree(root, next, persisted);
    else await writeDB(next);
    persisted = next;
  };

  const schedule = (files) => {
    pending = files;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      inFlight = inFlight.then(flushNow).catch(onError);
    }, FLUSH_DEBOUNCE_MS);
  };

  const volume = memoryVolume(persisted, schedule);
  setVolume(volume);

  /** Command. Awaits any pending flush — call before unload, and in tests. */
  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      inFlight = inFlight.then(flushNow);
    }
    await inFlight;
  };

  currentFlush = flush;
  if (typeof addEventListener === "function") addEventListener("beforeunload", () => { void flush(); });

  return { backend: opfs ? "opfs" : "indexeddb", files: Object.keys(persisted).length, flush, volume };
}

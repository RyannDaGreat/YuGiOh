/**
 * The one seam between the pages and the engine.
 *
 * Every page calls these functions and nothing else. On the Node host each one
 * is a fetch to the matching /api route; on the static host each one calls
 * $lib/engine.js directly, in the browser, after $lib/boot.js has installed the
 * browser volume and card source. The pages cannot tell the difference — which
 * is the point: one UI, two hosts, zero duplicated page logic.
 *
 * `fetch` may be passed in by SvelteKit `load` functions (their fetch resolves
 * relative URLs during SSR); everywhere else the global one is used.
 */
import { base } from "$app/paths";
import { boot } from "./boot.js";
import { STATIC } from "./host.js";

/**
 * The in-browser engine, booted. Only ever evaluated on the static host, so the
 * Node build's client bundle never pulls in the WASM core. Awaiting boot() HERE
 * — not only in +layout.js — matters: SvelteKit runs layout and page loads in
 * parallel, so a page can reach the engine before the layout's boot resolves.
 * boot() is memoised, so this costs nothing after the first call.
 */
const engine = async () => {
  await boot();
  return import("./engine.js");
};

/** Command. GETs JSON from an /api route, throwing on a non-2xx status. */
async function getJson(fetchFn, path) {
  const res = await fetchFn(`${base}/api${path}`);
  if (!res.ok) throw new Error((await res.text()) || `${path}: HTTP ${res.status}`);
  return res.json();
}

/** Command. POSTs JSON to an /api route; resolves the parsed body even on 4xx so callers see `{ok:false, error}`. */
async function postJson(fetchFn, path, body) {
  const res = await fetchFn(`${base}/api${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const parsed = await res.json().catch(() => ({}));
  if (!res.ok && parsed.ok === undefined) throw new Error(parsed.message ?? parsed.error ?? `${path}: HTTP ${res.status}`);
  return parsed;
}

/**
 * Query. One duel as a viewer sees it (see engine.duelPayload).
 *
 * Args:
 *     id (string): Duel id.
 *     as (string): "0", "1" or "all".
 *     at (number|undefined): Replay position, or undefined for live.
 *     fetchFn (function): fetch to use (SvelteKit's inside load).
 *
 * Returns:
 *     Promise<object>: The duel payload.
 *
 * Examples:
 *     >>> // (await getDuel("duel1", "all")).players   // ["ryan", "claude"]
 */
export async function getDuel(id, as, at, fetchFn = fetch) {
  if (STATIC) {
    const e = await engine();
    return e.duelPayload(id, e.parseViewer(as), at);
  }
  return getJson(fetchFn, `/duel/${id}?as=${as}${at === undefined ? "" : `&at=${at}`}`);
}

/**
 * Command. Answers the pending menu for a seat.
 *
 * Returns:
 *     Promise<{ok, chosenLabel?, newLogLines?, next?, error?}>
 */
export async function play(id, as, choice) {
  if (STATIC) {
    const e = await engine();
    try {
      const player = e.parseViewer(as);
      if (player === 2) throw new Error("spectators cannot play");
      const r = await e.play(id, player, String(choice));
      return { ok: true, chosenLabel: r.chosenLabel, newLogLines: r.newLogLines, next: r.next };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return postJson(fetch, `/duel/${id}`, { as, choice });
}

/** Command. Branches a duel at a move under a new id. Returns `{ok, id?, error?}`. */
export async function fork(id, newId, at) {
  if (STATIC) {
    const e = await engine();
    try {
      return { ok: true, id: e.fork(id, String(newId), Number(at)).id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return postJson(fetch, `/duel/${id}`, { fork: newId, at });
}

/** Command. Posts a table-chat line as a seat (2 = spectator). Returns `{ok, message?, error?}`. */
export async function sendChat(id, as, text) {
  if (STATIC) {
    const e = await engine();
    try {
      return { ok: true, message: e.sendChat(id, e.parseViewer(as), String(text)) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return postJson(fetch, `/duel/${id}/chat`, { as, text });
}

/** Query. Full card text for the preview panel, by exact name. */
export async function getCard(name, fetchFn = fetch) {
  if (STATIC) return (await engine()).cardText(name);
  return getJson(fetchFn, `/card?name=${encodeURIComponent(name)}`);
}

/** Query. `{sleeves, choices}` for the sleeve picker. */
export async function getSleeves(fetchFn = fetch) {
  if (STATIC) {
    await boot();
    const s = await import("./sleeves.js");
    return { sleeves: s.listSleeves(), choices: s.loadChoices() };
  }
  return getJson(fetchFn, "/sleeves");
}

/** Command. Records a player's sleeve choice. */
export async function setSleeve(player, sleeve) {
  if (STATIC) {
    await boot();
    const s = await import("./sleeves.js");
    s.chooseSleeve(player, sleeve);
    return { ok: true };
  }
  return postJson(fetch, "/sleeves", { player, sleeve });
}

/**
 * Query. What the home page needs: every duel summarised, the deck library, and
 * on the Node host nothing else. Mirrors what +page.server.js used to load.
 */
export async function getHome(fetchFn = fetch) {
  if (STATIC) {
    const e = await engine();
    return { duels: await e.duelSummaries(), library: e.deckLibrary() };
  }
  return getJson(fetchFn, "/home");
}

/** Command. Creates a duel. Returns `{ok, id?, error?}`. */
export async function newDuel(spec) {
  if (STATIC) {
    const e = await engine();
    try {
      return { ok: true, id: e.newDuel(spec).id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return postJson(fetch, "/duel", spec);
}

/** Query. The deck library (deck browser index). */
export async function getDeckLibrary(fetchFn = fetch) {
  if (STATIC) return (await engine()).deckLibrary();
  return getJson(fetchFn, "/decks");
}

/** Query. One deck in full, or throws if unknown. */
export async function getDeck(id, fetchFn = fetch) {
  if (STATIC) return (await engine()).deckDetail(id);
  return getJson(fetchFn, `/decks/${encodeURIComponent(id)}`);
}

/**
 * Query. The whole app state as an archive object (src/archive.js). The static
 * host serialises it in the page; the Node host streams it from /api/archive.
 */
export async function getArchive() {
  if (STATIC) {
    await boot();
    return (await import("../../../src/archive.js")).exportArchive();
  }
  const res = await fetch(`${base}/api/archive`);
  if (!res.ok) throw new Error(`export failed (${res.status})`);
  return res.json();
}

/** Command. Restores an archive. Returns `{ok, written, skipped, skippedNames}`. */
export async function importArchive(archive, replace) {
  if (STATIC) {
    await boot();
    const a = await import("../../../src/archive.js");
    const { written, skipped } = a.importArchive(archive, Boolean(replace));
    // Persisted through the volume; a page reload will show it.
    return { ok: true, written: written.length, skipped: skipped.length, skippedNames: skipped.slice(0, 10) };
  }
  return postJson(fetch, "/archive", { archive, replace });
}

/** Query. Who sits at each seat (src/ai/seats.js): `{0: Seat, 1: Seat}`. */
export async function getSeats(id, fetchFn = fetch) {
  if (STATIC) {
    await boot();
    return (await import("../../../src/ai/seats.js")).loadSeats(id);
  }
  return getJson(fetchFn, `/duel/${id}/seats`);
}

/** Command. Records both seats' assignments. Returns `{ok, error?}`. */
export async function setSeats(id, seats) {
  if (STATIC) {
    await boot();
    try {
      (await import("../../../src/ai/seats.js")).saveSeats(id, seats);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return postJson(fetch, `/duel/${id}/seats`, { seats });
}

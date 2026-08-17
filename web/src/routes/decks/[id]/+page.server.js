/**
 * One deck's detail page: its full main/extra/side lists (with art passcodes)
 * and pilot manual, from engine.deckDetail. A bad id 404s with the loader's
 * own message rather than a blank page.
 */
import { error } from "@sveltejs/kit";
import { deckDetail } from "$lib/server/engine.js";

export function load({ params, url }) {
  try {
    // `?seat=1` (set by the home P1 preview link) makes "Play this deck" fill the
    // P1 slot instead of always P0 — so the deck lands on the seat you came from.
    const seat = url.searchParams.get("seat") === "1" ? 1 : 0;
    return { id: params.id, seat, deck: deckDetail(params.id) };
  } catch (err) {
    error(404, err.message);
  }
}

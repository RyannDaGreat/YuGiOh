/** One deck in full. */
import { error } from "@sveltejs/kit";
import { getDeck } from "$lib/api.js";

export async function load({ params, url, fetch }) {
  try {
    // `?seat=1` (set by the home P1 preview link) makes "Play this deck" fill the
    // P1 slot instead of always P0 — so the deck lands on the seat you came from.
    const seat = url.searchParams.get("seat") === "1" ? 1 : 0;
    return { id: params.id, seat, deck: await getDeck(params.id, fetch) };
  } catch (err) {
    error(404, err.message);
  }
}

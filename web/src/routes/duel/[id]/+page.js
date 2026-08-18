/** Duel page: initial view for the requested seat; the page then polls through $lib/api.js. */
import { error } from "@sveltejs/kit";
import { getDuel, getSeats } from "$lib/api.js";

export async function load({ params, url, fetch }) {
  try {
    const [initial, seats] = await Promise.all([
      getDuel(params.id, url.searchParams.get("as") ?? "all", undefined, fetch),
      getSeats(params.id, fetch),
    ]);
    return { initial, seats };
  } catch (err) {
    error(404, err.message);
  }
}

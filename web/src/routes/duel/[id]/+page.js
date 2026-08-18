/** Duel page: initial view for the requested seat; the page then polls through $lib/api.js. */
import { error } from "@sveltejs/kit";
import { getDuel } from "$lib/api.js";

export async function load({ params, url, fetch }) {
  try {
    return { initial: await getDuel(params.id, url.searchParams.get("as") ?? "all", undefined, fetch) };
  } catch (err) {
    error(404, err.message);
  }
}

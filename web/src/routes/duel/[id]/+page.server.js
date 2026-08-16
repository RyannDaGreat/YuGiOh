/** Duel page: initial view for the requested seat; the page then polls the API. */
import { error } from "@sveltejs/kit";
import { duelPayload, parseViewer } from "$lib/server/engine.js";

export async function load({ params, url }) {
  try {
    return { initial: await duelPayload(params.id, parseViewer(url.searchParams.get("as") ?? "all")) };
  } catch (err) {
    error(404, err.message);
  }
}

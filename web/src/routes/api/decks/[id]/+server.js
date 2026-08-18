/** One deck in full. Node host only; the static host calls the engine directly ($lib/api.js). */
import { error, json } from "@sveltejs/kit";
import { deckDetail } from "$lib/engine.js";

export function GET({ params }) {
  try {
    return json(deckDetail(params.id));
  } catch (err) {
    error(404, err.message);
  }
}

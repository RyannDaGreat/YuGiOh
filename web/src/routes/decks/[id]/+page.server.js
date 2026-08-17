/**
 * One deck's detail page: its full main/extra/side lists (with art passcodes)
 * and pilot manual, from engine.deckDetail. A bad id 404s with the loader's
 * own message rather than a blank page.
 */
import { error } from "@sveltejs/kit";
import { deckDetail } from "$lib/server/engine.js";

export function load({ params }) {
  try {
    return { id: params.id, deck: deckDetail(params.id) };
  } catch (err) {
    error(404, err.message);
  }
}

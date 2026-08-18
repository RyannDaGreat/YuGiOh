/** Card text lookup for tooltips. */
import { error, json } from "@sveltejs/kit";
import { cardText } from "$lib/engine.js";

export function GET({ url }) {
  const name = url.searchParams.get("name");
  if (!name) error(400, "name required");
  try {
    return json(cardText(name));
  } catch (err) {
    error(404, err.message);
  }
}

/** The deck library index. Node host only; the static host calls the engine directly ($lib/api.js). */
import { json } from "@sveltejs/kit";
import { deckLibrary } from "$lib/engine.js";

export function GET() {
  return json(deckLibrary());
}

/** What the home page needs: duel summaries and the deck library. Node host only; the static host calls the engine directly ($lib/api.js). */
import { json } from "@sveltejs/kit";
import { deckLibrary, duelSummaries } from "$lib/engine.js";

export async function GET() {
  return json({ duels: await duelSummaries(), library: deckLibrary() });
}

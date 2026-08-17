/**
 * Index page: the duel history (every stored duel, in progress and finished,
 * with when it was played and how much was said) and the create form.
 */
import { fail, redirect } from "@sveltejs/kit";
import { duelSummaries, listDecks, newDuel } from "$lib/server/engine.js";

export async function load() {
  return { duels: await duelSummaries(), decks: listDecks() };
}

export const actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    try {
      const duel = newDuel({
        id: String(form.get("id") ?? "").trim(),
        p0: String(form.get("p0")),
        p1: String(form.get("p1")),
        seed: String(form.get("seed") ?? "").trim(),
        players: [String(form.get("player0") || "P0"), String(form.get("player1") || "P1")],
      });
      redirect(303, `/duel/${duel.id}?as=0`);
    } catch (err) {
      if (err?.status === 303) throw err;
      return fail(400, { error: err.message });
    }
  },
};

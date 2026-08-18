/** Create a duel. Node host only; the static host calls engine.newDuel directly ($lib/api.js). */
import { json } from "@sveltejs/kit";
import { newDuel } from "$lib/engine.js";

export async function POST({ request }) {
  const spec = await request.json();
  try {
    return json({ ok: true, id: newDuel(spec).id });
  } catch (err) {
    return json({ ok: false, error: err.message }, { status: 400 });
  }
}

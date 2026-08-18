/** Seat assignments (human / AI) for one duel — GET reads, POST records. Node host only; the static host calls src/ai/seats.js directly ($lib/api.js). */
import { json } from "@sveltejs/kit";
import { loadSeats, saveSeats } from "../../../../../../../src/ai/seats.js";

export function GET({ params }) {
  return json(loadSeats(params.id));
}

export async function POST({ params, request }) {
  const body = await request.json();
  try {
    saveSeats(params.id, body.seats);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, { status: 400 });
  }
}

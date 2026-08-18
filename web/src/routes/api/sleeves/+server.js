/** Sleeve (card back) choices: GET the catalogue + choices; POST {player, sleeve} to choose. */
import { json } from "@sveltejs/kit";
import { chooseSleeve, listSleeves, loadChoices } from "$lib/sleeves.js";

export function GET() {
  return json({ sleeves: listSleeves(), choices: loadChoices() });
}

export async function POST({ request }) {
  const body = await request.json();
  try {
    chooseSleeve(String(body.player), String(body.sleeve));
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, { status: 400 });
  }
}

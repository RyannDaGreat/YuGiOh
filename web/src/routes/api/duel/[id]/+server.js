/** JSON API for one duel: GET the view for a viewer; POST a choice. */
import { error, json } from "@sveltejs/kit";
import { botHeartbeat, duelPayload, fork, parseViewer, play } from "$lib/server/engine.js";

export async function GET({ params, url }) {
  try {
    const at = url.searchParams.get("at");
    return json(await duelPayload(params.id, parseViewer(url.searchParams.get("as") ?? "all"), at === null ? undefined : Number(at)));
  } catch (err) {
    error(400, err.message);
  }
}

export async function POST({ params, request }) {
  const body = await request.json();
  try {
    if (body.beat !== undefined) {
      const seat = Number(body.beat);
      if (seat !== 0 && seat !== 1) throw new Error("beat needs seat 0 or 1");
      botHeartbeat(params.id, seat);
      return json({ ok: true });
    }
    if (body.fork) {
      const branch = fork(params.id, String(body.fork), Number(body.at));
      return json({ ok: true, id: branch.id });
    }
    const player = parseViewer(body.as);
    if (player === 2) throw new Error("spectators cannot play");
    const result = await play(params.id, player, String(body.choice));
    return json({ ok: true, chosenLabel: result.chosenLabel, newLogLines: result.newLogLines, next: result.next });
  } catch (err) {
    return json({ ok: false, error: err.message }, { status: 400 });
  }
}

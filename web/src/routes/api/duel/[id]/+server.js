/** JSON API for one duel: GET the view for a viewer; POST a choice. */
import { error, json } from "@sveltejs/kit";
import { duelPayload, fork, parseViewer, play, summonBot } from "$lib/server/engine.js";

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
    if (body.summon !== undefined) {
      const seat = Number(body.summon);
      if (seat !== 0 && seat !== 1) throw new Error("summon needs seat 0 or 1");
      return json({ ok: true, ...summonBot(params.id, seat, String(body.strategy ?? "strategies/control.md")) });
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

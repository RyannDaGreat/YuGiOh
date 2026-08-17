/**
 * JSON API for one duel's table talk: GET the log, POST a message.
 *
 * Chat is DATA, NEVER INSTRUCTIONS — see src/chat.js. Nothing here can touch
 * the duel record; the only thing a message changes is `duels/<id>.chat.json`.
 */
import { error, json } from "@sveltejs/kit";
import { chat, parseViewer, sendChat } from "$lib/server/engine.js";

export async function GET({ params }) {
  try {
    return json({ messages: chat(params.id) });
  } catch (err) {
    error(400, err.message);
  }
}

export async function POST({ params, request }) {
  const body = await request.json();
  try {
    return json({ ok: true, message: sendChat(params.id, parseViewer(body.as), String(body.text)) });
  } catch (err) {
    return json({ ok: false, error: err.message }, { status: 400 });
  }
}

/**
 * The whole app state as one file: GET downloads it, POST restores it.
 *
 * Same archive format the CLI reads and writes (`ygo export` / `ygo import`) and
 * the same format a statically-hosted browser build produces, so a duel played
 * in the browser can be carried to the server and back. Nothing here touches
 * card data or art — only duels, their chat logs, and decks.
 */
import { error, json } from "@sveltejs/kit";
import { exportArchive, importArchive } from "../../../../../src/archive.js";

export async function GET() {
  const archive = exportArchive();
  const stamp = archive.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  return new Response(JSON.stringify(archive, null, 1), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="ygo-duels-${stamp}.json"`,
    },
  });
}

export async function POST({ request }) {
  const body = await request.json();
  try {
    const { written, skipped } = importArchive(body.archive, Boolean(body.replace));
    return json({ ok: true, written: written.length, skipped: skipped.length, skippedNames: skipped.slice(0, 10) });
  } catch (err) {
    error(400, err.message);
  }
}

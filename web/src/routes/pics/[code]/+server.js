/** Serves cached card art from vendor/pics (see `ygo fetch-pics`). 404 when not cached. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import { REPO_ROOT } from "../../../../../src/cards.js";

/** Browser cache lifetime for art; the files never change. */
const CACHE_SECONDS = 86400;

export function GET({ params }) {
  const code = params.code.replace(/\.jpg$/, "");
  if (!/^\d+$/.test(code)) error(400, "bad code");
  const path = join(REPO_ROOT, "vendor/pics", `${code}.jpg`);
  if (!existsSync(path)) error(404, "no art cached; run `node bin/ygo.js fetch-pics`");
  return new Response(readFileSync(path), { headers: { "content-type": "image/jpeg", "cache-control": `public, max-age=${CACHE_SECONDS}` } });
}

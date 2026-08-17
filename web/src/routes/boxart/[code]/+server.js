/** Serves a Structure/Starter Deck's box cover art from vendor/boxart. 404 when not cached. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import { REPO_ROOT } from "../../../../../src/cards.js";

/** Browser cache lifetime for box art; the files never change. */
const CACHE_SECONDS = 86400;
/** Box scans come as PNG or JPG depending on the source; serve whichever is cached. */
const FORMATS = [
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
];

export function GET({ params }) {
  const code = params.code.replace(/\.(png|jpg)$/, "");
  if (!/^[A-Za-z0-9-]+$/.test(code)) error(400, "bad set code");
  for (const [ext, type] of FORMATS) {
    const path = join(REPO_ROOT, "vendor/boxart", `${code}.${ext}`);
    if (existsSync(path)) {
      return new Response(readFileSync(path), { headers: { "content-type": type, "cache-control": `public, max-age=${CACHE_SECONDS}` } });
    }
  }
  error(404, "no box art cached; run `node bin/ygo.js fetch-boxart`");
}

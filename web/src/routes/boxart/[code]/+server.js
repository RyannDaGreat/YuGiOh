/**
 * Serves a Structure/Starter Deck's box cover art from vendor/boxart.
 *
 * The path segment is the FILE NAME the deck payload carries — "SD1.png", built
 * by `boxArtFile` in src/store.js — so this host and the static host (which reads
 * the same names off the `assets` branch) are asked for the identical URL. A bare
 * set code ("SD1") is still accepted, resolved by trying each known extension,
 * because older links and hand-typed URLs look like that.
 *
 * 404 when the art is not cached; DeckThumb then falls back to the signature card.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import { REPO_ROOT } from "../../../../../src/cards.js";

/** Browser cache lifetime for box art; the files never change. */
const CACHE_SECONDS = 86400;
/** Box scans come as PNG or JPG depending on the source; serve whichever is cached. */
const MEDIA_TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export function GET({ params }) {
  const named = params.code.match(/^([A-Za-z0-9-]+)(?:\.(png|jpg|webp))?$/);
  if (!named) error(400, "bad set code");
  const [, code, ext] = named;
  for (const format of ext ? [ext] : Object.keys(MEDIA_TYPES)) {
    const path = join(REPO_ROOT, "vendor/boxart", `${code}.${format}`);
    if (existsSync(path)) {
      return new Response(readFileSync(path), { headers: { "content-type": MEDIA_TYPES[format], "cache-control": `public, max-age=${CACHE_SECONDS}` } });
    }
  }
  error(404, "no box art cached; run `node bin/ygo.js fetch-boxart`");
}

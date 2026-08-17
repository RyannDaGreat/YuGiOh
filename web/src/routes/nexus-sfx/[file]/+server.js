/**
 * Serves the Dueling Nexus duel-client sound effects from vendor/nexus/sfx/
 * (fetched by bin/fetch-nexus-sfx.sh; vendor/ is gitignored). 404 when absent,
 * which is what makes them optional: sound.js falls back to web/static/sfx/
 * and then to its synth.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import { REPO_ROOT } from "../../../../../src/cards.js";

/** Browser cache lifetime for cues; the files never change. */
const CACHE_SECONDS = 86400;
/** Basenames only — no slashes, so nothing can escape vendor/nexus/sfx/. */
const FILE_PATTERN = /^[A-Za-z0-9._-]+\.wav$/;

export function GET({ params }) {
  if (!FILE_PATTERN.test(params.file)) error(400, "bad sound name");
  const path = join(REPO_ROOT, "vendor/nexus/sfx", params.file);
  if (!existsSync(path)) error(404, "no Nexus sound cached; run `bin/fetch-nexus-sfx.sh`");
  return new Response(readFileSync(path), { headers: { "content-type": "audio/wav", "cache-control": `public, max-age=${CACHE_SECONDS}` } });
}

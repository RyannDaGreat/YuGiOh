/**
 * Server startup. On the Node host, installs the real filesystem as the app's
 * volume and SQLite as its card source (src/volume-node.js, src/cardsource-node.js)
 * once, for every server route — so no individual endpoint has to remember to.
 *
 * On the static host there is no server: the browser installs its own backends
 * from $lib/boot.js. adapter-static still evaluates this file once to render the
 * SPA fallback page, and it must not reach for SQLite or the repo then.
 */
import { STATIC } from "$lib/host.js";

if (!STATIC) {
  await import("../../src/volume-node.js");
  await import("../../src/cardsource-node.js");
}

/**
 * Which host this build runs on. One flag, read at build time, decides
 * everything that differs between the two:
 *
 *   - Node host (`vite build`, adapter-node): pages talk to /api routes, the
 *     engine runs on the server, state is files under the repo.
 *   - Static host (`VITE_STATIC=1 vite build`, adapter-static): there is no
 *     server, so the engine runs IN the browser against the browser's own
 *     filesystem (src/volume-browser.js) and card bundle (web/static/carddata).
 *
 * Nothing else in the app should read the env var directly — import STATIC.
 */
export const STATIC = import.meta.env.VITE_STATIC === "1";

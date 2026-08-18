/**
 * Server startup. Installs the real filesystem as the app's volume (src/volume.js)
 * once, for every server route — so no individual endpoint has to remember to.
 *
 * The static build has no server and therefore no hooks: it installs the browser
 * volume (src/volume-browser.js) from the client instead. That one line is the
 * entire difference between the two hosts.
 */
import "../../src/volume-node.js";

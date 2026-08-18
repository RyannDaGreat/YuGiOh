/**
 * Where the large binary assets — card art and box art — are loaded from.
 *
 * They are deliberately NOT in the main branch: 584 full-resolution card images
 * are ~84 MB, which would bloat every clone forever. They live on the orphan
 * `assets` branch (bin/publish-assets.sh) and the static site loads them from
 * there by URL. The Node host serves its own vendor/ copy through /pics and
 * /boxart, exactly as it always has.
 *
 * Every <img src> for card or box art goes through ASSETS; nothing else builds
 * those URLs.
 */
import { base } from "$app/paths";
import { STATIC } from "./host.js";

/** Raw-content URL of the assets branch; overridable per build (a fork, a mirror, a CDN). */
const ASSETS_URL = import.meta.env.VITE_ASSETS_URL ?? "https://raw.githubusercontent.com/RyannDaGreat/YuGiOh/assets";

/** URL prefix under which `/pics/<code>.jpg` and `/boxart/<code>.<ext>` resolve on this host. */
export const ASSETS = STATIC ? ASSETS_URL : base;

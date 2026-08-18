/**
 * Root layout options for both hosts.
 *
 * Node host: SSR on, pages load through the /api routes.
 * Static host: SSR off (there is no server to render on), nothing prerendered
 * (every page reads live state from the browser's own volume), and the engine
 * is booted here — once — before any page's load runs.
 */
import { boot } from "$lib/boot.js";
import { STATIC } from "$lib/host.js";

export const ssr = !STATIC;
export const prerender = false;

export async function load() {
  await boot();
  return {};
}

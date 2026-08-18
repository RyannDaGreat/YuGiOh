/** Deck browser index. */
import { getDeckLibrary } from "$lib/api.js";

export async function load({ fetch }) {
  return { library: await getDeckLibrary(fetch) };
}

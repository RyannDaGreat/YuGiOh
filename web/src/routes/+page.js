/** Home: every duel summarised, the deck library, and any ?p0=/?p1= preselect. */
import { getHome } from "$lib/api.js";

export async function load({ url, fetch }) {
  const { duels, library } = await getHome(fetch);
  return {
    duels,
    library,
    // A deck detail page's "Play this deck" link preselects a seat via ?p0=/?p1=.
    preselect: { p0: url.searchParams.get("p0"), p1: url.searchParams.get("p1") },
  };
}

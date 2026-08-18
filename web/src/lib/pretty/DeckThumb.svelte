<script>
  import { ASSETS } from "$lib/assets.js";
  /**
   * A deck's thumbnail. Official products (category "structure") show their real
   * box cover art from {ASSETS}/boxart/<file>, letterboxed in the card-shaped frame
   * so the grid stays uniform; if the box art is not cached yet it falls back to the
   * signature card. Curated/user decks always show the signature card.
   *
   * The URL carries the file's REAL extension ("SD1.png"), because on the static
   * host ASSETS points at the raw `assets` branch — a plain file server that cannot
   * resolve an extensionless "/boxart/SD1". `boxArtFile` comes from the deck payload
   * (engine.js), which derives it from the same rule `ygo fetch-boxart` saved by.
   *
   * @prop {string|null} boxArtFile     box art file name with extension, e.g. "SD1.png" (structure only)
   * @prop {number} signatureCode       passcode of the signature card (fallback / non-structure)
   * @prop {string} name                alt/title text
   * @prop {"structure"|"curated"|"user"} category
   * @prop {string} size                card-box size-class suffix: "tile" | "mini"
   */
  import CardArt from "./CardArt.svelte";

  let { boxArtFile = null, signatureCode, name = "", category, size = "tile" } = $props();

  const showBox = $derived(category === "structure" && !!boxArtFile);
  /** Flips true if the box art 404s (not fetched yet), so the signature card shows instead. */
  let boxMissing = $state(false);
</script>

{#if showBox && !boxMissing}
  <div class="relative card-box card-{size} card-back-bg overflow-hidden shadow-md border border-amber-900">
    <img
      src="{ASSETS}/boxart/{boxArtFile}"
      alt="{name} box art"
      title={name}
      class="absolute inset-0 w-full h-full object-contain"
      loading="lazy"
      onerror={() => (boxMissing = true)}
    />
  </div>
{:else}
  <CardArt code={signatureCode} {name} {size} />
{/if}

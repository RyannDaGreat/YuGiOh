<script>
  /**
   * Plain card art at a chosen box size, with the table's radial card-back as a
   * fallback when the image is missing (e.g. vendor/pics not yet fetched). The
   * card name is shown over the fallback so a deck still reads without art.
   *
   * @prop {number} code   passcode; art is served from /pics/<code>.jpg
   * @prop {string} name   alt/title text, and the fallback caption
   * @prop {string} size   card-box size-class suffix: "tile" | "zone" | "mini" | "preview"
   */
  let { code, name = "", size = "zone" } = $props();

  /** Flips true once the <img> errors, so the name-over-back fallback shows instead. */
  let broken = $state(false);
</script>

<div class="relative card-box card-{size} card-back-bg overflow-hidden shadow-md border border-amber-900">
  {#if !broken}
    <img
      src="/pics/{code}.jpg"
      alt={name}
      title={name}
      class="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
      onerror={() => (broken = true)}
    />
  {:else}
    <span class="absolute inset-0 flex items-center justify-center p-1 text-center text-[0.55rem] leading-tight text-amber-100/90 break-words">{name}</span>
  {/if}
</div>

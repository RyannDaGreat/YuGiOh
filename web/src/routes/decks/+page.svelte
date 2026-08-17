<script>
  import Icon from "@iconify/svelte";
  import cardsIcon from "@iconify-icons/mdi/cards";
  import arrowLeft from "@iconify-icons/mdi/arrow-left";
  import DeckThumb from "$lib/pretty/DeckThumb.svelte";

  let { data } = $props();

  /** Decks split into the three library sections; any may be empty. */
  const structure = $derived(data.library.filter((d) => d.category === "structure"));
  const curated = $derived(data.library.filter((d) => d.category === "curated"));
  const user = $derived(data.library.filter((d) => d.category === "user"));

  /**
   * Pure function. Badge classes for a deck's format — GOAT reads emerald,
   * classic reads sky-blue — so the ruleset is legible at a glance.
   *
   * @param {"goat"|"classic"} format
   * @returns {string} Tailwind class list
   *
   * @example formatClass("goat")    // "...emerald..."
   * @example formatClass("classic") // "...sky..."
   */
  function formatClass(format) {
    return format === "goat"
      ? "bg-emerald-900/60 text-emerald-100 border-emerald-600/50"
      : "bg-sky-900/60 text-sky-100 border-sky-600/50";
  }

  /**
   * Pure function. Human "40 main · 3 extra · 2 side" line, omitting empty
   * sections so a deck with no extra/side reads as just its main count.
   *
   * @param {{mainCount:number, extraCount:number, sideCount:number}} d
   * @returns {string}
   *
   * @example countLine({mainCount:40, extraCount:3, sideCount:0}) // "40 main · 3 extra"
   * @example countLine({mainCount:50, extraCount:0, sideCount:0}) // "50 main"
   */
  function countLine(d) {
    const parts = [`${d.mainCount} main`];
    if (d.extraCount) parts.push(`${d.extraCount} extra`);
    if (d.sideCount) parts.push(`${d.sideCount} side`);
    return parts.join(" · ");
  }
</script>

<svelte:head><title>YuGi — deck library</title></svelte:head>

{#snippet tile(d)}
  <a
    href="/decks/{d.id}"
    class="group flex flex-col gap-2 rounded-lg bg-black/40 border border-amber-900/60 p-3 hover:border-amber-500/70 hover:bg-black/60 transition-colors"
  >
    <div class="self-center transition-transform group-hover:scale-105">
      <DeckThumb setCode={d.setCode} signatureCode={d.signatureCode} name={d.name} category={d.category} size="tile" />
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="font-bold text-amber-100 leading-tight">{d.name}</span>
      <span class="shrink-0 text-[0.6rem] uppercase font-bold px-1.5 py-0.5 rounded border {formatClass(d.format)}">{d.format}</span>
    </div>
    <div class="text-amber-100/60 text-xs">{countLine(d)}</div>
  </a>
{/snippet}

{#snippet section(title, decks, emptyNote)}
  <section class="rounded-md bg-black/30 border border-amber-900/50 p-4">
    <h2 class="font-bold text-amber-200 mb-3">{title} <span class="text-amber-100/50 font-normal text-sm">({decks.length})</span></h2>
    {#if decks.length === 0}
      <p class="text-amber-100/50 text-sm">{emptyNote}</p>
    {:else}
      <div class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]">
        {#each decks as d (d.id)}{@render tile(d)}{/each}
      </div>
    {/if}
  </section>
{/snippet}

<main class="min-h-screen bg-[#120c08] text-amber-50 p-6 w-full flex flex-col gap-6">
  <header class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-amber-200 tracking-wide flex items-center gap-2">
        <Icon icon={cardsIcon} /> Deck Library
      </h1>
      <p class="text-amber-100/60 text-sm">Pick a deck to inspect its cards and pilot notes, or send it straight into a new duel.</p>
    </div>
    <a class="shrink-0 inline-flex items-center gap-1 text-amber-300 underline text-sm" href="/">
      <Icon icon={arrowLeft} /> Back to duels
    </a>
  </header>

  {@render section("Structure Decks", structure, "No structure decks found.")}
  {@render section("Curated Decks", curated, "No curated decks yet.")}
  {@render section("User Decks", user, "No user decks yet. To add your own deck, ask Claude to research and author one.")}
</main>

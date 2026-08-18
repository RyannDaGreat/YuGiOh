<script>
  import { base } from "$app/paths";
  import { getCard } from "$lib/api.js";
  import Icon from "@iconify/svelte";
  import playCircle from "@iconify-icons/mdi/play-circle";
  import arrowLeft from "@iconify-icons/mdi/arrow-left";
  import bookIcon from "@iconify-icons/mdi/book-open-variant";
  import infoIcon from "@iconify-icons/mdi/information-outline";
  import linkIcon from "@iconify-icons/mdi/link-variant";
  import CardArt from "$lib/pretty/CardArt.svelte";
  import DeckThumb from "$lib/pretty/DeckThumb.svelte";

  let { data } = $props();
  const deck = $derived(data.deck);

  /** name -> {summary, desc, code}, filled lazily from /api/card on hover. */
  let cardText = $state({});
  /** Names already requested, so re-hovering a card cannot double-fetch. */
  const asked = new Set();
  /** The card whose art/text the floating preview panel is showing. */
  let hovered = $state(null);

  /**
   * Pure function. Badge classes for a deck's format (GOAT emerald, classic sky).
   *
   * @param {"goat"|"classic"} format
   * @returns {string}
   *
   * @example formatClass("goat") // "...emerald..."
   */
  function formatClass(format) {
    return format === "goat"
      ? "bg-emerald-900/60 text-emerald-100 border-emerald-600/50"
      : "bg-sky-900/60 text-sky-100 border-sky-600/50";
  }

  /**
   * Pure function. The bracketed stat block of a card summary, without the name.
   *
   * @param {string|undefined} summary - "Kuriboh [DARK Fiend Normal Lv1 ATK300 DEF200]"
   * @returns {string} "" while the lookup is still in flight
   *
   * @example statLine("Mirror Force [Trap]") // "Trap"
   * @example statLine(undefined)             // ""
   */
  const statLine = (summary) => summary?.match(/\[(.*)\]$/)?.[1] ?? "";

  /**
   * Pure function. Renders a deck's plain-text manual as safe HTML: escapes
   * markup, then turns **bold** into <strong>. Line breaks are preserved by the
   * container's `whitespace-pre-wrap`, not here.
   *
   * @param {string} text - the deck's `manual`
   * @returns {string} HTML-safe string with <strong> emphasis
   *
   * @example renderManual("Key **combo**: <x>") // "Key <strong>combo</strong>: &lt;x&gt;"
   */
  function renderManual(text) {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  /**
   * Command. Points the floating preview at card `c` and fetches its text once
   * (module-cached per name). Throws loudly if the lookup fails.
   *
   * @param {{code:number, name:string}} c
   */
  async function preview(c) {
    hovered = c;
    if (asked.has(c.name)) return;
    asked.add(c.name);
    cardText[c.name] = await getCard(c.name);
  }
</script>

<svelte:head><title>YuGi — {deck.name}</title></svelte:head>

{#snippet cardCell(c)}
  <div class="flex flex-col items-center gap-1" style="width: var(--card-w-zone)">
    <button
      type="button"
      class="relative transition-transform hover:scale-105 focus:outline-none focus:scale-105"
      onmouseenter={() => preview(c)}
      onfocus={() => preview(c)}
    >
      <CardArt code={c.code} name={c.name} size="zone" />
      {#if c.count > 1}
        <span class="absolute right-0.5 bottom-0.5 text-[0.6rem] font-bold bg-black/70 text-amber-100 px-1 rounded">×{c.count}</span>
      {/if}
    </button>
    <span class="text-[0.55rem] leading-tight text-center text-amber-100/90 break-words" style="width: var(--card-w-zone)">{c.name}</span>
  </div>
{/snippet}

{#snippet cardSection(title, cards)}
  <section class="rounded-md bg-black/30 border border-amber-900/50 p-4">
    <h2 class="font-bold text-amber-200 mb-3">{title} <span class="text-amber-100/50 font-normal text-sm">({cards.reduce((n, c) => n + c.count, 0)})</span></h2>
    <div class="flex flex-wrap gap-x-3 gap-y-5 justify-center sm:justify-start">
      {#each cards as c (c.code)}{@render cardCell(c)}{/each}
    </div>
  </section>
{/snippet}

<main class="min-h-screen bg-[#120c08] text-amber-50 p-6 w-full flex flex-col gap-6">
  <a class="inline-flex items-center gap-1 text-amber-300 underline text-sm w-fit" href="{base}/decks">
    <Icon icon={arrowLeft} /> Deck Library
  </a>

  <header class="flex flex-wrap items-end justify-between gap-4">
    <div class="flex items-center gap-4">
      <DeckThumb boxArtFile={deck.boxArtFile} signatureCode={deck.main[0]?.code} name={deck.name} category={deck.category} size="tile" />
      <div>
        <h1 class="text-3xl font-black text-amber-200 tracking-wide">{deck.name}</h1>
        <div class="mt-1 flex items-center gap-2 text-sm">
          <span class="text-[0.6rem] uppercase font-bold px-1.5 py-0.5 rounded border {formatClass(deck.format)}">{deck.format}</span>
          <span class="text-amber-100/60 capitalize">{deck.category} deck</span>
          {#if deck.setCode}<span class="text-amber-100/40">·</span><span class="text-amber-300/80 font-mono text-xs">{deck.setCode}</span>{/if}
          <span class="text-amber-100/40">·</span>
          <span class="text-amber-100/60">{deck.main.reduce((n, c) => n + c.count, 0)} main{deck.extra.length ? ` · ${deck.extra.reduce((n, c) => n + c.count, 0)} extra` : ""}{deck.side.length ? ` · ${deck.side.reduce((n, c) => n + c.count, 0)} side` : ""}</span>
        </div>
      </div>
    </div>
    <a
      href="{base}/?p{data.seat}={data.id}#new-duel"
      class="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-amber-300 text-amber-950 font-bold hover:bg-amber-200 transition-colors"
    >
      <Icon icon={playCircle} /> Play this deck as P{data.seat}{data.seat === 0 ? " (goes 1st)" : " (goes 2nd)"}
    </a>
  </header>

  {@render cardSection("Main Deck", deck.main)}
  {#if deck.extra.length}{@render cardSection("Extra Deck", deck.extra)}{/if}
  {#if deck.side.length}{@render cardSection("Side Deck", deck.side)}{/if}

  <section class="rounded-md bg-black/30 border border-amber-900/50 p-4">
    <h2 class="font-bold text-amber-200 mb-2 flex items-center gap-1.5"><Icon icon={bookIcon} /> How to pilot</h2>
    {#if deck.manual.trim()}
      <div class="text-amber-100/85 text-sm leading-relaxed whitespace-pre-wrap max-w-3xl">{@html renderManual(deck.manual)}</div>
    {:else}
      <p class="text-amber-100/50 text-sm">No manual provided for this deck.</p>
    {/if}
  </section>

  {#if deck.sources?.length}
    <section class="rounded-md bg-black/30 border border-amber-900/50 p-4">
      <h2 class="font-bold text-amber-200 mb-2 flex items-center gap-1.5"><Icon icon={linkIcon} /> Sources</h2>
      <ul class="text-amber-100/70 text-xs leading-relaxed list-disc pl-5 max-w-3xl break-words">
        {#each deck.sources as src}
          <li>
            {#if src.startsWith("http")}
              <a href={src} target="_blank" rel="noopener noreferrer" class="text-sky-300 hover:underline">{src}</a>
            {:else}
              {src}
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <p class="text-amber-100/40 text-xs flex items-center gap-1.5">
    <Icon icon={infoIcon} /> To add your own deck, ask Claude to research and author one.
  </p>
</main>

{#if hovered}
  <aside class="fixed bottom-4 right-4 z-40 w-72 rounded-lg border-2 border-amber-800 bg-[#150e09] shadow-2xl p-3">
    <div class="flex gap-3">
      <div class="shrink-0"><CardArt code={hovered.code} name={hovered.name} size="zone" /></div>
      <div class="min-w-0">
        <p class="font-bold text-amber-100 text-sm leading-tight">{hovered.name}</p>
        {#if cardText[hovered.name]}<p class="text-amber-100/60 text-[0.65rem] leading-tight mt-0.5">{statLine(cardText[hovered.name].summary)}</p>{/if}
      </div>
    </div>
    {#if cardText[hovered.name]?.desc}
      <p class="mt-2 text-amber-100/80 text-[0.7rem] leading-snug max-h-40 overflow-auto whitespace-pre-wrap">{cardText[hovered.name].desc}</p>
    {/if}
  </aside>
{/if}

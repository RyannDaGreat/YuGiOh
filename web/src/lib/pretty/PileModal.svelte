<script module>
  /**
   * name -> {summary, desc, code} from /api/card, shared by every modal on the
   * page. The card database never changes, so one fetch per name per load.
   */
  const cache = new Map();
</script>

<script>
  import { ASSETS } from "$lib/assets.js";
  import { base } from "$app/paths";
  import { getCard } from "$lib/api.js";
  import Icon from "@iconify/svelte";
  /**
   * The whole contents of one pile (graveyard, banished, deck, extra) as a grid
   * of cards — what a player may pick up and read at a real table. Entries
   * whose identity is withheld draw as card backs.
   *
   * The state payload gives pile entries as {name, code}; unordered lists
   * (deck, unseen pool) give names only, so the code (for art) and the stat
   * line come from /api/card, the same lookup the preview panel uses.
   *
   * @prop {string} title                                  "P0 Graveyard (7)"
   * @prop {{name: string|null, code: number, faceUp?: boolean}[]} entries   pile contents, in pile order; faceUp marks a Pendulum lying face-up in the Extra Deck
   * @prop {string} note                                   caption under the title
   * @prop {string} back                                   card-back image URL (the owner's sleeve)
   * @prop {(card) => void} onhover
   * @prop {(card) => void} onclick
   * @prop {() => void} onclose
   */
  let { title, entries = [], note = "", back = `${base}/img/card-back.png`, onhover = () => {}, onclick = () => {}, onclose = () => {} } = $props();

  /** name -> card info, once fetched; drives the art and stat line. */
  let info = $state({});
  /** Names already asked for, so a re-run of the effect cannot double-fetch. */
  const asked = new Set();

  /**
   * Pure function. The bracketed stat block of a card summary, without the name.
   *
   * @param {string|undefined} summary - "Blue-Eyes White Dragon [LIGHT Dragon Normal Lv8 ATK3000 DEF2500]"
   * @returns {string} "" while the lookup is still in flight
   *
   * @example statLine("Mirror Force [Trap]")            // "Trap"
   * @example statLine("Kuriboh [DARK Fiend Normal Lv1 ATK300 DEF200]")
   *                                                     // "DARK Fiend Normal Lv1 ATK300 DEF200"
   * @example statLine(undefined)                        // ""
   */
  const statLine = (summary) => summary?.match(/\[(.*)\]$/)?.[1] ?? "";

  /**
   * Command. Fills info[name] from the card API (module-cached).
   *
   * @param {string} name - Exact card name
   */
  async function lookup(name) {
    if (asked.has(name)) return;
    asked.add(name);
    if (!cache.has(name)) {
      cache.set(name, await getCard(name));
    }
    info[name] = cache.get(name);
  }

  $effect(() => { for (const e of entries) if (e.name) lookup(e.name); });

  const cells = $derived(entries.map((e) => {
    const meta = e.name ? info[e.name] : null;
    return { name: e.name, code: e.code || meta?.code || 0, stats: statLine(meta?.summary), faceUp: Boolean(e.faceUp) };
  }));
  /** How many entries lie face-up (Extra Deck: Pendulums returned there, re-summonable). */
  const faceUpCount = $derived(cells.filter((c) => c.faceUp).length);
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onclose()} />

<button class="fixed inset-0 z-40 bg-black/80 cursor-default" aria-label="close pile" onclick={() => onclose()}></button>
<div class="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
  <div class="pointer-events-auto w-full max-w-5xl max-h-[85vh] overflow-auto rounded-lg border-2 border-amber-800 bg-[#150e09] shadow-2xl">
    <div class="sticky top-0 z-10 flex items-baseline gap-3 px-4 py-2 bg-[#150e09] border-b border-amber-900/60">
      <h2 class="font-bold text-amber-200 text-sm">{title}{#if faceUpCount} <span class="text-yellow-300 text-xs font-normal">· {faceUpCount} face-up</span>{/if}</h2>
      {#if note}<span class="text-[0.65rem] text-amber-100/50">{note}</span>{/if}
      <button class="ml-auto self-center inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-amber-900 text-amber-100 text-xs hover:bg-amber-900/50" onclick={() => onclose()}>close <Icon icon="mdi:close" /></button>
    </div>
    {#if cells.length}
      <div class="p-4 flex flex-wrap gap-x-3 gap-y-4 justify-center">
        {#each cells as c, i}
          <div class="card-zone flex flex-col items-center gap-1" style="width: var(--card-w)">
            <button
              class="relative card-box card-zone overflow-hidden shadow-md transition-transform duration-300 hover:scale-105 focus:outline-none"
              title={c.name ?? "face-down card"}
              onmouseenter={() => c.name && onhover({ name: c.name, code: c.code })}
              onclick={() => c.name && onclick({ name: c.name, code: c.code })}
            >
              {#if c.code}
                <img src="{ASSETS}/pics/{c.code}.jpg" alt={c.name} class="absolute inset-0 w-full h-full object-cover" loading="lazy" onerror={(e) => { e.currentTarget.style.display = "none"; }} />
              {:else}
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#7a4a2a_0,#3b2314_70%)] border border-amber-900"></div>
                {#if !c.name}<img src={back} alt="" class="absolute inset-0 w-full h-full object-cover" onerror={(e) => { e.currentTarget.style.display = "none"; }} />{/if}
              {/if}
              <span class="absolute right-0.5 bottom-0.5 text-[0.55rem] font-bold bg-black/70 text-amber-100 px-1 rounded">{i + 1}</span>
              {#if c.faceUp}<span class="absolute left-0.5 top-0.5 text-[0.5rem] font-bold bg-yellow-300 text-yellow-950 px-1 rounded" title="face-up in the Extra Deck — can be Pendulum Summoned back">face-up</span>{/if}
            </button>
            <span class="text-[0.55rem] leading-tight text-center text-amber-100/90 break-words">{c.name ?? "face-down"}</span>
            {#if c.stats}<span class="text-[0.5rem] leading-tight text-center text-amber-100/50 break-words">{c.stats}</span>{/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="p-8 text-center text-amber-100/40 text-sm">empty</p>
    {/if}
  </div>
</div>

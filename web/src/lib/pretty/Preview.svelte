<script>
  /**
   * The big card on the left, like a real duel client: full art of whatever
   * was last hovered/clicked, with its rules text underneath.
   *
   * @prop {{summary: string, desc: string, code: number}|null} card
   */
  let { card = null } = $props();
</script>

<aside class="w-56 shrink-0 flex flex-col gap-2">
  <div class="w-56 h-[20.5rem] rounded-md overflow-hidden border-2 border-amber-800 bg-black/40 shadow-xl">
    {#if card}
      <img src="/pics/{card.code}.jpg" alt={card.summary} class="w-full h-full object-cover" onerror={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
    {:else}
      <div class="w-full h-full flex items-center justify-center text-amber-100/40 text-xs text-center px-4">hover a card</div>
    {/if}
  </div>
  {#if card}
    <div class="text-amber-50 text-xs leading-snug bg-black/40 rounded p-2 border border-amber-900/60 max-h-72 overflow-auto">
      <div class="font-bold text-amber-200 mb-1">{card.summary}</div>
      <div class="whitespace-pre-wrap">{card.desc}</div>
    </div>
  {/if}
</aside>

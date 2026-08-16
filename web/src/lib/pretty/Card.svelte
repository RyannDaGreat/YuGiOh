<script>
  /**
   * One card on the table: art when identifiable, a card back when not, rotated
   * for Defense Position. Purely presentational; emits hover/click via props.
   *
   * @prop {object|null} card   FieldCard from state.js (name, code, position, faceDown, atk, def) or a {name, code} list entry
   * @prop {string} label       zone label shown in the corner (m0, s3, field, …)
   * @prop {"zone"|"hand"} size
   * @prop {string} fx          extra classes for effects (fx-flash, fx-shake)
   * @prop {(card) => void} onhover
   * @prop {(card) => void} onclick
   */
  let { card = null, label = "", size = "zone", fx = "", onhover = () => {}, onclick = () => {} } = $props();

  const isDefense = $derived(Boolean(card && /DEF/.test(card.position ?? "")));
  const known = $derived(Boolean(card && card.code));
  const showBack = $derived(Boolean(card && card.faceDown && !known));
  const dims = $derived(size === "hand" ? "w-14 h-20" : "w-16 h-[5.75rem]");
</script>

<div class="relative {dims} shrink-0 {fx}" role="presentation" onmouseenter={() => card && onhover(card)}>
  {#if label}<span class="absolute -top-2 left-0.5 text-[0.55rem] leading-none text-amber-100/70 z-10">{label}</span>{/if}
  {#if card}
    <button
      class="absolute inset-0 rounded-sm overflow-hidden shadow-md transition-transform duration-300 hover:scale-105 focus:outline-none {isDefense ? 'rotate-90 scale-[0.82]' : ''} {card.faceDown && known ? 'ring-2 ring-sky-300/70' : ''}"
      onclick={() => onclick(card)}
      title={card.name ?? "unknown card"}
    >
      {#if showBack || !known}
        <div class="w-full h-full bg-[radial-gradient(circle_at_50%_40%,#7a4a2a_0,#3b2314_70%)] border border-amber-900 flex items-center justify-center">
          <div class="w-2/3 h-2/3 rounded-full border-2 border-amber-700/60"></div>
        </div>
      {:else}
        <img src="/pics/{card.code}.jpg" alt={card.name} class="w-full h-full object-cover" loading="lazy" onerror={(e) => { e.currentTarget.style.display = "none"; }} />
        <div class="absolute inset-0 flex items-end justify-center pointer-events-none">
          {#if card.faceDown}<span class="text-[0.5rem] bg-sky-900/80 text-sky-100 px-1 rounded-t">set</span>{/if}
        </div>
      {/if}
      {#if card.name && !card.faceDown && card.atk === undefined && !known}
        <span class="absolute inset-x-0 bottom-0 text-[0.5rem] bg-black/60 text-white truncate px-0.5">{card.name}</span>
      {/if}
    </button>
    {#if card.atk !== undefined && !showBack}
      <span class="absolute -bottom-2.5 inset-x-0 text-center text-[0.6rem] leading-none font-bold text-amber-100 drop-shadow [text-shadow:0_0_3px_#000] pointer-events-none">
        {isDefense ? `${card.def} DEF` : `${card.atk} ATK`}
      </span>
    {/if}
  {:else}
    <div class="absolute inset-0 rounded-sm border border-emerald-900/40 bg-emerald-950/30"></div>
  {/if}
</div>

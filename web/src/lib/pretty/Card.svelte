<script>
  /**
   * One card box, true 59:86 proportion. Shows art when the viewer may see the
   * card, a back otherwise; Defense Position is rotated in place.
   *
   * @prop {object|null} card   FieldCard from state.js (name, code, position, faceDown, atk, def) or a {name, code} list entry
   * @prop {string} label       zone label in the corner (m0, s3, field, …)
   * @prop {"zone"|"hand"} size
   * @prop {string} fx          effect classes (fx-flash, fx-shake)
   * @prop {boolean} own        the viewer controls this card (a known face-down card is drawn as its art blended over the back)
   * @prop {boolean} debug      spectator debug: hidden face-downs are treated as known (peek)
   * @prop {number} count       for piles: number badge
   * @prop {string} back        card-back image URL (the owner's sleeve)
   * @prop {(card) => void} onhover
   * @prop {(card) => void} onclick
   */
  let { card = null, label = "", size = "zone", fx = "", own = false, debug = false, count = null, back = "/img/card-back.png", onhover = () => {}, onclick = () => {} } = $props();

  const isDefense = $derived(Boolean(card && /DEF/.test(card.position ?? "")));
  const known = $derived(Boolean(card && card.code));
  const faceDown = $derived(Boolean(card && card.faceDown));
  /**
   * What to draw: "art" (face-up), "back" (face-down and not ours to know), or
   * "peek" — a face-down card whose identity the viewer knows (their own set
   * cards, or spectator debug): the art at half opacity over the back plus a
   * "set" tag, so it reads as both "face-down" and "this is what it is".
   */
  const mode = $derived(!card ? "empty" : !known ? "back" : !faceDown ? "art" : own || debug ? "peek" : "back");
  const hoverable = $derived(mode === "art" || mode === "peek");
</script>

<div class="relative card-box card-{size} shrink-0 {fx}" role="presentation" onmouseenter={() => hoverable && onhover(card)}>
  {#if label}<span class="absolute -top-2.5 left-0.5 text-[0.55rem] leading-none text-amber-100/70 z-10 pointer-events-none">{label}</span>{/if}
  {#if mode === "empty"}
    <div class="absolute inset-0 card-box card-{size} border border-emerald-900/40 bg-emerald-950/30"></div>
  {:else}
    <button
      class="absolute inset-0 card-box card-{size} overflow-hidden shadow-md transition-transform duration-300 hover:scale-105 focus:outline-none {isDefense ? 'rotate-90 scale-[0.86]' : ''}"
      onclick={() => hoverable && onclick(card)}
      title={hoverable ? card.name : "face-down card"}
    >
      {#if mode === "back" || mode === "peek"}
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#7a4a2a_0,#3b2314_70%)] border border-amber-900"></div>
        <img src={back} alt="" class="absolute inset-0 w-full h-full object-cover" onerror={(e) => { e.currentTarget.style.display = "none"; }} />
      {/if}
      {#if mode === "art" || mode === "peek"}
        <img src="/pics/{card.code}.jpg" alt={card.name} class="absolute inset-0 w-full h-full object-cover {mode === 'peek' ? 'opacity-50' : ''}" loading="lazy" onerror={(e) => { e.currentTarget.style.display = "none"; }} />
      {/if}
      {#if mode === "peek"}
        <span class="absolute inset-x-0 bottom-0 text-[0.5rem] leading-tight bg-sky-900/80 text-sky-100 text-center">set</span>
      {/if}
      {#if count !== null}
        <span class="absolute right-0.5 bottom-0.5 text-[0.6rem] font-bold bg-black/70 text-amber-100 px-1 rounded">{count}</span>
      {/if}
    </button>
    {#if card.atk !== undefined && mode !== "back"}
      <span class="absolute -bottom-2.5 inset-x-0 text-center text-[0.6rem] leading-none font-bold text-amber-100 [text-shadow:0_0_3px_#000] pointer-events-none">
        {isDefense ? `${card.def} DEF` : `${card.atk} ATK`}
      </span>
    {/if}
  {/if}
</div>

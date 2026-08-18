<script>
  /**
   * A context menu of the options that belong to one card, opened where the
   * pointer clicked. Behaves like a real one: Escape or a click anywhere else
   * closes it, it stays on screen near the edges, and hovering a row lights up
   * the same option in the aside and the card on the table (shared hover state).
   *
   * @prop {{x:number, y:number}|null} at   pointer position; null = closed
   * @prop {Array<{index:number, label:string}>} options
   * @prop {number|null} hoverOption
   * @prop {(i:number|null) => void} onhover
   * @prop {(i:number) => void} onpick
   * @prop {() => void} onclose
   */
  import { onMount } from "svelte";

  let { at = null, options = [], hoverOption = null, onhover = () => {}, onpick = () => {}, onclose = () => {} } = $props();

  let el = $state(null);
  /** Kept inside the viewport: flip left/up when the click was near an edge. */
  const style = $derived.by(() => {
    if (!at) return "";
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 40 * Math.max(1, options.length);
    const x = Math.min(at.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - w - 8);
    const y = Math.min(at.y, (typeof window !== "undefined" ? window.innerHeight : 9999) - h - 8);
    return `left:${Math.max(4, x)}px; top:${Math.max(4, y)}px`;
  });

  onMount(() => {
    const away = (e) => { if (at && el && !el.contains(e.target)) onclose(); };
    const key = (e) => { if (e.key === "Escape") onclose(); };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", away, true); window.removeEventListener("keydown", key); };
  });
</script>

{#if at}
  <div bind:this={el} class="fixed z-[60] min-w-[14rem] max-w-[22rem] rounded-md border border-amber-900 bg-[#1c1410] shadow-2xl text-xs py-1" {style} role="menu">
    {#each options as o}
      <button class="w-full text-left px-3 py-1.5 text-amber-50 hover:bg-amber-900/40 {hoverOption === o.index ? 'option-lit' : ''}" role="menuitem" onmouseenter={() => onhover(o.index)} onmouseleave={() => onhover(null)} onclick={() => { onpick(o.index); onclose(); }}>
        <span class="font-mono text-amber-300 mr-1.5">{o.index + 1}</span>{o.label}
      </button>
    {/each}
  </div>
{/if}

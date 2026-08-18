<script>
  import { ASSETS } from "$lib/assets.js";
  /**
   * A transient card that flies from one slot's CENTRE to another — the ONE
   * animation behind every zone→zone move (draw, summon, to-grave, revival,
   * bounce, field-shift, …). Absolutely positioned inside the table overlay; the
   * parent spawns it on a `move`/`draw` event and removes it after `duration`.
   * When the card's face-up-ness changes on the trip (a draw reveals it, a set
   * hides it) it flips at the midpoint — a scaleX squash that swaps art ↔ back.
   *
   * Endpoints are CENTRE points and the size is fixed (`w`/`h`), so a card whose
   * origin slot has already unmounted (hand-area fallback) still flies card-sized.
   *
   * @prop {{x:number,y:number}} from  source centre (table-relative)
   * @prop {{x:number,y:number}} to    destination centre (table-relative)
   * @prop {number} w         flyer width (px)
   * @prop {number} h         flyer height (px)
   * @prop {number} code      passcode for the face-up art (0 / unknown → show the back)
   * @prop {string} back      card-back image url for the face-down side
   * @prop {boolean} faceFrom  face-up at the source?
   * @prop {boolean} faceTo    face-up at the destination?
   * @prop {number} duration   ms for the trip
   * @prop {boolean} upsideDown the card belongs to the far player and the table draws their cards turned (Card.svelte)
   */
  import { onMount } from "svelte";

  let { from, to, w = 60, h = 88, code = 0, back = "", faceFrom = true, faceTo = true, duration = 380, upsideDown = false } = $props();

  // A flyer is spawned once with fixed endpoints/faces and removed after the
  // trip; it never reacts to prop changes, so capturing the initial values here
  // is intentional (hence the svelte-ignore lines).
  // svelte-ignore state_referenced_locally
  const flips = faceFrom !== faceTo;
  // First render at the source centre, then (next frame) move to the destination
  // centre so the CSS left/top transition animates instead of snapping.
  // svelte-ignore state_referenced_locally
  let cx = $state(from.x);
  // svelte-ignore state_referenced_locally
  let cy = $state(from.y);
  /** The face currently shown; swaps at the midpoint when the card flips. */
  // svelte-ignore state_referenced_locally
  let showFace = $state(faceFrom);
  let broken = $state(false);

  onMount(() => {
    requestAnimationFrame(() => { cx = to.x; cy = to.y; });
    if (flips) setTimeout(() => (showFace = faceTo), duration / 2);
  });
</script>

<div
  class="fly-card {flips ? 'fly-flip' : ''}"
  style="--fly-ms:{duration}ms; left:{cx - w / 2}px; top:{cy - h / 2}px; width:{w}px; height:{h}px; transition:left var(--fly-ms) cubic-bezier(.4,0,.2,1), top var(--fly-ms) cubic-bezier(.4,0,.2,1);"
>
  {#if showFace && code && !broken}
    <img src="{ASSETS}/pics/{code}.jpg" alt="" class="absolute inset-0 w-full h-full object-cover rounded shadow-lg {upsideDown ? 'rotate-180' : ''}" onerror={() => (broken = true)} />
  {:else}
    <img src={back} alt="" class="absolute inset-0 w-full h-full object-cover rounded shadow-lg {upsideDown ? 'rotate-180' : ''}" />
  {/if}
</div>

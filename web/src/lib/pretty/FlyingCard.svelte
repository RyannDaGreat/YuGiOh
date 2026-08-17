<script>
  /**
   * A transient card that flies from one slot's rect to another — the ONE
   * animation behind every zone→zone move (draw, summon, to-grave, revival,
   * bounce, field-shift, …). Absolutely positioned inside the table overlay; the
   * parent spawns it on a `move`/`draw` event and removes it after `duration`.
   * When the card's face-up-ness changes on the trip (a draw reveals it, a set
   * hides it) it flips at the midpoint — a scaleX squash that swaps art ↔ back.
   *
   * @prop {{x:number,y:number,w:number,h:number}} from  source slot rect (table-relative)
   * @prop {{x:number,y:number,w:number,h:number}} to    destination slot rect (table-relative)
   * @prop {number} code      passcode for the face-up art (0 / unknown → show the back)
   * @prop {string} back      card-back image url for the face-down side
   * @prop {boolean} faceFrom  face-up at the source?
   * @prop {boolean} faceTo    face-up at the destination?
   * @prop {number} duration   ms for the trip
   */
  import { onMount } from "svelte";

  let { from, to, code = 0, back = "", faceFrom = true, faceTo = true, duration = 380 } = $props();

  // A flyer is spawned once with fixed endpoints/faces and removed after the
  // trip; it never reacts to prop changes, so capturing the initial values here
  // is intentional (hence the svelte-ignore lines).
  // svelte-ignore state_referenced_locally
  const flips = faceFrom !== faceTo;
  // First render at the source, then (next frame) move to the destination so the
  // CSS left/top transition actually animates instead of snapping.
  // svelte-ignore state_referenced_locally
  let x = $state(from.x);
  // svelte-ignore state_referenced_locally
  let y = $state(from.y);
  /** The face currently shown; swaps at the midpoint when the card flips. */
  // svelte-ignore state_referenced_locally
  let showFace = $state(faceFrom);
  let broken = $state(false);

  onMount(() => {
    requestAnimationFrame(() => { x = to.x; y = to.y; });
    if (flips) setTimeout(() => (showFace = faceTo), duration / 2);
  });
</script>

<div
  class="fly-card {flips ? 'fly-flip' : ''}"
  style="--fly-ms:{duration}ms; left:{x}px; top:{y}px; width:{from.w}px; height:{from.h}px; transition:left var(--fly-ms) cubic-bezier(.4,0,.2,1), top var(--fly-ms) cubic-bezier(.4,0,.2,1);"
>
  {#if showFace && code && !broken}
    <img src="/pics/{code}.jpg" alt="" class="absolute inset-0 w-full h-full object-cover rounded shadow-lg" onerror={() => (broken = true)} />
  {:else}
    <img src={back} alt="" class="absolute inset-0 w-full h-full object-cover rounded shadow-lg" />
  {/if}
</div>

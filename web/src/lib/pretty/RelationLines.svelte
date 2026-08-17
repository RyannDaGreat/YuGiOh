<script>
  /**
   * Faint dashed lines over the mat linking related cards — currently equip
   * spells to the monsters they are attached to. A generic relationship overlay:
   * the parent (Table) computes the endpoints (it owns `centerOf`) and passes
   * them here as table-relative point pairs; this component only draws.
   *
   * @prop {Array<{ax:number, ay:number, bx:number, by:number}>} lines
   */
  let { lines = [] } = $props();
</script>

<svg class="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
  {#each lines as l, i (i)}
    <line class="equip-line" x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} />
  {/each}
</svg>

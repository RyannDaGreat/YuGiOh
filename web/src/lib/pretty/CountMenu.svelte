<script>
  /**
   * The count-distribution menu (mode "counters", e.g. SELECT_COUNTER "remove
   * 3 counters"): each option row is click-to-add-one with −/+ steppers and a
   * count badge, under them a running "N of M" total, the free-text
   * "option:count" box (kept two-way in sync by the page) and a Confirm button
   * enabled exactly when the distribution is submittable (countMenu.js
   * countsReady).
   *
   * Stateless on purpose: the page owns the ONE counts array (its table-click
   * handler writes the same state), this component only renders it and reports
   * intents — bump (row click, same as clicking the card on the table), step
   * (−/+), retype, confirm.
   */
  import { countsReady, totalOf } from "./countMenu.js";

  let {
    /** @type {string[]} menu item labels, in option order */
    items,
    /** @type {number[]} count per option, index-aligned with items */
    counts,
    /** @type {Array<number|null>} per-option caps (countMenu.js capOf) */
    caps,
    /** @type {number|null} exact total wanted (countMenu.js neededOf) */
    needed,
    /** @type {string} the free-text answer as typed */
    text,
    busy = false,
    hoverOption = null,
    onhover = () => {},
    onbump = () => {},
    onstep = () => {},
    ontext = () => {},
    onconfirm = () => {},
  } = $props();

  const total = $derived(totalOf(counts));
  const ready = $derived(countsReady(counts, caps, needed));
</script>

<div class="flex flex-col gap-1">
  {#each items as label, i}
    <!-- One row = one card that can give up counters. The label button adds one
         (wrapping at the cap), mirroring a click on the card itself; hover syncs
         with the table rim through the shared hoverOption. -->
    <div class="flex items-stretch gap-1 rounded {hoverOption === i ? 'option-lit' : ''}" data-count-row={i} onmouseenter={() => onhover(i)} onmouseleave={() => onhover(null)} role="presentation">
      <button class="flex-1 min-w-0 text-left text-xs px-2 py-1 rounded border border-amber-900/60 hover:bg-amber-900/40 {counts[i] > 0 ? 'bg-yellow-300/15' : 'bg-black/30'}" onclick={() => onbump(i)} disabled={busy} title="take one more from this card (wraps to 0 past {caps[i] ?? 'its cap'})">
        <span class="font-mono text-amber-300 mr-1">{i + 1}</span>{label}
      </button>
      <button class="count-step" onclick={() => onstep(i, -1)} disabled={busy || counts[i] === 0} title="one fewer from this card" aria-label="one fewer from option {i + 1}">−</button>
      <span class="count-badge {counts[i] > 0 ? 'active' : ''}" title="taking {counts[i]}{caps[i] === null ? '' : ` of the ${caps[i]} it has`}">{counts[i]}</span>
      <button class="count-step" onclick={() => onstep(i, 1)} disabled={busy || (caps[i] !== null && counts[i] >= caps[i])} title="one more from this card" aria-label="one more from option {i + 1}">+</button>
    </div>
  {/each}
</div>

<p class="text-xs text-amber-100/70 mt-2" data-count-total>taking <b class="text-amber-200">{total}</b> of <b class="text-amber-200">{needed ?? "?"}</b></p>

<!-- The text box stays (some prefer typing "1:2,3:1"); it and the steppers are two
     views of the same counts, so either edits the other. Confirm submits that same
     text — the engine parses it with the one parser it always had. -->
<form class="mt-1 flex gap-1" onsubmit={(e) => { e.preventDefault(); if (ready && !busy) onconfirm(); }}>
  <input class="flex-1 min-w-0 px-1 rounded bg-black/40 border border-amber-900 text-xs font-mono" value={text} oninput={(e) => ontext(e.currentTarget.value)} placeholder="option:count, e.g. 1:2" />
  <button type="submit" class="px-2 rounded bg-amber-300 text-amber-950 text-xs font-bold disabled:opacity-40" disabled={busy || !ready}>Confirm</button>
</form>

<script>
  /**
   * The life-point readout, animated like the anime's LP counter: when `value`
   * changes it tweens the displayed integer from the old number to the new one
   * over `duration`, beeping `lptick` on a steady cadence while it spins and
   * `lpsettle` once when it lands. A brief green (gain) / red (loss) flash tints
   * the number during the count, then fades back to the normal amber.
   *
   * Drop-in for the static `{lp}` in Table.svelte: with no `class` prop it wears
   * exactly the same classes, so swapping it in changes nothing but the motion.
   *
   * The tween is wall-clock based (not per-frame), so it takes `duration` ms no
   * matter the refresh rate. Every audio call is gated on the `sound` prop AND
   * on sound.js's own mute state, so it stays silent until the user enables it.
   * Only one count runs at a time: a new `value` mid-count cancels the running
   * one and restarts from wherever the display currently sits.
   *
   * @prop {number} value      the target life-point total to show
   * @prop {boolean} sound     whether the tick/settle cues may play
   * @prop {number} duration   count length in ms
   * @prop {string} class      classes for the number (defaults to Table's look)
   */
  import { untrack } from "svelte";
  import { sfx } from "./sound.js";

  /** Count length when the caller does not override it (ms). */
  const DEFAULT_DURATION_MS = 800;
  /** Gap between counter beeps — the anime "pi pi pi" cadence (ms). */
  const TICK_INTERVAL_MS = 70;
  /** How long the up/down tint lingers past the landing before it fades (ms). */
  const FLASH_LINGER_MS = 180;
  /** The static LP look from Table.svelte, reused so the swap is invisible. */
  const DEFAULT_CLASS = "font-mono text-3xl font-black text-amber-100 [text-shadow:0_0_8px_#f59e0b]";

  let { value, sound = false, duration = DEFAULT_DURATION_MS, class: className = DEFAULT_CLASS } = $props();

  /** The integer on screen. Seeded from the initial `value`; thereafter driven
   * only by the count, so capturing just the first value is intentional. */
  // svelte-ignore state_referenced_locally
  let displayed = $state(value);
  /** Flash sign: 1 while gaining, -1 while losing, 0 when settled. */
  let direction = $state(0);

  // Non-reactive animation bookkeeping (deliberately plain `let`, never $state,
  // so the frame loop reading/writing it cannot retrigger the $effect below).
  /** Current requestAnimationFrame handle, or 0 when idle. */
  let raf = 0;
  /** Pending flash-reset timer, or 0 when none. */
  let flashTimer = 0;
  /** The number the frame loop last painted (untracked mirror of `displayed`). */
  // svelte-ignore state_referenced_locally
  let shown = value;
  /** False until the first value is painted, so mount neither animates nor beeps. */
  let started = false;

  /**
   * Command. Stops any count in flight: cancels the frame loop and the pending
   * flash-reset timer. Mutates: raf, flashTimer. Safe to call when already idle.
   */
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (flashTimer) clearTimeout(flashTimer);
    raf = 0;
    flashTimer = 0;
  }

  /**
   * Command. Tweens the display from its current number to `target` over
   * `duration` ms, framerate-independent (progress is wall-clock based). Beeps
   * `lptick` on a fixed cadence while spinning and `lpsettle` once on arrival,
   * both gated on `sound`. Cancels any count already running first, so counts
   * never overlap. Mutates: displayed, shown, direction, raf, flashTimer.
   *
   * @param {number} target - the life-point total to land on
   */
  function countTo(target) {
    stop();
    const from = shown;
    if (from === target) { direction = 0; return; }
    direction = target > from ? 1 : -1;
    const startAt = performance.now();
    let lastTickAt = -Infinity;
    const frame = (now) => {
      const t = Math.min(1, (now - startAt) / duration);
      shown = Math.round(from + (target - from) * t);
      displayed = shown;
      if (t < 1) {
        if (sound && now - lastTickAt >= TICK_INTERVAL_MS) { sfx.lptick(); lastTickAt = now; }
        raf = requestAnimationFrame(frame);
      } else {
        raf = 0;
        if (sound) sfx.lpsettle();
        flashTimer = setTimeout(() => { direction = 0; flashTimer = 0; }, FLASH_LINGER_MS);
      }
    };
    raf = requestAnimationFrame(frame);
  }

  // React to every `value` change. `value` is the only tracked dependency; the
  // count's reads of `shown` happen inside untrack() so the per-frame updates
  // cannot feed back into this effect. Cleanup stops the count on the next
  // change and on destroy.
  $effect(() => {
    const target = value;
    if (!started) {
      started = true;
      shown = target;
      displayed = target;
      return;
    }
    untrack(() => countTo(target));
    return stop;
  });
</script>

<div class="lp {className}" class:up={direction > 0} class:down={direction < 0}>{displayed}</div>

<style>
  :root {
    /* green-300 / red-300 — the gain/loss tint during a count. */
    --lp-flash-up: #86efac;
    --lp-flash-down: #fca5a5;
    /* How quickly the tint eases in and back out. */
    --lp-flash-fade: 0.15s;
  }
  .lp {
    transition: color var(--lp-flash-fade) ease-out;
  }
  /* Scoping adds a hash class, so these outrank the amber utility on the same element. */
  .up {
    color: var(--lp-flash-up);
  }
  .down {
    color: var(--lp-flash-down);
  }
</style>

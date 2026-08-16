<script>
  /**
   * The duel table: opponent on top (mirrored), you at the bottom, LP counters,
   * phase strip, hands, and an effects overlay (daggers, flashes, floating
   * damage) driven by animation events from the API.
   *
   * @prop {object} board       collectState() payload
   * @prop {number} me          seat drawn at the bottom
   * @prop {string[]} players   seat labels
   * @prop {object[]} events    animation events (events.js); the table plays any it has not seen
   * @prop {(card) => void} onhover
   * @prop {(card) => void} onclick
   * @prop {boolean} sound
   */
  import Card from "./Card.svelte";
  import { sfx } from "./sound.js";

  let { board, me = 0, players = ["P0", "P1"], events = [], onhover = () => {}, onclick = () => {}, sound = false } = $props();

  /** Effects state — transient classes/labels keyed by zone id ("1-m-3"). */
  let fx = $state({});
  let daggers = $state([]);
  let floats = $state([]);
  let tableEl = $state(null);
  let seenEvent = -1;
  let daggerId = 0;

  /** Durations mirror the CSS variables in app.css. */
  const FLASH_MS = 700;
  const DAGGER_MS = 650;
  const FLOAT_MS = 1200;
  /** Stagger between queued events so a whole opponent turn reads as a sequence. */
  const STEP_MS = 420;
  /** Events older than this many messages before the newest are skipped (first load / long jumps). */
  const REPLAY_WINDOW = 12;

  const bottom = $derived(board.players[me]);
  const top = $derived(board.players[1 - me]);
  const PHASES = ["Draw Phase", "Standby Phase", "Main Phase 1", "Battle Phase", "Main Phase 2", "End Phase"];
  const phaseIndex = $derived(PHASES.findIndex((p) => board.phaseName.startsWith(p)));

  const zoneId = (p, zone, seq) => `${p}-${zone}-${seq}`;

  function pulse(id, cls, ms) {
    fx = { ...fx, [id]: cls };
    setTimeout(() => { const next = { ...fx }; delete next[id]; fx = next; }, ms);
  }

  function centerOf(id) {
    if (!tableEl) return null;
    const el = tableEl.querySelector(`[data-zone="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const t = tableEl.getBoundingClientRect();
    return { x: r.left - t.left + r.width / 2, y: r.top - t.top + r.height / 2 };
  }

  function dagger(fromId, toId) {
    const a = centerOf(fromId);
    const b = centerOf(toId);
    if (!a || !b) return;
    const id = daggerId++;
    daggers = [...daggers, { id, path: `M ${a.x} ${a.y} L ${b.x} ${b.y}` }];
    setTimeout(() => { daggers = daggers.filter((d) => d.id !== id); }, DAGGER_MS + 50);
  }

  function floatText(id, text, cls) {
    const c = centerOf(id);
    if (!c) return;
    const key = daggerId++;
    floats = [...floats, { id: key, x: c.x, y: c.y, text, cls }];
    setTimeout(() => { floats = floats.filter((f) => f.id !== key); }, FLOAT_MS);
  }

  function play(ev) {
    const z = (c) => zoneId(c.p, c.zone, c.seq);
    const lpId = (p) => `${p}-lp-0`;
    switch (ev.kind) {
      case "attack":
        dagger(z(ev.from), ev.to ? z(ev.to) : lpId(1 - ev.from.p));
        if (sound) sfx.attack();
        break;
      case "battle":
        if (ev.targetDestroyed) pulse(z(ev.target), "fx-shake", FLASH_MS);
        if (ev.attackerDestroyed) pulse(z(ev.attacker), "fx-shake", FLASH_MS);
        if (sound) sfx.hit();
        break;
      case "damage":
        pulse(lpId(ev.player), "fx-shake", FLASH_MS);
        floatText(lpId(ev.player), `-${ev.amount}`, "text-red-400");
        if (sound) sfx.damage();
        break;
      case "recover":
        floatText(lpId(ev.player), `+${ev.amount}`, "text-emerald-300");
        if (sound) sfx.recover();
        break;
      case "summon": case "flip":
        pulse(z(ev.at), "fx-flash", FLASH_MS);
        if (sound) (ev.kind === "flip" ? sfx.flip : sfx.summon)();
        break;
      case "activate":
        pulse(z(ev.at), "fx-flash", FLASH_MS);
        floatText(z(ev.at), ev.name, "text-yellow-200 text-xs");
        if (sound) sfx.activate();
        break;
      case "set":
        if (sound) sfx.set();
        break;
      case "tograve":
        pulse(z(ev.from), "fx-shake", FLASH_MS);
        break;
      case "draw":
        if (sound) sfx.draw();
        break;
      case "turn":
        if (sound) sfx.turn();
        break;
      case "win":
        if (sound) sfx.win();
        break;
      default:
        break;
    }
  }

  // Play newly arrived events, staggered. On first load only the tail plays.
  $effect(() => {
    const list = events;
    if (!list.length) return;
    const last = list[list.length - 1].i;
    if (seenEvent < 0) seenEvent = Math.max(-1, last - REPLAY_WINDOW);
    const fresh = list.filter((e) => e.i > seenEvent);
    seenEvent = last;
    fresh.forEach((e, k) => setTimeout(() => play(e), k * STEP_MS));
  });
</script>

{#snippet zoneRow(p, zone, seqs)}
  <div class="flex gap-2 justify-center py-2">
    {#each seqs as seq}
      <div data-zone={zoneId(p, zone, seq)} class="rounded {fx[zoneId(p, zone, seq)] ?? ''}">
        <Card card={(zone === "m" ? board.players[p].mzone : board.players[p].szone)[seq]} label={zone === "m" ? `m${seq}` : seq === 5 ? "field" : `s${seq}`} {onhover} {onclick} />
      </div>
    {/each}
  </div>
{/snippet}

{#snippet hand(p, cards)}
  <div class="flex gap-1 justify-center py-1 min-h-20">
    {#each cards as c, i}
      <div data-zone={zoneId(p, "hand", i)}>
        <Card card={c.code ? { ...c, faceDown: false } : { name: null, code: 0, faceDown: true, position: "" }} size="hand" {onhover} {onclick} />
      </div>
    {/each}
  </div>
{/snippet}

{#snippet lp(p, side)}
  <div data-zone={zoneId(p, "lp", 0)} class="flex flex-col {side === 'top' ? 'items-start' : 'items-end'} gap-1 {fx[zoneId(p, 'lp', 0)] ?? ''}">
    <div class="text-xs uppercase tracking-widest text-amber-200/70">P{p} · {board.players[p].deckName} <span class="text-amber-100/50">({players[p]})</span></div>
    <div class="font-mono text-3xl font-black text-amber-100 [text-shadow:0_0_8px_#f59e0b]">{board.players[p].lp}</div>
    <div class="text-[0.65rem] text-amber-100/70">hand {board.players[p].handCount} · deck {board.players[p].deckCount} · GY {board.players[p].graveCount} · banished {board.players[p].banishCount}</div>
  </div>
{/snippet}

<div bind:this={tableEl} class="relative rounded-xl p-3 bg-[radial-gradient(ellipse_at_center,#1f5f45_0,#0f3d2b_60%,#0a2a1e_100%)] border-4 border-amber-900/70 shadow-2xl select-none">
  <!-- opponent -->
  <div class="flex items-start justify-between">
    {@render lp(1 - me, "top")}
    <div class="flex-1">{@render hand(1 - me, top.hand)}</div>
    <div class="w-40"></div>
  </div>
  {@render zoneRow(1 - me, "s", [4, 3, 2, 1, 0, 5])}
  {@render zoneRow(1 - me, "m", [4, 3, 2, 1, 0])}

  <!-- middle: extra monster zones + phase strip -->
  <div class="flex items-center justify-between px-6 py-1">
    <div class="flex gap-2">
      <div data-zone={zoneId(1 - me, "m", 6)} class={fx[zoneId(1 - me, "m", 6)] ?? ""}><Card card={top.mzone[6]} label="m6" {onhover} {onclick} /></div>
      <div data-zone={zoneId(1 - me, "m", 5)} class={fx[zoneId(1 - me, "m", 5)] ?? ""}><Card card={top.mzone[5]} label="m5" {onhover} {onclick} /></div>
    </div>
    <div class="flex gap-1">
      {#each PHASES as ph, i}
        <span class="px-2 py-0.5 rounded-full text-[0.65rem] font-semibold tracking-wide {i === phaseIndex ? 'bg-amber-400 text-amber-950 shadow-[0_0_10px_#fbbf24]' : 'bg-black/30 text-amber-100/50'}">{["DP", "SP", "M1", "BP", "M2", "EP"][i]}</span>
      {/each}
      <span class="ml-2 text-[0.65rem] text-amber-100/70 self-center">Turn {board.turn}{board.turnPlayer === null ? "" : ` · P${board.turnPlayer}`}</span>
    </div>
    <div class="flex gap-2">
      <div data-zone={zoneId(me, "m", 5)} class={fx[zoneId(me, "m", 5)] ?? ""}><Card card={bottom.mzone[5]} label="m5" {onhover} {onclick} /></div>
      <div data-zone={zoneId(me, "m", 6)} class={fx[zoneId(me, "m", 6)] ?? ""}><Card card={bottom.mzone[6]} label="m6" {onhover} {onclick} /></div>
    </div>
  </div>

  <!-- me -->
  {@render zoneRow(me, "m", [0, 1, 2, 3, 4])}
  {@render zoneRow(me, "s", [5, 0, 1, 2, 3, 4])}
  <div class="flex items-end justify-between">
    <div class="w-40"></div>
    <div class="flex-1">{@render hand(me, bottom.hand)}</div>
    {@render lp(me, "bottom")}
  </div>

  {#if board.chain.length}
    <div class="absolute left-1/2 -translate-x-1/2 top-1/2 translate-y-4 bg-black/80 text-yellow-100 text-xs px-3 py-1 rounded pointer-events-none border border-yellow-400/40">
      chain: {board.chain.map((l, i) => `${i + 1}. ${l.name}`).join(" → ")}
    </div>
  {/if}

  <!-- effects overlay -->
  <svg class="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
    {#each daggers as d (d.id)}
      <path d={d.path} stroke="rgba(251,191,36,0.35)" stroke-width="2" fill="none" />
      <g class="fx-dagger" style="offset-path: path('{d.path}')">
        <polygon points="-14,-4 10,0 -14,4" fill="#fde68a" stroke="#b45309" stroke-width="1" />
      </g>
    {/each}
  </svg>
  {#each floats as f (f.id)}
    <div class="absolute fx-float font-black text-2xl pointer-events-none {f.cls} [text-shadow:0_0_6px_#000]" style="left:{f.x}px; top:{f.y}px; transform: translate(-50%, -50%)">{f.text}</div>
  {/each}
</div>

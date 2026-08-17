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
   * @prop {number} viewer      the seat viewing (0|1|2): own set cards show art; 2 = spectator
   * @prop {boolean} debug      spectator debug: peek at hidden face-downs
   * @prop {string[]} backs     card-back image URL per seat (sleeves)
   */
  import Card from "./Card.svelte";
  import FlyingCard from "./FlyingCard.svelte";
  import PileModal from "./PileModal.svelte";
  import Icon from "@iconify/svelte";
  import { scale } from "svelte/transition";
  import { sfx } from "./sound.js";

  let { board, me = 0, players = ["P0", "P1"], events = [], onhover = () => {}, onclick = () => {}, sound = false, viewer = 2, debug = false, backs = ["/img/card-back.png", "/img/card-back.png"] } = $props();

  /** Effects state — transient classes/labels keyed by zone id ("1-m-3"). */
  let fx = $state({});
  let daggers = $state([]);
  let floats = $state([]);
  let flyers = $state([]);
  let tableEl = $state(null);
  let seenEvent = -1;
  let daggerId = 0;
  /** Card-flight duration; kept under STEP_MS so a flyer lands before the next event. */
  const FLY_MS = 380;

  /** Durations mirror the CSS variables in app.css. */
  const FLASH_MS = 700;
  const DAGGER_MS = 650;
  const FLOAT_MS = 1200;
  /** Stagger between queued events so a whole opponent turn reads as a sequence. */
  const STEP_MS = 420;
  /** At most this many events animate per position change; long jumps play only the last few. */
  const MAX_BURST = 10;
  /** Stagger used when many events land at once (scrubbing), so a burst still finishes quickly. */
  const FAST_STEP_MS = 160;
  /** How long a coin/dice toss stays on screen (about one second, matching the SFX). */
  const TOSS_MS = 1100;

  /**
   * Pure function. Which of a 3×3 pip grid are inked for a die face 1–6.
   * Cells are indexed row-major (0 = top-left, 4 = centre, 8 = bottom-right).
   *
   * @param {number} n - Die face, 1–6
   * @returns {number[]} indices of filled pips, ascending
   *
   * @example diePips(1) // [4]
   * @example diePips(3) // [0, 4, 8]
   * @example diePips(6) // [0, 2, 3, 5, 6, 8]
   */
  function diePips(n) {
    const faces = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    return faces[n] ?? [4];
  }

  /** A brief centered coin/dice result overlay: {kind, results, id} or null. */
  let toss = $state(null);
  let tossTimer = null;

  /**
   * Command. Flashes a coin/dice result in the middle of the table for ~1s.
   * A fresh toss replaces any still on screen (id bumps the keyed transition).
   */
  function showToss(kind, results) {
    clearTimeout(tossTimer);
    toss = { kind, results, id: daggerId++ };
    tossTimer = setTimeout(() => { toss = null; }, TOSS_MS);
  }

  const bottom = $derived(board.players[me]);
  const top = $derived(board.players[1 - me]);
  const PHASES = ["Draw Phase", "Standby Phase", "Main Phase 1", "Battle Phase", "Main Phase 2", "End Phase"];
  const phaseIndex = $derived(PHASES.findIndex((p) => board.phaseName.startsWith(p)));

  const zoneId = (p, zone, seq) => `${p}-${zone}-${seq}`;

  /** Which pile the viewer opened: {p, kind} with kind "grave"|"removed"|"deck"|"extra". */
  let openPile = $state(null);

  /**
   * Pure function. A list entry for a name-only pile (deck/unseen lists carry
   * no passcode; PileModal looks the art up by name).
   *
   * @param {string} name
   * @returns {{name: string, code: number}}
   *
   * @example byName("Kuriboh") // {name: "Kuriboh", code: 0}
   */
  const byName = (name) => ({ name, code: 0 });

  /**
   * Title, contents and caption for the open pile, or null when none is open.
   *
   * Graveyards and banished piles are public knowledge and are listed in pile
   * order. The deck never reveals its ORDER, so it shows the sorted list the
   * state payload already gives this viewer (`unseen`): their own deck when
   * `unseenKind` is "deck", otherwise the opponent's unseen pool of hand +
   * deck + face-down cards.
   */
  const pileModal = $derived.by(() => {
    if (!openPile) return null;
    const { p, kind } = openPile;
    const pl = board.players[p];
    const whose = p === viewer ? "Your" : viewer === 2 ? `P${p}` : "Opponent's";
    if (kind === "grave") return { title: `P${p} Graveyard (${pl.grave.length})`, entries: pl.grave, note: "oldest → newest" };
    if (kind === "removed") return { title: `P${p} Banished (${pl.removed.length})`, entries: pl.removed, note: "oldest → newest" };
    if (kind === "extra") return { title: `${whose} extra deck (${pl.extra.length})`, entries: pl.extra, note: "unordered" };
    return pl.unseenKind === "deck"
      ? { title: `${whose} deck (unordered, ${pl.unseen.length})`, entries: pl.unseen.map(byName), note: "sorted by name — deck order is never revealed" }
      : { title: `${whose} unseen pool (hand + deck + face-down, ${pl.unseen.length})`, entries: pl.unseen.map(byName), note: "every card of theirs you have not seen yet" };
  });

  function pulse(id, cls, ms) {
    fx = { ...fx, [id]: cls };
    setTimeout(() => { const next = { ...fx }; delete next[id]; fx = next; }, ms);
  }

  function centerOf(id) {
    if (!tableEl) return null;
    const el = tableEl.querySelector(`[data-zone="${id}"], [data-zone-alt="${id}"]`);
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

  /** Top-left + size of a slot, table-relative — the flyer's endpoint geometry. */
  function rectOf(id) {
    if (!tableEl) return null;
    const el = tableEl.querySelector(`[data-zone="${id}"], [data-zone-alt="${id}"], [data-zone-area="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const t = tableEl.getBoundingClientRect();
    return { x: r.left - t.left, y: r.top - t.top, w: r.width, h: r.height };
  }

  /**
   * A coord's rect, falling back to the zone AREA anchor when the exact slot is
   * gone (a hand card that already left, so its indexed slot no longer renders).
   */
  function anchorRect(c) {
    return rectOf(zoneId(c.p, c.zone, c.seq)) ?? rectOf(`${c.p}-${c.zone}`);
  }

  /** Command. Spawns a card that flies `from`→`to` (auto-removed), flipping if the face changes. */
  function flyCard(from, to, { code = 0, p = 0, faceFrom = true, faceTo = true } = {}) {
    const a = anchorRect(from);
    const b = anchorRect(to);
    if (!a || !b) return; // an endpoint we can't see (masked/off-screen) — skip, don't guess
    const id = daggerId++;
    flyers = [...flyers, { id, from: a, to: b, code, back: backs[p] ?? backs[0], faceFrom, faceTo }];
    setTimeout(() => { flyers = flyers.filter((f) => f.id !== id); }, FLY_MS + 80);
  }

  function floatText(id, text, cls) {
    const c = centerOf(id);
    if (!c) return;
    const key = daggerId++;
    floats = [...floats, { id: key, x: c.x, y: c.y, text, cls }];
    setTimeout(() => { floats = floats.filter((f) => f.id !== key); }, FLOAT_MS);
  }

  /** Beat between the two halves of a two-part cue (release then summon, impact then death). */
  const CUE_GAP_MS = 180;

  /**
   * Command. Plays `second` a beat after `first`, so a two-part event still
   * reads as one gesture instead of a chord.
   */
  function pair(first, second) {
    first();
    setTimeout(second, CUE_GAP_MS);
  }

  /**
   * Command. Animates one event from the digest and plays its cue.
   *
   * Each distinct happening gets a distinct cue (EDOPro's naming — see
   * sound.js), which is why the digest carries `tribute`, `special`, `reason`
   * and friends: they are what tells a tribute summon from a special summon,
   * or a monster dying in battle from one banished by an effect. Cues are not
   * doubled up — a card that goes to the graveyard from a battle stays silent
   * because the `battle` event already played the impact and the death.
   *
   * @param {object} ev - One event from src/events.js
   */
  function play(ev, fly = true) {
    const z = (c) => zoneId(c.p, c.zone, c.seq);
    const lpId = (p) => `${p}-lp-0`;
    switch (ev.kind) {
      case "move":
        // The unified card flight for every zone→zone move; `fly` is false on a
        // multi-move scrub jump (snap, no storm). No sound — the semantic event
        // (summon/tograve/…) that accompanies the move plays that.
        if (fly) flyCard(ev.from, ev.to, { code: ev.code, p: ev.to.p, faceFrom: ev.faceFrom, faceTo: ev.faceTo });
        break;
      case "attack":
        dagger(z(ev.from), ev.to ? z(ev.to) : lpId(1 - ev.from.p));
        if (sound) (ev.to ? sfx.attack : sfx.directattack)();
        break;
      case "battle":
        if (ev.targetDestroyed) pulse(z(ev.target), "fx-shake", FLASH_MS);
        if (ev.attackerDestroyed) pulse(z(ev.attacker), "fx-shake", FLASH_MS);
        if (sound) {
          if (ev.targetDestroyed || ev.attackerDestroyed) pair(sfx.hit, sfx.destroyed);
          else sfx.hit();
        }
        break;
      case "damage":
        pulse(lpId(ev.player), "fx-shake", FLASH_MS);
        floatText(lpId(ev.player), `-${ev.amount}`, "text-red-400");
        if (sound) sfx.damage();
        break;
      case "recover":
        floatText(lpId(ev.player), `+${ev.amount}`, "text-emerald-300");
        if (sound) sfx.gainlp();
        break;
      case "summon":
        pulse(z(ev.at), "fx-flash", FLASH_MS);
        if (!sound) break;
        if (ev.tribute) pair(sfx.tribute, sfx.summon);
        else if (ev.special) sfx.specialsummon();
        else sfx.summon();
        break;
      case "flip":
        pulse(z(ev.at), "fx-flash", FLASH_MS);
        if (sound) sfx.flip();
        break;
      case "pos":
        pulse(z(ev.at), "fx-flash", FLASH_MS);
        if (sound) sfx.poschange();
        break;
      case "activate":
        pulse(z(ev.at), "fx-flash", FLASH_MS);
        floatText(z(ev.at), ev.name, "text-yellow-200 text-xs");
        if (sound) {
          sfx.activate();
          if (ev.chainLink > 1) sfx.chain();
        }
        break;
      case "resolve":
        if (sound) sfx.resolve();
        break;
      case "set":
        if (!sound) break;
        if (ev.tribute) pair(sfx.tribute, sfx.set);
        else sfx.set();
        break;
      case "equip":
        pulse(z(ev.target), "fx-flash", FLASH_MS);
        if (sound) sfx.equip();
        break;
      case "tograve":
        pulse(z(ev.from), "fx-shake", FLASH_MS);
        // "battle" was already voiced by the battle event; "tribute" by the summon.
        if (sound && ev.reason !== "battle" && ev.reason !== "tribute") sfx.destroyed();
        break;
      case "banish":
        pulse(z(ev.from), "fx-shake", FLASH_MS);
        if (sound) sfx.banished();
        break;
      case "counter":
        pulse(z(ev.at), "fx-flash", FLASH_MS);
        if (sound) (ev.add ? sfx.addcounter : sfx.removecounter)();
        break;
      case "reveal":
        if (sound) sfx.reveal();
        break;
      case "shuffle":
        if (sound) sfx.shuffle();
        break;
      case "coin":
        showToss("coin", ev.results);
        if (sound) sfx.coinflip();
        break;
      case "dice":
        showToss("dice", ev.results);
        if (sound) sfx.diceroll();
        break;
      case "draw":
        // Draw is per-count (no per-card coords), so fly `count` cards from the
        // deck to the drawing player's hand; they reveal (back → face) on arrival.
        if (fly) {
          for (let k = 0; k < ev.count; k++) {
            const deck = { p: ev.player, zone: "deck", seq: 0 };
            const hand = { p: ev.player, zone: "hand", seq: 0 };
            setTimeout(() => flyCard(deck, hand, { p: ev.player, faceFrom: false, faceTo: ev.player === viewer }), k * 90);
          }
        }
        if (sound) sfx.draw();
        break;
      case "turn":
        if (sound) sfx.nextturn();
        break;
      case "phase":
        if (sound) sfx.phase();
        break;
      case "win":
        // A spectator has no seat to lose from, so the duel ending is a win cue.
        if (sound) (viewer === 2 || ev.player === viewer ? sfx.win : sfx.lose)();
        break;
      default:
        break;
    }
  }

  // Play whatever changed since the last position we showed — forwards (new
  // events) or backwards (scrubbing: replay the tail leading into the new
  // position, so stepping back through an attack still shows the attack).
  // First render plays nothing; long jumps play only their last MAX_BURST events.
  let pending = [];
  $effect(() => {
    const list = events;
    const last = list.length ? list[list.length - 1].i : -1;
    if (seenEvent < 0) { seenEvent = last; return; }
    if (last === seenEvent) return;
    const forward = last > seenEvent;
    const delta = forward ? list.filter((e) => e.i > seenEvent) : list.slice(-3);
    seenEvent = last;
    const burst = delta.slice(-MAX_BURST);
    const fast = burst.length > 4;
    const step = fast ? FAST_STEP_MS : STEP_MS;
    // Fly cards only on a live move / single play-pause tick; a multi-move scrub
    // jump snaps (fast burst) so we don't launch a swarm of catch-up flyers.
    const fly = !fast;
    for (const t of pending) clearTimeout(t);
    pending = burst.map((e, k) => setTimeout(() => play(e, fly), k * step));
  });
</script>

{#snippet slot(p, zone, seq, label)}
  <div data-zone={zoneId(p, zone, seq)} class="justify-self-center {fx[zoneId(p, zone, seq)] ?? ''}">
    <Card card={(zone === "m" ? board.players[p].mzone : board.players[p].szone)[seq]} {label} own={p === viewer} {debug} back={backs[p]} {onhover} {onclick} />
  </div>
{/snippet}

{#snippet emz(mine, theirs)}
  {@const card = bottom.mzone[mine] ?? top.mzone[theirs]}
  {@const owner = bottom.mzone[mine] ? me : 1 - me}
  <div data-zone={zoneId(me, "m", mine)} data-zone-alt={zoneId(1 - me, "m", theirs)} class="justify-self-center {fx[zoneId(me, 'm', mine)] ?? fx[zoneId(1 - me, 'm', theirs)] ?? ''}">
    <Card {card} label="EMZ" own={owner === viewer} {debug} back={backs[owner]} {onhover} {onclick} />
  </div>
{/snippet}

{#snippet pile(p, kind)}
  {@const pl = board.players[p]}
  {@const topGrave = pl.grave[pl.grave.length - 1] ?? null}
  <div class="justify-self-center flex flex-col items-center">
    <div data-zone={zoneId(p, kind, 0)} class="relative transition-transform duration-300 hover:scale-105">
      {#if kind === "grave"}
        <Card card={topGrave ? { ...topGrave, faceDown: false, position: "" } : null} label="GY" count={pl.grave.length} {onhover} {onclick} />
      {:else if kind === "deck"}
        <Card card={pl.deckCount ? { name: null, code: 0, faceDown: true, position: "" } : null} label="deck" count={pl.deckCount} back={backs[p]} />
      {:else}
        <Card card={pl.extraCount ? { name: null, code: 0, faceDown: true, position: "" } : null} label="extra" count={pl.extraCount} back={backs[p]} />
      {/if}
      <!-- The pile is its own button: clicking it lists the whole pile. -->
      <button class="absolute inset-0 z-20 card-box card-zone focus:outline-none" aria-label="list {kind} contents" title="click to list this pile" onclick={() => (openPile = { p, kind })} onmouseenter={() => kind === "grave" && topGrave && onhover(topGrave)}></button>
    </div>
    {#if kind === "grave"}
      <!-- Banished has no printed zone and the 7-column mat has no free cell, so it hangs under the GY as a chip. -->
      <button class="mt-3 px-1.5 py-0.5 rounded text-[0.55rem] leading-none bg-black/50 border border-amber-900/70 text-amber-100/80 hover:bg-amber-900/50" onclick={() => (openPile = { p, kind: "removed" })}>banished {pl.banishCount}</button>
    {/if}
  </div>
{/snippet}

{#snippet hand(p, cards)}
  <div data-zone-area={`${p}-hand`} class="flex gap-1 justify-center py-1 min-h-[calc(var(--card-w-hand)*86/59+0.5rem)]">
    {#each cards as c, i}
      <div data-zone={zoneId(p, "hand", i)}>
        <Card card={c.code ? { ...c, faceDown: false } : { name: null, code: 0, faceDown: true, position: "" }} size="hand" {debug} back={backs[p]} {onhover} {onclick} />
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

<!--
  The mat, as printed: from a player's view the monster row is
  [Field | m0 m1 m2 m3 m4 | GY] and the spell/trap row is [Extra | s0 .. s4 | Deck].
  The opponent's half is the same mat rotated 180°, so their m4 sits across
  from my m0 and their Field zone is on my right. One 7-column grid per half
  keeps every column exactly aligned.
-->
<div bind:this={tableEl} class="relative rounded-xl p-3 bg-[radial-gradient(ellipse_at_center,#1f5f45_0,#0f3d2b_60%,#0a2a1e_100%)] border-4 border-amber-900/70 shadow-2xl select-none">
  <!-- opponent (rotated mat) -->
  <div class="flex items-start justify-between">
    {@render lp(1 - me, "top")}
    <div class="flex-1">{@render hand(1 - me, top.hand)}</div>
    <div class="w-40"></div>
  </div>
  <div class="grid grid-cols-7 gap-y-4 py-2 mx-auto w-fit gap-x-2">
    {@render pile(1 - me, "deck")}
    {#each [4, 3, 2, 1, 0] as seq}{@render slot(1 - me, "s", seq, `s${seq}`)}{/each}
    {@render pile(1 - me, "extra")}
    {@render pile(1 - me, "grave")}
    {#each [4, 3, 2, 1, 0] as seq}{@render slot(1 - me, "m", seq, `m${seq}`)}{/each}
    {@render slot(1 - me, "s", 5, "field")}
  </div>

  <!-- middle: the two shared Extra Monster Zones (my m5 = their m6 on the left,
       my m6 = their m5 on the right, above the m1 and m3 columns) + phase strip -->
  <div class="grid grid-cols-7 items-center py-2 mx-auto w-fit gap-x-2">
    <div></div>
    <div></div>
    {@render emz(5, 6)}
    <div class="flex flex-col items-center gap-1 justify-self-center">
      <div class="flex gap-1">
        {#each PHASES as ph, i}
          <span class="px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold tracking-wide {i === phaseIndex ? 'bg-amber-400 text-amber-950 shadow-[0_0_10px_#fbbf24]' : 'bg-black/30 text-amber-100/50'}">{["DP", "SP", "M1", "BP", "M2", "EP"][i]}</span>
        {/each}
      </div>
      <span class="text-[0.65rem] text-amber-100/70">Turn {board.turn}{board.turnPlayer === null ? "" : ` · P${board.turnPlayer}`}</span>
    </div>
    {@render emz(6, 5)}
    <div></div>
    <div></div>
  </div>

  <!-- me -->
  <div class="grid grid-cols-7 gap-y-4 py-2 mx-auto w-fit gap-x-2">
    {@render slot(me, "s", 5, "field")}
    {#each [0, 1, 2, 3, 4] as seq}{@render slot(me, "m", seq, `m${seq}`)}{/each}
    {@render pile(me, "grave")}
    {@render pile(me, "extra")}
    {#each [0, 1, 2, 3, 4] as seq}{@render slot(me, "s", seq, `s${seq}`)}{/each}
    {@render pile(me, "deck")}
  </div>
  <div class="flex items-end justify-between">
    <div class="w-40"></div>
    <div class="flex-1">{@render hand(me, bottom.hand)}</div>
    {@render lp(me, "bottom")}
  </div>

  {#if board.chain.length}
    <div class="absolute left-1/2 -translate-x-1/2 top-1/2 translate-y-6 bg-black/80 text-yellow-100 text-xs px-3 py-1 rounded pointer-events-none border border-yellow-400/40">
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
    <div class="absolute fx-float font-black text-2xl pointer-events-none {f.cls} [text-shadow:0_0_6px_#000]" style="left:{f.x}px; top:{f.y}px">{f.text}</div>
  {/each}
  <!-- Unified card-flight overlay: one FlyingCard per zone→zone move (see play()). -->
  {#each flyers as f (f.id)}
    <FlyingCard from={f.from} to={f.to} code={f.code} back={f.back} faceFrom={f.faceFrom} faceTo={f.faceTo} duration={FLY_MS} />
  {/each}

  <!-- Coin / dice toss result, centered for ~1s (paired with the coinflip/diceroll SFX). -->
  {#if toss}
    {#key toss.id}
      <div class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" transition:scale={{ duration: 200, start: 0.6 }}>
        <div class="flex flex-col items-center gap-2 rounded-2xl bg-black/75 px-6 py-4 border border-amber-400/40 shadow-2xl">
          <span class="text-[0.6rem] uppercase tracking-widest text-amber-200/80">{toss.kind === "coin" ? "coin toss" : "dice roll"}</span>
          <div class="flex gap-3">
            {#each toss.results as r}
              {#if toss.kind === "coin"}
                <div class="flex flex-col items-center gap-1">
                  <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 flex items-center justify-center shadow-inner ring-2 ring-amber-100">
                    <Icon icon={r ? "mdi:crown" : "mdi:shield-outline"} width="26" height="26" />
                  </div>
                  <span class="text-[0.6rem] font-bold text-amber-100">{r ? "heads" : "tails"}</span>
                </div>
              {:else}
                <div class="flex flex-col items-center gap-1">
                  <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-300 p-1.5 grid grid-cols-3 grid-rows-3 gap-0.5 shadow-inner ring-1 ring-slate-400">
                    {#each Array(9) as _, cell}
                      <span class="rounded-full {diePips(r).includes(cell) ? 'bg-slate-900' : ''}"></span>
                    {/each}
                  </div>
                  <span class="text-[0.6rem] font-bold text-amber-100">{r}</span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/key}
  {/if}
</div>

{#if pileModal}
  <PileModal {...pileModal} back={backs[openPile.p]} {onhover} {onclick} onclose={() => (openPile = null)} />
{/if}

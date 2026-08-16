<script>
  import { onMount } from "svelte";
  import Table from "$lib/pretty/Table.svelte";
  import Preview from "$lib/pretty/Preview.svelte";
  import { isOn, mute, unlock } from "$lib/pretty/sound.js";

  /** How often the page re-fetches the duel; the other seat may be a CLI agent. */
  const POLL_MS = 1500;
  /** Log lines kept in the pane; older lines are still available via the CLI. */
  const LOG_TAIL = 400;

  let { data } = $props();
  // svelte-ignore state_referenced_locally — the server payload seeds local state; polling owns it afterwards.
  let view = $state(data.initial);
  let selected = $state([]);
  let nameInput = $state("");
  let errorText = $state("");
  let busy = $state(false);
  let card = $state(null);
  let logEl = $state(null);
  /** null = live (latest move); a number = playback position, polling paused. */
  let playbackAt = $state(null);
  /** Slider value while dragging; committed on release. */
  // svelte-ignore state_referenced_locally
  let slider = $state(data.initial.at);
  let forkId = $state("");
  let sound = $state(false);
  /** Spectator debug: peek at hidden face-down cards. */
  let debug = $state(false);
  const cardCache = new Map();
  /** Debounce for live scrubbing: each position is a server-side replay. */
  const SCRUB_DEBOUNCE_MS = 120;
  let scrubTimer = null;

  const viewerLabel = $derived(view.viewer === 2 ? "spectator" : `P${view.viewer} — ${view.players[view.viewer]}`);
  const myTurn = $derived(playbackAt === null && !view.ended && view.menu && (view.viewer === view.pendingPlayer || view.viewer === 2));
  const me = $derived(view.viewer === 2 ? 0 : view.viewer);
  const canConfirm = $derived(view.menu && selected.length >= view.menu.min && selected.length <= view.menu.max);

  async function refresh() {
    const atParam = playbackAt === null ? "" : `&at=${playbackAt}`;
    const res = await fetch(`/api/duel/${view.id}?as=${view.viewer === 2 ? "all" : view.viewer}${atParam}`);
    if (!res.ok) return;
    const next = await res.json();
    if (next.moves !== view.moves || next.pendingPlayer !== view.pendingPlayer) selected = [];
    view = next;
    slider = next.at;
    queueMicrotask(() => { if (logEl) logEl.scrollTop = logEl.scrollHeight; });
  }

  async function submit(choice) {
    if (busy) return;
    busy = true;
    errorText = "";
    const asSeat = view.viewer === 2 ? view.pendingPlayer : view.viewer;
    const res = await fetch(`/api/duel/${view.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: asSeat, choice }) });
    const body = await res.json();
    if (!body.ok) errorText = body.error;
    selected = [];
    nameInput = "";
    await refresh();
    busy = false;
  }

  function pick(index) {
    const number = String(index + 1);
    if (view.menu.mode === "one") return submit(number);
    if (view.menu.mode === "many" || view.menu.mode === "order") {
      selected = selected.includes(number) ? selected.filter((n) => n !== number) : [...selected, number];
    }
  }

  async function showCard(c) {
    if (!c || !c.name) return;
    if (!cardCache.has(c.name)) {
      const res = await fetch(`/api/card?name=${encodeURIComponent(c.name)}`);
      cardCache.set(c.name, res.ok ? await res.json() : null);
    }
    card = cardCache.get(c.name);
  }

  async function scrub(value) {
    playbackAt = value >= view.total ? null : value;
    await refresh();
  }

  /** Live scrubbing: update while dragging, debounced so we don't replay per pixel. */
  function scrubbing(value) {
    clearTimeout(scrubTimer);
    scrubTimer = setTimeout(() => scrub(Number(value)), SCRUB_DEBOUNCE_MS);
  }

  async function forkHere() {
    if (!forkId) return;
    const res = await fetch(`/api/duel/${view.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fork: forkId, at: view.at }) });
    const body = await res.json();
    if (!body.ok) { errorText = body.error; return; }
    window.location.href = `/duel/${body.id}?as=${view.viewer === 2 ? "all" : view.viewer}`;
  }

  function toggleSound() {
    if (isOn()) { mute(); sound = false; } else { unlock(); sound = true; }
  }

  onMount(() => {
    const timer = setInterval(() => { if (playbackAt === null) refresh(); }, POLL_MS);
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    return () => clearInterval(timer);
  });
</script>

<svelte:head><title>YuGi — {view.id}</title></svelte:head>

<main class="min-h-screen bg-[#120c08] text-amber-50 p-3 flex flex-col gap-3">
  <header class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
    <a href="/" class="text-amber-300 hover:underline">← duels</a>
    <span class="font-mono text-amber-200">{view.id}</span>
    <span>You: <b>{viewerLabel}</b></span>
    <span class="text-amber-100/70">seat: <a class="underline" href="?as=0">P0</a> <a class="underline" href="?as=1">P1</a> <a class="underline" href="?as=all">all</a></span>
    <button class="px-2 py-0.5 rounded bg-black/40 border border-amber-900" onclick={toggleSound}>{sound ? "🔊 sound on" : "🔇 sound off"}</button>
    {#if view.viewer === 2}
      <button class="px-2 py-0.5 rounded border {debug ? 'bg-fuchsia-300 text-fuchsia-950 border-fuchsia-200' : 'bg-black/40 border-amber-900'}" onclick={() => (debug = !debug)} title="peek at hidden face-down cards (spectator only)">{debug ? "🐞 debug on" : "🐞 debug off"}</button>
    {/if}
    {#if playbackAt !== null}
      <span class="px-3 py-1 rounded bg-yellow-300 text-yellow-950 font-bold">PLAYBACK — move {view.at} of {view.total}</span>
    {:else if view.ended}
      <span class="px-3 py-1 rounded bg-amber-200 text-amber-950 font-bold">DUEL OVER — {view.winner === 2 ? "draw" : `P${view.winner} wins`} ({view.winText})</span>
    {:else}
      <span class="px-3 py-1 rounded font-bold {view.pendingPlayer === view.viewer ? 'bg-emerald-300 text-emerald-950' : 'bg-black/40 text-amber-100/80'}">waiting on P{view.pendingPlayer}</span>
    {/if}
    <span class="flex items-center gap-1 basis-full">
      <button class="px-1.5 rounded bg-black/40" onclick={() => scrub(0)} title="start">⏮</button>
      <button class="px-1.5 rounded bg-black/40" onclick={() => scrub(Math.max(0, view.at - 1))} title="back one move">◀</button>
      <input type="range" min="0" max={view.total} bind:value={slider} oninput={() => scrubbing(slider)} onchange={() => scrub(Number(slider))} class="flex-1 accent-amber-400" />
      <button class="px-1.5 rounded bg-black/40" onclick={() => scrub(view.at + 1)} title="forward one move">▶</button>
      <button class="px-1.5 rounded bg-black/40" onclick={() => scrub(view.total)} title="live">⏭ live</button>
      <span class="text-amber-100/70 font-mono">move {slider}/{view.total}</span>
      {#if playbackAt !== null}
        <input class="w-24 px-1 rounded bg-black/40 border border-amber-900" bind:value={forkId} placeholder="new id" />
        <button class="px-2 rounded bg-amber-300 text-amber-950 disabled:opacity-40" onclick={forkHere} disabled={!forkId} title="copy the game up to this move and play on">fork here</button>
      {/if}
    </span>
  </header>

  <div class="flex gap-3 items-start">
    <Preview {card} />

    <div class="flex-1 min-w-0">
      <Table board={view.state} {me} players={view.players} events={view.events} onhover={showCard} onclick={showCard} {sound} viewer={view.viewer} {debug} />
    </div>

    <aside class="w-80 shrink-0 flex flex-col gap-3">
      <section class="rounded-md bg-black/40 border border-amber-900/60 p-2 max-h-[26rem] overflow-auto">
        {#if playbackAt !== null}
          <p class="text-amber-100/70 text-xs">Playback: position after move {view.at}. ⏭ live to return, or fork here to play on from this point.</p>
          {#if view.menu}<p class="text-amber-100/70 text-xs mt-1">Decision at this point: {view.menu.title}</p>{/if}
        {:else if view.ended}
          <p class="text-amber-100/70 text-xs">The duel is over.</p>
        {:else if myTurn}
          <h3 class="font-bold text-amber-200 text-sm mb-1">{view.menu.title}</h3>
          <div class="flex flex-col gap-1">
            {#each view.menu.items as label, i}
              <button class="text-left text-xs px-2 py-1 rounded border border-amber-900/60 hover:bg-amber-900/40 {selected.includes(String(i + 1)) ? 'bg-yellow-300 text-yellow-950' : 'bg-black/30'}" onclick={() => pick(i)} disabled={busy}>
                <span class="font-mono text-amber-300 mr-1">{i + 1}</span>{label}
                {#if view.menu.mode === "order" && selected.includes(String(i + 1))}<span class="float-right">#{selected.indexOf(String(i + 1)) + 1}</span>{/if}
              </button>
            {/each}
            {#if view.menu.zero}
              <button class="text-left text-xs px-2 py-1 rounded border border-dashed border-amber-900/60 bg-black/30 hover:bg-amber-900/40" onclick={() => submit("0")} disabled={busy}><span class="font-mono text-amber-300 mr-1">0</span>{view.menu.zero}</button>
            {/if}
          </div>
          {#if view.menu.mode === "many" || view.menu.mode === "order"}
            <button class="mt-2 w-full text-xs px-2 py-1 rounded bg-amber-300 text-amber-950 font-bold disabled:opacity-40" onclick={() => submit(selected.join(","))} disabled={busy || !canConfirm}>
              Confirm {selected.length ? `(${selected.join(", ")})` : ""} — need {view.menu.min === view.menu.max ? view.menu.min : `${view.menu.min}–${view.menu.max}`}
            </button>
          {/if}
          {#if view.menu.mode === "name" || view.menu.mode === "counters"}
            <form class="mt-2 flex gap-1" onsubmit={(e) => { e.preventDefault(); submit(view.menu.mode === "name" ? `name:${nameInput}` : nameInput); }}>
              <input class="flex-1 px-1 rounded bg-black/40 border border-amber-900 text-xs" bind:value={nameInput} placeholder={view.menu.mode === "name" ? "exact card name" : "option:count, e.g. 1:2"} />
              <button type="submit" class="px-2 rounded bg-amber-300 text-amber-950 text-xs" disabled={busy}>Send</button>
            </form>
          {/if}
        {:else}
          <p class="text-amber-100/70 text-xs">Waiting for P{view.pendingPlayer} to decide…</p>
        {/if}
        {#if errorText}<p class="text-red-300 text-xs mt-1">{errorText}</p>{/if}
      </section>

      <section class="rounded-md bg-black/40 border border-amber-900/60 p-2">
        <h3 class="font-bold text-amber-200 text-sm mb-1">Log</h3>
        <pre bind:this={logEl} class="h-[22rem] overflow-auto text-[0.68rem] leading-snug whitespace-pre-wrap font-mono text-amber-50/90">{view.logLines.slice(-LOG_TAIL).join("\n")}</pre>
      </section>

      <details class="rounded-md bg-black/40 border border-amber-900/60 p-2 text-xs">
        <summary class="cursor-pointer text-amber-200">LLM state — exactly what an LLM playing this seat is given ({view.prompt.length.toLocaleString()} chars)</summary>
        <div class="flex gap-2 my-1">
          <button class="px-2 py-0.5 rounded bg-black/40 border border-amber-900" onclick={() => navigator.clipboard.writeText(view.prompt)}>copy</button>
          <span class="text-amber-100/60 self-center">CLI: <code>ygo prompt {view.id} --as {view.viewer === 2 ? "all" : view.viewer}</code></span>
        </div>
        <pre class="max-h-[30rem] overflow-auto text-[0.65rem] leading-snug whitespace-pre-wrap font-mono text-amber-50/90">{view.prompt}</pre>
      </details>

      <details class="rounded-md bg-black/40 border border-amber-900/60 p-2 text-xs">
        <summary class="cursor-pointer text-amber-200">Piles &amp; unseen cards</summary>
        {#each view.state.players as p}
          <div class="mt-1"><b>P{p.index}</b> GY: {p.grave.map((c) => c.name).join(", ") || "—"}</div>
          <div class="text-amber-100/70">{p.unseenKind === "deck" ? "Deck (unordered)" : "Unseen (hand + deck + face-down)"} ({p.unseen.length}): {p.unseen.join(", ")}</div>
        {/each}
      </details>
    </aside>
  </div>
</main>

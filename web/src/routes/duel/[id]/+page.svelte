<script>
  import { onMount } from "svelte";

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
  let forkId = $state("");

  const viewerLabel = $derived(view.viewer === 2 ? "spectator (sees everything)" : `P${view.viewer} — ${view.players[view.viewer]}`);
  const myTurn = $derived(playbackAt === null && !view.ended && view.menu && (view.viewer === view.pendingPlayer || view.viewer === 2));
  const me = $derived(view.viewer === 2 ? 0 : view.viewer);
  const bottom = $derived(view.state.players[me]);
  const top = $derived(view.state.players[1 - me]);
  const canConfirm = $derived(view.menu && selected.length >= view.menu.min && selected.length <= view.menu.max);

  async function refresh() {
    const atParam = playbackAt === null ? "" : `&at=${playbackAt}`;
    const res = await fetch(`/api/duel/${view.id}?as=${view.viewer === 2 ? "all" : view.viewer}${atParam}`);
    if (!res.ok) return;
    const next = await res.json();
    if (next.moves !== view.moves || next.pendingPlayer !== view.pendingPlayer) selected = [];
    view = next;
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

  async function showCard(name) {
    if (!name) return;
    const res = await fetch(`/api/card?name=${encodeURIComponent(name)}`);
    card = res.ok ? await res.json() : null;
  }

  async function scrub(value) {
    playbackAt = value >= view.total ? null : value;
    await refresh();
  }

  async function forkHere() {
    if (!forkId) return;
    const res = await fetch(`/api/duel/${view.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fork: forkId, at: view.at }) });
    const body = await res.json();
    if (!body.ok) { errorText = body.error; return; }
    window.location.href = `/duel/${body.id}?as=${view.viewer === 2 ? "all" : view.viewer}`;
  }

  onMount(() => {
    const timer = setInterval(() => { if (playbackAt === null) refresh(); }, POLL_MS);
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    return () => clearInterval(timer);
  });
</script>

<svelte:head><title>YuGi — {view.id}</title></svelte:head>

{#snippet zoneCard(c, label)}
  <button class="card {c ? (c.faceDown ? 'facedown' : 'faceup') : 'empty'} {c && c.name === null ? 'unknown' : ''}" onclick={() => c && showCard(c.name)} title={label}>
    <span class="zone-label">{label}</span>
    {#if c}
      <span class="card-name">{c.name ?? "?"}</span>
      <span class="card-pos">{c.position}</span>
      {#if c.atk !== undefined}<span class="card-stats">{c.atk}/{c.def}</span>{/if}
    {/if}
  </button>
{/snippet}

{#snippet handCard(name)}
  <button class="card hand-card {name === null ? 'facedown unknown' : 'faceup'}" onclick={() => showCard(name)}>
    <span class="card-name">{name ?? "?"}</span>
  </button>
{/snippet}

{#snippet playerRow(p, isTop)}
  <div class="player-block {isTop ? 'top' : 'bottom'}">
    <div class="player-head">
      <strong>P{p.index}</strong> {p.deckName} <span class="muted">({view.players[p.index]})</span>
      · LP <strong>{p.lp}</strong> · hand {p.handCount} · deck {p.deckCount} · GY {p.graveCount} · banished {p.banishCount}
    </div>
    {#if isTop}
      <div class="hand-row">{#each p.hand as name}{@render handCard(name)}{/each}</div>
      <div class="zone-row">{#each [4, 3, 2, 1, 0] as i}{@render zoneCard(p.szone[i], `s${i}`)}{/each}{@render zoneCard(p.szone[5], "field")}</div>
      <div class="zone-row">{#each [4, 3, 2, 1, 0] as i}{@render zoneCard(p.mzone[i], `m${i}`)}{/each}</div>
    {:else}
      <div class="zone-row">{#each [0, 1, 2, 3, 4] as i}{@render zoneCard(p.mzone[i], `m${i}`)}{/each}</div>
      <div class="zone-row">{@render zoneCard(p.szone[5], "field")}{#each [0, 1, 2, 3, 4] as i}{@render zoneCard(p.szone[i], `s${i}`)}{/each}</div>
      <div class="hand-row">{#each p.hand as name}{@render handCard(name)}{/each}</div>
    {/if}
    <details class="piles">
      <summary>GY {p.grave.length} · banished {p.removed.length} · {p.unseenKind === "deck" ? "deck" : "unseen"} {p.unseen.length}</summary>
      <p><b>GY:</b> {p.grave.join(", ") || "—"}</p>
      <p><b>Banished:</b> {p.removed.map((n) => n ?? "?").join(", ") || "—"}</p>
      <p><b>{p.unseenKind === "deck" ? "Deck (unordered)" : "Unseen (hand + deck + face-down)"}:</b> {p.unseen.join(", ")}</p>
    </details>
  </div>
{/snippet}

<main class="duel">
  <header class="bar">
    <a href="/">← duels</a>
    <span><code>{view.id}</code></span>
    <span>Turn {view.state.turn}{view.state.turnPlayer === null ? "" : ` (P${view.state.turnPlayer})`} · {view.state.phaseName}</span>
    <span>You: {viewerLabel}</span>
    <span class="seat-links">seat: <a href="?as=0">P0</a> <a href="?as=1">P1</a> <a href="?as=all">all</a></span>
    {#if playbackAt !== null}
      <span class="banner playback">PLAYBACK — move {view.at} of {view.total}</span>
    {:else if view.ended}
      <span class="banner">DUEL OVER — {view.winner === 2 ? "draw" : `P${view.winner} wins`} ({view.winText})</span>
    {:else}
      <span class="banner {view.pendingPlayer === view.viewer ? 'yours' : ''}">waiting on P{view.pendingPlayer}</span>
    {/if}
    <span class="scrub">
      <button onclick={() => scrub(0)} title="start">⏮</button>
      <button onclick={() => scrub(Math.max(0, view.at - 1))} title="back one move">◀</button>
      <input type="range" min="0" max={view.total} value={view.at} oninput={(e) => scrub(Number(e.currentTarget.value))} />
      <button onclick={() => scrub(view.at + 1)} title="forward one move">▶</button>
      <button onclick={() => scrub(view.total)} title="live">⏭ live</button>
      <span class="muted">move {view.at}/{view.total}</span>
      {#if playbackAt !== null}
        <input class="fork-id" bind:value={forkId} placeholder="new id" />
        <button onclick={forkHere} disabled={!forkId} title="copy the game up to this move and play on">fork here</button>
      {/if}
    </span>
  </header>

  <section class="board">
    {@render playerRow(top, true)}
    <div class="emz-row">
      {@render zoneCard(top.mzone[6], "m6")}
      {@render zoneCard(top.mzone[5], "m5")}
      {#if view.state.chain.length}
        <div class="chain">chain: {view.state.chain.map((l, i) => `${i + 1}. ${l.name} (${l.place})`).join(" → ")}</div>
      {/if}
    </div>
    {@render playerRow(bottom, false)}
  </section>

  <aside class="side">
    <section class="menu">
      {#if playbackAt !== null}
        <p class="muted">Playback: showing the position after move {view.at}. Use ⏭ live to return, or fork here to play on from this point.</p>
        {#if view.menu}<h3 class="muted">Decision at this point: {view.menu.title}</h3>{/if}
      {:else if view.ended}
        <p class="muted">The duel is over.</p>
      {:else if myTurn}
        <h3>{view.menu.title}</h3>
        <div class="options">
          {#each view.menu.items as label, i}
            <button class="option {selected.includes(String(i + 1)) ? 'selected' : ''}" onclick={() => pick(i)} disabled={busy}>
              <span class="num">{i + 1}</span> {label}
              {#if view.menu.mode === "order" && selected.includes(String(i + 1))}<span class="order-badge">#{selected.indexOf(String(i + 1)) + 1}</span>{/if}
            </button>
          {/each}
          {#if view.menu.zero}
            <button class="option zero" onclick={() => submit("0")} disabled={busy}><span class="num">0</span> {view.menu.zero}</button>
          {/if}
        </div>
        {#if view.menu.mode === "many" || view.menu.mode === "order"}
          <button class="confirm" onclick={() => submit(selected.join(","))} disabled={busy || !canConfirm}>
            Confirm {selected.length ? `(${selected.join(", ")})` : ""} — need {view.menu.min === view.menu.max ? view.menu.min : `${view.menu.min}–${view.menu.max}`}
          </button>
        {/if}
        {#if view.menu.mode === "name"}
          <form onsubmit={(e) => { e.preventDefault(); submit(`name:${nameInput}`); }}>
            <input bind:value={nameInput} placeholder="exact card name" />
            <button type="submit" disabled={busy}>Declare</button>
          </form>
        {/if}
        {#if view.menu.mode === "counters"}
          <form onsubmit={(e) => { e.preventDefault(); submit(nameInput); }}>
            <input bind:value={nameInput} placeholder="option:count, e.g. 1:2" />
            <button type="submit" disabled={busy}>Send</button>
          </form>
        {/if}
      {:else}
        <p class="muted">Waiting for P{view.pendingPlayer} to decide…</p>
      {/if}
      {#if errorText}<p class="error">{errorText}</p>{/if}
    </section>

    <section class="log">
      <h3>Log</h3>
      <pre bind:this={logEl}>{view.logLines.slice(-LOG_TAIL).join("\n")}</pre>
    </section>

    <section class="cardinfo">
      {#if card}
        <h3>{card.summary}</h3>
        <p>{card.desc}</p>
      {:else}
        <p class="muted">Click a card for its text.</p>
      {/if}
    </section>
  </aside>
</main>

<style>
  :root {
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --card-w: 6.2rem;
    --card-h: 4.6rem;
    --hand-card-h: 2.4rem;
    --side-w: 26rem;
    --log-h: 22rem;
    --radius: 0.35rem;
    --font-body: system-ui, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --font-size-small: 0.75rem;
    --font-size-tiny: 0.65rem;
    --color-bg: #f7f5ef;
    --color-fg: #222;
    --color-muted: #6b6b6b;
    --color-border: #cfc8b4;
    --color-card-up: #fffdf6;
    --color-card-down: #b9c7d6;
    --color-card-unknown: #98a7b8;
    --color-empty: #ece8dc;
    --color-accent: #2f5d8a;
    --color-yours: #d9f2d0;
    --color-selected: #ffe9a8;
    --color-error: #b00020;
    --color-banner: #eee9da;
  }
  :global(body) { margin: 0; background: var(--color-bg); color: var(--color-fg); font-family: var(--font-body); }
  .duel { display: grid; grid-template-columns: 1fr var(--side-w); grid-template-rows: auto 1fr; gap: var(--space-3); padding: var(--space-3); height: 100vh; box-sizing: border-box; }
  .bar { grid-column: 1 / -1; display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap; }
  .banner { padding: var(--space-1) var(--space-2); background: var(--color-banner); border-radius: var(--radius); }
  .banner.yours { background: var(--color-yours); font-weight: bold; }
  .banner.playback { background: var(--color-selected); }
  .scrub { display: flex; align-items: center; gap: var(--space-1); flex-basis: 100%; }
  .scrub input[type="range"] { flex: 1; min-width: var(--card-w); }
  .fork-id { width: var(--card-w); }
  .seat-links a { margin-right: var(--space-1); }
  .board { display: flex; flex-direction: column; gap: var(--space-2); overflow: auto; }
  .player-block { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-2); }
  .player-head { margin-bottom: var(--space-1); }
  .zone-row, .hand-row, .emz-row { display: flex; gap: var(--space-1); margin: var(--space-1) 0; align-items: center; }
  .emz-row { padding-left: var(--space-2); }
  .card { position: relative; width: var(--card-w); height: var(--card-h); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-card-up); display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: var(--font-size-small); text-align: center; padding: var(--space-1); cursor: pointer; }
  .card.empty { background: var(--color-empty); cursor: default; }
  .card.facedown { background: var(--color-card-down); }
  .card.unknown { background: var(--color-card-unknown); }
  .hand-card { height: var(--hand-card-h); }
  .zone-label { position: absolute; top: 0; left: var(--space-1); font-size: var(--font-size-tiny); color: var(--color-muted); }
  .card-name { font-weight: 600; line-height: 1.1; }
  .card-pos, .card-stats { font-size: var(--font-size-tiny); color: var(--color-muted); }
  .piles { font-size: var(--font-size-small); }
  .chain { margin-left: var(--space-4); font-size: var(--font-size-small); }
  .side { display: flex; flex-direction: column; gap: var(--space-2); overflow: hidden; }
  .menu, .log, .cardinfo { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-2); background: var(--color-card-up); }
  .menu h3, .log h3, .cardinfo h3 { margin: 0 0 var(--space-2); font-size: 1rem; }
  .options { display: flex; flex-direction: column; gap: var(--space-1); max-height: var(--log-h); overflow: auto; }
  .option { text-align: left; padding: var(--space-1) var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius); background: white; cursor: pointer; }
  .option.selected { background: var(--color-selected); }
  .option.zero { border-style: dashed; }
  .num { display: inline-block; min-width: 1.5em; color: var(--color-accent); font-family: var(--font-mono); }
  .order-badge { float: right; color: var(--color-accent); }
  .confirm { margin-top: var(--space-2); width: 100%; padding: var(--space-1); }
  .log pre { margin: 0; height: var(--log-h); overflow: auto; font-family: var(--font-mono); font-size: var(--font-size-small); white-space: pre-wrap; }
  .cardinfo { flex: 1; overflow: auto; font-size: var(--font-size-small); }
  .muted { color: var(--color-muted); }
  .error { color: var(--color-error); }
  a { color: var(--color-accent); }
</style>

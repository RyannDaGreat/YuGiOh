<script>
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import Table from "$lib/pretty/Table.svelte";
  import Preview from "$lib/pretty/Preview.svelte";
  import { isOn, mute, unlock } from "$lib/pretty/sound.js";

  /** How often the page re-fetches the duel; the other seat may be a CLI agent. */
  const POLL_MS = 1500;
  /** Log lines kept in the pane; older lines are still available via the CLI. */
  const LOG_TAIL = 400;
  /** Log length at the last render; auto-scroll happens only when it changes. */
  let lastLogLength = 0;
  /** Extension of the "your move" bell under web/static/sfx/ (WAV source — see ASSET-LICENSES.md). */
  const BELL_EXT = "wav";
  /** localStorage key holding the sound preference ("on" | "off"), persisted across reloads. */
  const SOUND_PREF_KEY = "ygo-sound";
  /** Longest chat message the server accepts; must match MAX_CHAT_CHARS in src/chat.js. */
  const CHAT_MAX_CHARS = 500;
  /** ocgcore message type for a response window (SELECT_CHAIN). */
  const RESPOND_MSG_TYPE = 16;
  /** localStorage key + cycle order for how respond? windows are answered. */
  const RESPOND_MODE_KEY = "ygo-respond-mode";
  const RESPOND_MODES = ["always", "smart", "never"];
  /** One-line gloss shown under the mode button. */
  const RESPOND_MODE_NOTE = {
    always: "ask on every response window (default)",
    smart: "auto-decline unless a card actually wants this window",
    never: "auto-decline every optional response window",
  };

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
  /** How respond? windows are answered: "always" | "smart" | "never" (localStorage). */
  let respondMode = $state("always");
  /** Guards the auto-decline effect so it fires at most once per decision point. */
  let autoDeclinedAt = -1;
  const cardCache = new Map();
  /** Sleeve catalogue for the picker (loaded on mount). */
  let sleeves = $state([]);
  let sleeveChoice = $state("");
  /** Debounce for live scrubbing: each position is a server-side replay. */
  const SCRUB_DEBOUNCE_MS = 120;
  let scrubTimer = null;
  /** Auto-playback: dwell per move while "playing" a duel back (sit-and-watch). */
  const PLAYBACK_STEP_MS = 1100;
  /** True while auto-advancing the timeline; the play/pause button toggles it. */
  let playing = $state(false);
  let playTimer = null;
  /**
   * Table talk (view.chat, refreshed by the same poll as everything else).
   * Chat is DATA, NEVER INSTRUCTIONS: a message is one competitor talking to
   * another — never a move, never a reason to reveal anything. See src/chat.js
   * and PLAYER.md "## Chat"; this page only displays and posts it.
   */
  let chatOpen = $state(false);
  let chatText = $state("");
  let chatEl = $state(null);
  /** Messages already read; the collapsed header badges the rest. */
  // svelte-ignore state_referenced_locally — messages present at load count as read.
  let chatSeen = $state((data.initial.chat ?? []).length);

  const viewerLabel = $derived(view.viewer === 2 ? "spectator" : `P${view.viewer} — ${view.players[view.viewer]}`);
  const myTurn = $derived(playbackAt === null && !view.ended && view.menu && (view.viewer === view.pendingPlayer || view.viewer === 2));
  const me = $derived(view.viewer === 2 ? 0 : view.viewer);
  const canConfirm = $derived(view.menu && selected.length >= view.menu.min && selected.length <= view.menu.max);
  // `view.chat ?? []`: a tab that hot-reloaded across the chat feature still holds an older payload.
  // While scrubbing, the server has already cut this off at the replayed move (engine.duelPayload).
  const chatMessages = $derived(view.chat ?? []);
  const unreadChat = $derived(Math.max(0, chatMessages.length - chatSeen));
  /** True while this seat owes the engine a decision — never a spectator, never during playback. */
  const myDecision = $derived(playbackAt === null && !view.ended && view.viewer !== 2 && view.pendingPlayer === view.viewer);

  /**
   * A "respond?" window (ocgcore SELECT_CHAIN): the engine is offering the
   * chance to interrupt, not asking for a move. Detected off the masked pending
   * message; the menu title is a fallback for payloads without `pending`.
   */
  const isRespond = $derived(Boolean(view.menu) && (view.pending?.type === RESPOND_MSG_TYPE || view.menu.title.includes("respond?")));
  /** A forced chain has no legal decline (menu.zero is null); never auto-answer it. */
  const respondForced = $derived(Boolean(view.pending?.forced) || (isRespond && view.menu?.zero == null));
  /** ocgcore's count of options at a timing a card actually wants (docs §A.1). */
  const respondSpeCount = $derived(view.pending?.spe_count ?? 0);
  /** "P1's turn — Battle Phase; possible timing: …", pulled from the menu title. */
  const respondHeader = $derived.by(() => {
    const inside = view.menu?.title.match(/respond\? \((.*)\)(?: \[must activate\])?$/)?.[1];
    if (inside) return inside;
    const s = view.state;
    return s.turnPlayer === null ? "" : `P${s.turnPlayer}'s turn — ${s.phaseName}`;
  });
  /**
   * Whether this response window should be auto-declined (submit "0"). Never for
   * a forced chain, a non-respond decision, or "always" mode. In "smart" we stop
   * only when the engine flags the window worth it: forced, or spe_count > 0
   * (which the core already inflates to the full option count when a chain is in
   * progress or an attack was declared — see docs/response-prompt-ux.md §A.1).
   */
  const autoDeclineWanted = $derived.by(() => {
    if (!isRespond || respondForced || !view.menu?.zero) return false;
    if (respondMode === "always") return false;
    if (respondMode === "never") return true;
    return respondSpeCount === 0; // smart
  });

  async function refresh() {
    const atParam = playbackAt === null ? "" : `&at=${playbackAt}`;
    const res = await fetch(`/api/duel/${view.id}?as=${view.viewer === 2 ? "all" : view.viewer}${atParam}`);
    if (!res.ok) return;
    const next = await res.json();
    if (next.moves !== view.moves || next.pendingPlayer !== view.pendingPlayer) selected = [];
    view = next;
    slider = next.at;
    // Follow the log only when it grew, so the reader can scroll up between events.
    if (next.logLines.length !== lastLogLength) {
      lastLogLength = next.logLines.length;
      queueMicrotask(() => { if (logEl) logEl.scrollTop = logEl.scrollHeight; });
    }
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
    stopPlaying(); // a manual grab of the slider takes over from auto-playback
    clearTimeout(scrubTimer);
    scrubTimer = setTimeout(() => scrub(Number(value)), SCRUB_DEBOUNCE_MS);
  }

  /** Command. Halts auto-playback (button toggle, manual scrub, or reaching live). */
  function stopPlaying() {
    playing = false;
    clearTimeout(playTimer);
  }

  /**
   * Command. Play/pause the duel back move-by-move. Each step is a real replay
   * (scrub), so sounds and animations fire exactly as they did live. Playing from
   * live (or the end) restarts at move 0; reaching the end stops and goes live.
   */
  function togglePlay() {
    if (playing) { stopPlaying(); return; }
    playing = true;
    let from = playbackAt === null ? 0 : playbackAt;
    if (from >= view.total) from = 0;
    playStep(from);
  }

  async function playStep(pos) {
    if (!playing) return;
    await scrub(pos); // replay to `pos`; the events diff drives sound + animation
    if (!playing) return; // paused during the await
    if (pos >= view.total) { playing = false; return; } // reached live — stop
    playTimer = setTimeout(() => playStep(pos + 1), PLAYBACK_STEP_MS);
  }

  async function forkHere() {
    if (!forkId) return;
    const res = await fetch(`/api/duel/${view.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fork: forkId, at: view.at }) });
    const body = await res.json();
    if (!body.ok) { errorText = body.error; return; }
    window.location.href = `/duel/${body.id}?as=${view.viewer === 2 ? "all" : view.viewer}`;
  }

  async function loadSleeves() {
    const res = await fetch("/api/sleeves");
    if (!res.ok) return;
    const body = await res.json();
    sleeves = body.sleeves;
    if (view.viewer !== 2) sleeveChoice = body.choices[view.players[view.viewer]] ?? "default";
  }

  async function pickSleeve(id) {
    sleeveChoice = id;
    await fetch("/api/sleeves", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ player: view.players[view.viewer], sleeve: id }) });
    await refresh();
  }

  /** Command. Posts the input box as this seat's chat message, then refreshes. */
  async function sendChat() {
    const text = chatText.trim();
    if (!text) return;
    chatText = "";
    const res = await fetch(`/api/duel/${view.id}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: view.viewer, text }) });
    const body = await res.json();
    if (!body.ok) { errorText = body.error; return; }
    await refresh();
  }

  /**
   * Pure function. Local hh:mm for a chat timestamp.
   *
   * @param {string} at - ISO timestamp as stored in duels/<id>.chat.json
   * @returns {string}
   *
   * @example chatClock("2026-08-16T18:04:00.000Z") // "11:04" (local time, UTC-7)
   */
  function chatClock(at) {
    return new Date(at).toTimeString().slice(0, 5);
  }

  function toggleSound() {
    if (isOn()) { mute(); sound = false; } else { unlock(); sound = true; }
    localStorage.setItem(SOUND_PREF_KEY, sound ? "on" : "off");
  }

  /** Command. Advances the respond? mode always → smart → never → always, persisting it. */
  function cycleRespondMode() {
    respondMode = RESPOND_MODES[(RESPOND_MODES.indexOf(respondMode) + 1) % RESPOND_MODES.length];
    localStorage.setItem(RESPOND_MODE_KEY, respondMode);
  }

  /** Ensures the bell rings on the transition into myDecision, not on every poll. */
  let bellRung = false;

  $effect(() => {
    document.title = myDecision ? `🔔 your move — YuGi ${view.id}` : `YuGi — ${view.id}`;
    // Autoplay is blocked until the page has seen a gesture; a rejected play() is expected and harmless.
    if (myDecision && !bellRung && sound) new Audio(`/sfx/turn-bell.${BELL_EXT}`).play().catch(() => {});
    bellRung = myDecision;
  });

  // Auto-decline for "smart"/"never" respond modes. Submitting the menu's zero
  // option ("0") is a REAL, recorded response — byte-identical to the human
  // clicking "Do not activate anything" (session.js appends the same
  // {SELECT_CHAIN, index: null}). This lives in the page ON PURPOSE and must
  // never move into the engine, or stored duels would desync (docs §C).
  // `autoDeclinedAt` keys it to view.moves so it fires once per decision point.
  $effect(() => {
    if (!myDecision || playbackAt !== null || busy || !autoDeclineWanted) return;
    if (autoDeclinedAt === view.moves) return;
    autoDeclinedAt = view.moves;
    submit("0");
  });

  $effect(() => {
    // During playback the list is truncated to the replayed move, so reading it says nothing about the live log.
    if (!chatOpen || playbackAt !== null) return;
    chatSeen = chatMessages.length;
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  });

  onMount(() => {
    loadSleeves();
    const storedMode = localStorage.getItem(RESPOND_MODE_KEY);
    if (RESPOND_MODES.includes(storedMode)) respondMode = storedMode;
    const timer = setInterval(() => { if (playbackAt === null) refresh(); }, POLL_MS);
    if (logEl) logEl.scrollTop = logEl.scrollHeight;

    // Restore the sound preference. Browsers block audio until a user gesture,
    // so we can only show the toggle in its stored state now and actually arm
    // the AudioContext on the first pointer/key event on the page.
    const wantsSound = localStorage.getItem(SOUND_PREF_KEY) === "on";
    if (wantsSound) sound = true;
    const armSound = () => {
      window.removeEventListener("pointerdown", armSound);
      window.removeEventListener("keydown", armSound);
      if (wantsSound && !isOn()) { unlock(); sound = true; }
    };
    window.addEventListener("pointerdown", armSound, { once: true });
    window.addEventListener("keydown", armSound, { once: true });

    return () => {
      clearInterval(timer);
      clearTimeout(playTimer);
      window.removeEventListener("pointerdown", armSound);
      window.removeEventListener("keydown", armSound);
    };
  });
</script>

<svelte:head><title>YuGi — {view.id}</title></svelte:head>

<main class="min-h-screen bg-[#120c08] text-amber-50 p-3 flex flex-col gap-3">
  <header class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
    <a href="/" class="text-amber-300 hover:underline inline-flex items-center gap-1"><Icon icon="mdi:arrow-left" />duels</a>
    <span class="font-mono text-amber-200">{view.id}</span>
    <span>You: <b>{viewerLabel}</b></span>
    <span class="text-amber-100/70">seat: <a class="underline" href="?as=0">P0</a> <a class="underline" href="?as=1">P1</a> <a class="underline" href="?as=all">all</a></span>
    <span class="flex items-center gap-2">
      {#each view.presence as p}
        <span class="px-2 py-0.5 rounded bg-black/40 border border-amber-900 flex items-center gap-1" title={p.online ? `${p.kind} heartbeat ${Math.round(p.ageMs / 1000)}s ago` : "no one holds this seat"}>
          <Icon icon={p.online ? "mdi:circle" : "mdi:circle-outline"} class={p.online ? "text-emerald-400" : "text-red-400"} width="10" height="10" />
          P{p.seat}{view.players[p.seat] && view.players[p.seat] !== `P${p.seat}` ? ` · ${view.players[p.seat]}` : ""} {p.online ? `online (${p.kind})` : "offline"}
        </span>
      {/each}
    </span>
    <button class="px-2 py-0.5 rounded bg-black/40 border border-amber-900 inline-flex items-center gap-1" onclick={toggleSound}><Icon icon={sound ? "mdi:volume-high" : "mdi:volume-off"} />{sound ? "sound on" : "sound off"}</button>
    {#if view.viewer !== 2}
      <!-- Respond-mode control, pre-settable here and mirrored in the response panel. -->
      <button class="px-2 py-0.5 rounded border border-indigo-400/60 bg-indigo-900/50 text-indigo-100 inline-flex items-center gap-1" onclick={cycleRespondMode} title="how respond? windows are answered — click to cycle. {RESPOND_MODE_NOTE[respondMode]}"><Icon icon="mdi:shield-flash-outline" />respond: {respondMode}</button>
    {/if}
    {#if view.viewer !== 2 && sleeves.length}
      <label class="text-amber-100/70">sleeve
        <select class="ml-1 px-1 rounded bg-black/40 border border-amber-900 text-amber-50" value={sleeveChoice} onchange={(e) => pickSleeve(e.currentTarget.value)}>
          {#each sleeves as s}<option value={s.id}>{s.name}</option>{/each}
        </select>
      </label>
    {/if}
    {#if view.viewer === 2}
      <button class="px-2 py-0.5 rounded border inline-flex items-center gap-1 {debug ? 'bg-fuchsia-300 text-fuchsia-950 border-fuchsia-200' : 'bg-black/40 border-amber-900'}" onclick={() => (debug = !debug)} title="peek at hidden face-down cards (spectator only)"><Icon icon="mdi:bug" />{debug ? "debug on" : "debug off"}</button>
    {/if}
    {#if playbackAt !== null}
      <span class="px-3 py-1 rounded bg-yellow-300 text-yellow-950 font-bold">PLAYBACK — move {view.at} of {view.total}</span>
    {:else if view.ended}
      <span class="px-3 py-1 rounded bg-amber-200 text-amber-950 font-bold">DUEL OVER — {view.winner === 2 ? "draw" : `P${view.winner} wins`} ({view.winText})</span>
    {:else}
      <span class="px-3 py-1 rounded font-bold {view.pendingPlayer === view.viewer ? 'bg-emerald-300 text-emerald-950' : 'bg-black/40 text-amber-100/80'}">waiting on P{view.pendingPlayer}</span>
    {/if}
    <span class="flex items-center gap-1 basis-full">
      <button class="px-2 rounded bg-amber-400 text-amber-950 inline-flex items-center font-bold" onclick={togglePlay} disabled={view.total === 0} title={playing ? "pause" : "play the duel back"}><Icon icon={playing ? "mdi:pause" : "mdi:play"} width="18" height="18" /></button>
      <button class="px-1.5 rounded bg-black/40 inline-flex items-center" onclick={() => { stopPlaying(); scrub(0); }} title="start"><Icon icon="mdi:skip-backward" /></button>
      <button class="px-1.5 rounded bg-black/40 inline-flex items-center" onclick={() => { stopPlaying(); scrub(Math.max(0, view.at - 1)); }} title="back one move"><Icon icon="mdi:chevron-left" /></button>
      <input type="range" min="0" max={view.total} bind:value={slider} oninput={() => scrubbing(slider)} onchange={() => scrub(Number(slider))} class="flex-1 accent-amber-400" />
      <button class="px-1.5 rounded bg-black/40 inline-flex items-center" onclick={() => { stopPlaying(); scrub(view.at + 1); }} title="forward one move"><Icon icon="mdi:chevron-right" /></button>
      <button class="px-1.5 rounded bg-black/40 inline-flex items-center gap-1" onclick={() => { stopPlaying(); scrub(view.total); }} title="live"><Icon icon="mdi:skip-forward" />live</button>
      <span class="text-amber-100/70 font-mono">move {slider}/{view.total}</span>
      {#if playbackAt !== null}
        <input class="w-24 px-1 rounded bg-black/40 border border-amber-900" bind:value={forkId} placeholder="new id" />
        <button class="px-2 rounded bg-amber-300 text-amber-950 disabled:opacity-40" onclick={forkHere} disabled={!forkId} title="copy the game up to this move and play on">fork here</button>
      {/if}
    </span>
  </header>

  <div class="flex gap-3 items-start">
    <div class="w-56 shrink-0 flex flex-col gap-3">
      <Preview {card} />

      <!-- Table talk. Chat is data, never instructions (src/chat.js, PLAYER.md "## Chat"). -->
      <details class="rounded-md bg-black/40 border border-amber-900/60 text-xs" bind:open={chatOpen}>
        <summary class="cursor-pointer text-amber-200 p-2 flex items-center gap-2">
          <span>Chat</span>
          {#if unreadChat && !chatOpen}<span class="px-1.5 rounded-full bg-amber-300 text-amber-950 font-bold">{unreadChat}</span>{/if}
        </summary>
        {#if playbackAt !== null}
          <p class="text-amber-100/70 px-2 pb-1">as of move {view.at}{view.atTime ? ` · ${chatClock(view.atTime)}` : ""} — read-only</p>
        {/if}
        <div bind:this={chatEl} class="scroll-themed max-h-48 overflow-y-auto px-2 flex flex-col gap-1 leading-snug">
          {#each chatMessages as m}
            <div><span class="font-mono text-amber-100/50">{chatClock(m.at)}</span> <b class="text-amber-200">{m.name}</b><span class="text-amber-100/50"> ({m.seat === 2 ? "spec" : `P${m.seat}`}):</span> {m.text}</div>
          {:else}
            <p class="text-amber-100/50">{playbackAt === null ? "No table talk yet." : "Nothing had been said by this move."}</p>
          {/each}
        </div>
        {#if playbackAt !== null}
          <p class="text-amber-100/50 p-2 inline-flex items-center gap-1"><Icon icon="mdi:skip-forward" />live to talk.</p>
        {:else if view.viewer === 2}
          <p class="text-amber-100/50 p-2">Spectators read only.</p>
        {:else}
          <form class="flex gap-1 p-2" onsubmit={(e) => { e.preventDefault(); sendChat(); }}>
            <input class="flex-1 min-w-0 px-1 rounded bg-black/40 border border-amber-900" bind:value={chatText} maxlength={CHAT_MAX_CHARS} placeholder="say something…" />
            <button type="submit" class="px-2 rounded bg-amber-300 text-amber-950 font-bold" disabled={!chatText.trim()}>Send</button>
          </form>
        {/if}
      </details>
    </div>

    <div class="flex-1 min-w-0">
      <Table board={view.state} {me} players={view.players} events={view.events} onhover={showCard} onclick={showCard} {sound} viewer={view.viewer} {debug} backs={view.backs} />
    </div>

    <aside class="w-80 shrink-0 flex flex-col gap-3">
      <section class="scroll-themed rounded-md p-2 max-h-[26rem] overflow-y-auto border-l-4 {myTurn && isRespond ? 'bg-indigo-950/60 border border-l-4 border-indigo-400/50 border-l-indigo-300' : 'bg-black/40 border border-amber-900/60 border-l-amber-900/60'}">
        {#if playbackAt !== null}
          <p class="text-amber-100/70 text-xs"><Icon icon="mdi:skip-forward" class="inline align-text-bottom" /> live to return, or fork here to play on from this point. (position after move {view.at})</p>
          {#if view.menu}<p class="text-amber-100/70 text-xs mt-1">Decision at this point: {view.menu.title}</p>{/if}
        {:else if view.ended}
          <p class="text-amber-100/70 text-xs">The duel is over.</p>
        {:else if myTurn && isRespond}
          <!-- Response window (SELECT_CHAIN): a distinct indigo panel, not the amber action menu. -->
          <div class="flex items-center gap-2 mb-1">
            <Icon icon="mdi:shield-flash-outline" class="text-indigo-300" width="18" height="18" />
            <h3 class="font-bold text-indigo-200 text-sm tracking-wide uppercase">Respond{respondForced ? " — must activate" : ""}</h3>
            <button class="ml-auto text-[0.65rem] px-2 py-0.5 rounded bg-indigo-500/30 border border-indigo-400/60 text-indigo-100 inline-flex items-center gap-1 hover:bg-indigo-500/50" onclick={cycleRespondMode} title="cycle how respond windows are answered"><Icon icon="mdi:autorenew" width="12" height="12" />{respondMode}</button>
          </div>
          <p class="text-indigo-100/80 text-[0.7rem] mb-1">{respondHeader}</p>
          <p class="text-indigo-100/45 text-[0.6rem] mb-2">mode: <b class="text-indigo-100/70">{respondMode}</b> — {RESPOND_MODE_NOTE[respondMode]}{respondMode === "smart" ? ` (this window: ${respondSpeCount > 0 ? "worth stopping" : "would auto-decline"})` : ""}</p>
          <div class="flex flex-col gap-1">
            {#each view.menu.items as label, i}
              <button class="text-left text-xs px-2 py-1 rounded border border-indigo-400/40 bg-indigo-900/40 hover:bg-indigo-700/50 text-indigo-50" onclick={() => submit(String(i + 1))} disabled={busy}>
                <span class="font-mono text-indigo-300 mr-1">{i + 1}</span>{label}
              </button>
            {/each}
            {#if view.menu.zero}
              <button class="text-left text-xs px-2 py-1 rounded border border-dashed border-indigo-400/50 bg-black/30 hover:bg-indigo-800/40 text-indigo-100" onclick={() => submit("0")} disabled={busy}><span class="font-mono text-indigo-300 mr-1">0</span>{view.menu.zero}</button>
            {/if}
          </div>
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
        <pre bind:this={logEl} class="scroll-themed h-[22rem] overflow-y-auto text-[0.68rem] leading-snug whitespace-pre-wrap font-mono text-amber-50/90">{view.logLines.slice(-LOG_TAIL).join("\n")}</pre>
      </section>

      <details class="rounded-md bg-black/40 border border-amber-900/60 p-2 text-xs">
        <summary class="cursor-pointer text-amber-200">LLM state — exactly what an LLM playing this seat is given ({view.prompt.length.toLocaleString()} chars)</summary>
        <div class="flex gap-2 my-1">
          <button class="px-2 py-0.5 rounded bg-black/40 border border-amber-900" onclick={() => navigator.clipboard.writeText(view.prompt)}>copy</button>
          <span class="text-amber-100/60 self-center">CLI: <code>ygo prompt {view.id} --as {view.viewer === 2 ? "all" : view.viewer}</code></span>
        </div>
        <pre class="scroll-themed max-h-[30rem] overflow-y-auto text-[0.65rem] leading-snug whitespace-pre-wrap font-mono text-amber-50/90">{view.prompt}</pre>
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

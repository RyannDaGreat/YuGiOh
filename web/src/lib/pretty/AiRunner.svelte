<script>
  /**
   * Runs the AI seats of a duel in this tab and shows what they are doing.
   *
   * On the static host the whole engine is in the page, so each AI seat is a
   * `playSeat` loop (src/ai/player.js) started right here, driven by the key in
   * this browser. On the Node host the browser tab has no card data, and AI
   * seats are driven from the CLI instead (`ygo brief`) — the panel says so.
   *
   * @prop {string} duelId
   * @prop {object} seats      {0: Seat, 1: Seat} from src/ai/seats.js
   * @prop {string[]} players  seat labels
   * @prop {() => void} onkeys open the API keys modal
   * @prop {boolean} ended     the duel is over — nothing to run
   */
  import Icon from "@iconify/svelte";
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { STATIC } from "$lib/host.js";
  import { getKey } from "$lib/keys.js";
  import { PROVIDER_CATALOG } from "../../../../src/ai/catalog.js";
  import TraceViewer from "./TraceViewer.svelte";
  import { panelOpen, setPanelOpen } from "$lib/panels.js";

  let { duelId, seats = { 0: { kind: "human" }, 1: { kind: "human" } }, players = ["P0", "P1"], onkeys = () => {}, ended = false } = $props();

  const aiSeats = $derived([0, 1].filter((s) => seats[s]?.kind === "ai"));
  /** Open/closed, remembered across reloads (see $lib/panels.js). */
  let panelIsOpen = $state(panelOpen("ai", true));

  /** Pure function. A seat's blank run record. */
  const blankRun = () => ({ status: "idle", moves: 0, last: "", error: "", controller: null, traces: [], showLog: false, retries: 0, resumeTimer: null });
  /**
   * After a provider error, how long to wait before resuming the seat. There is no
   * cap: an AI seat is held for as long as the page is open, and a page that has
   * been open all along should never show its AI as gone. Under the presence
   * window (30s), so a retry pause never reads as offline either.
   */
  const RESUME_DELAY_MS = 15000;
  /**
   * Per-seat run state, created eagerly for both seats: Svelte forbids creating
   * state during render, so a lazy "make it on first touch" from the template
   * throws state_unsafe_mutation and takes the whole panel down.
   */
  let runs = $state({ 0: blankRun(), 1: blankRun() });
  let ai = null; // the engine-backed AI module, loaded once on the static host

  /** Query. A seat's run record. */
  const run = (seat) => runs[seat];

  /** Command. Loads existing traces for a seat so the log is complete across reloads. */
  async function loadExisting(seat) {
    if (!ai) return;
    try {
      run(seat).traces = ai.loadTrace(duelId, seat);
    } catch {
      run(seat).traces = [];
    }
  }

  /** Command. Starts the loop for one AI seat. Stops any earlier one for that seat first. */
  async function start(seat) {
    const cfg = seats[seat];
    const r = run(seat);
    stop(seat);
    r.status = "starting";
    const apiKey = getKey(cfg.provider);
    if (!apiKey) { r.status = "no key"; r.error = `add a ${PROVIDER_CATALOG[cfg.provider].label} key first`; return; }
    ai ??= await import("../../../../src/ai/index.js");
    const playerGuide = await (await fetch(`${base}/PLAYER.md`)).text();
    const controller = new AbortController();
    r.controller = controller;
    r.status = "running";
    r.error = "";
    await loadExisting(seat);
    // Whom this seat may answer: the spectator and any human seat are people; the
    // other seat, if it is an AI, is answered only as its talk level allows.
    const people = [2, ...[0, 1].filter((s) => seats[s]?.kind !== "ai")];
    ai.playSeat({
      duelId, seat, provider: cfg.provider, model: cfg.model, options: cfg.options, apiKey, playerGuide,
      people, aiSeats: aiSeats.filter((s) => s !== seat), talk: cfg.talk,
      signal: controller.signal,
      onTrace: (rec) => {
        if (rec.move !== null) { r.moves += 1; r.traces = [...r.traces, rec]; r.retries = 0; }
        else r.traces = [...r.traces, rec];
        r.last = rec.chosenLabel ?? "";
        if (rec.error) r.error = rec.error;
      },
    }).then((res) => {
      if (r.controller !== controller) return; // superseded
      r.status = res.reason === "ended" ? "finished" : res.reason;
      r.controller = null;
    }).catch((err) => {
      if (r.controller !== controller) return;
      r.status = "error";
      r.error = String(err.message ?? err);
      r.controller = null;
      // A provider hiccup (rate limit, an incomplete answer, a dropped connection)
      // must not end the game: resume after a pause, keeping the error visible.
      // Only a Stop from the user, or a fresh Start, cancels the retry.
      r.retries = (r.retries ?? 0) + 1;
      r.status = `error — retrying in ${RESUME_DELAY_MS / 1000}s (attempt ${r.retries})`;
      r.resumeTimer = setTimeout(() => { r.resumeTimer = null; if (r.controller === null) start(seat); }, RESUME_DELAY_MS);
    });
  }

  /** Command. Aborts a seat's loop and any pending auto-resume. */
  function stop(seat) {
    const r = run(seat);
    r.controller?.abort();
    r.controller = null;
    if (r.resumeTimer) { clearTimeout(r.resumeTimer); r.resumeTimer = null; }
    if (r.status === "running" || String(r.status).startsWith("error — retrying")) r.status = "stopped";
  }

  /** Command. Toggles the LLM log for a seat, loading stored traces on first open. */
  async function toggleLog(seat) {
    const r = run(seat);
    r.showLog = !r.showLog;
    if (r.showLog && !r.traces.length) {
      ai ??= await import("../../../../src/ai/index.js");
      await loadExisting(seat);
    }
  }

  onMount(() => {
    // AI seats start on their own when the page opens: that is what "this seat is
    // an AI" means. Nothing starts without a key, and nothing starts on a finished duel.
    if (STATIC && !ended) for (const s of aiSeats) start(s);
    return () => { for (const s of [0, 1]) stop(s); };
  });
</script>

{#if aiSeats.length}
  <!-- Collapsible, remembered: the panel shows what an AI just did ("last: Set …"), which can spoil a game you are playing against it. -->
  <details class="rounded-md p-2 bg-indigo-950/40 border border-indigo-400/40 text-xs flex flex-col gap-2" bind:open={panelIsOpen} ontoggle={(e) => setPanelOpen("ai", e.currentTarget.open)}>
    <summary class="flex items-center gap-2 cursor-pointer list-none">
      <Icon icon="mdi:robot-outline" class="text-indigo-300" width="16" height="16" />
      <h3 class="font-bold text-indigo-200 uppercase tracking-wide">AI players</h3>
      <span class="text-indigo-100/50">{panelIsOpen ? "" : `${aiSeats.length} seat${aiSeats.length === 1 ? "" : "s"} · ${aiSeats.map((s) => run(s).status).join(", ")}`}</span>
      <button class="ml-auto px-2 py-0.5 rounded border border-indigo-400/50 hover:bg-indigo-800/40 inline-flex items-center gap-1" onclick={(e) => { e.preventDefault(); onkeys(); }} title="API keys"><Icon icon="mdi:key-variant" width="12" height="12" />keys</button>
      <Icon icon={panelIsOpen ? "mdi:chevron-up" : "mdi:chevron-down"} class="text-indigo-300" width="14" height="14" />
    </summary>
    {#if !STATIC}
      <p class="text-indigo-100/70">On the local server, AI seats are driven from the CLI — <code>node bin/ygo.js brief {duelId} --as &lt;seat&gt;</code> prints the prompt an agent plays from. In-page AI runs on the static site.</p>
    {/if}
    {#each aiSeats as seat}
      {@const cfg = seats[seat]}
      {@const r = run(seat)}
      <div class="rounded border border-indigo-400/30 bg-black/30 p-2 flex flex-col gap-1">
        <div class="flex items-center gap-2 flex-wrap">
          <b class="text-indigo-100">P{seat} · {players[seat]}</b>
          <span class="text-indigo-100/60">{PROVIDER_CATALOG[cfg.provider]?.label ?? cfg.provider} / {cfg.model}</span>
          <span class="ml-auto font-mono px-1.5 rounded {r.status === 'running' ? 'bg-emerald-300 text-emerald-950' : String(r.status).startsWith('error') || r.status === 'no key' ? 'bg-red-300 text-red-950' : 'bg-black/40 text-indigo-100/70'}">{r.status}</span>
        </div>
        <div class="text-indigo-100/70">{r.moves} move{r.moves === 1 ? "" : "s"}{r.last ? ` · last: ${r.last}` : ""}</div>
        {#if r.error}<div class="text-red-300 whitespace-pre-wrap">{r.error}</div>{/if}
        {#if STATIC && !ended}
          <div class="flex items-center gap-1">
            {#if r.status === "running" || String(r.status).startsWith("error — retrying") || r.status === "starting"}
              <button class="px-2 py-0.5 rounded bg-red-300 text-red-950 font-bold" onclick={() => stop(seat)}>Stop</button>
            {:else}
              <button class="px-2 py-0.5 rounded bg-emerald-300 text-emerald-950 font-bold" onclick={() => start(seat)}>Start</button>
            {/if}
            <button class="px-2 py-0.5 rounded border border-indigo-400/50 hover:bg-indigo-800/40 inline-flex items-center gap-1" onclick={() => toggleLog(seat)}><Icon icon="mdi:text-box-search-outline" width="12" height="12" />{r.showLog ? "hide" : "view"} LLM log{r.traces.length ? ` (${r.traces.length})` : ""}</button>
          </div>
        {:else if STATIC}
          <button class="self-start px-2 py-0.5 rounded border border-indigo-400/50 hover:bg-indigo-800/40 inline-flex items-center gap-1" onclick={() => toggleLog(seat)}><Icon icon="mdi:text-box-search-outline" width="12" height="12" />{r.showLog ? "hide" : "view"} LLM log</button>
        {/if}
        {#if r.showLog}
          <div class="max-h-96 overflow-y-auto scroll-themed"><TraceViewer records={r.traces} /></div>
        {/if}
      </div>
    {/each}
  </details>
{/if}

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

  let { duelId, seats = { 0: { kind: "human" }, 1: { kind: "human" } }, players = ["P0", "P1"], onkeys = () => {}, ended = false } = $props();

  const aiSeats = $derived([0, 1].filter((s) => seats[s]?.kind === "ai"));

  /** Pure function. A seat's blank run record. */
  const blankRun = () => ({ status: "idle", moves: 0, last: "", error: "", controller: null, traces: [], showLog: false });
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
    const apiKey = getKey(cfg.provider);
    if (!apiKey) { r.status = "no key"; r.error = `add a ${PROVIDER_CATALOG[cfg.provider].label} key first`; return; }
    ai ??= await import("../../../../src/ai/index.js");
    const playerGuide = await (await fetch(`${base}/PLAYER.md`)).text();
    const controller = new AbortController();
    r.controller = controller;
    r.status = "running";
    r.error = "";
    await loadExisting(seat);
    ai.playSeat({
      duelId, seat, provider: cfg.provider, model: cfg.model, options: cfg.options, apiKey, playerGuide,
      signal: controller.signal,
      onTrace: (rec) => {
        if (rec.move !== null) { r.moves += 1; r.traces = [...r.traces, rec]; }
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
    });
  }

  /** Command. Aborts a seat's loop, if any. */
  function stop(seat) {
    const r = run(seat);
    r.controller?.abort();
    r.controller = null;
    if (r.status === "running") r.status = "stopped";
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
  <section class="rounded-md p-2 bg-indigo-950/40 border border-indigo-400/40 text-xs flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <Icon icon="mdi:robot-outline" class="text-indigo-300" width="16" height="16" />
      <h3 class="font-bold text-indigo-200 uppercase tracking-wide">AI players</h3>
      <button class="ml-auto px-2 py-0.5 rounded border border-indigo-400/50 hover:bg-indigo-800/40 inline-flex items-center gap-1" onclick={onkeys} title="API keys"><Icon icon="mdi:key-variant" width="12" height="12" />keys</button>
    </div>
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
          <span class="ml-auto font-mono px-1.5 rounded {r.status === 'running' ? 'bg-emerald-300 text-emerald-950' : r.status === 'error' || r.status === 'no key' ? 'bg-red-300 text-red-950' : 'bg-black/40 text-indigo-100/70'}">{r.status}</span>
        </div>
        <div class="text-indigo-100/70">{r.moves} move{r.moves === 1 ? "" : "s"}{r.last ? ` · last: ${r.last}` : ""}</div>
        {#if r.error}<div class="text-red-300 whitespace-pre-wrap">{r.error}</div>{/if}
        {#if STATIC && !ended}
          <div class="flex items-center gap-1">
            {#if r.status === "running"}
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
  </section>
{/if}

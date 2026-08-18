<script>
  /**
   * The full LLM process for one seat: every move's request and answer, newest
   * first — system prompt, the messages sent, the raw response, the reasoning
   * summary, tokens, latency, retries. Chat replies appear as `move: null` rows.
   *
   * @prop {Array<object>} records   trace records (src/ai/trace.js)
   */
  import Icon from "@iconify/svelte";

  let { records = [] } = $props();
  let openIdx = $state(null);
  let showSystem = $state(false);

  const newestFirst = $derived([...records].reverse());
  const fmt = (n) => (n === null || n === undefined ? "–" : String(n));
</script>

<div class="flex flex-col gap-1 text-[0.7rem]">
  {#if !records.length}
    <p class="text-amber-100/50">No LLM calls yet.</p>
  {/if}
  {#each newestFirst as r, i}
    <div class="rounded border {r.error ? 'border-red-400/50' : 'border-amber-900/60'} bg-black/30">
      <button class="w-full text-left px-2 py-1 flex items-center gap-2 hover:bg-amber-900/20" onclick={() => (openIdx = openIdx === i ? null : i)}>
        <Icon icon={openIdx === i ? "mdi:chevron-down" : "mdi:chevron-right"} width="12" height="12" />
        <span class="font-mono text-amber-300">{r.move === null ? "chat" : `#${r.move}`}</span>
        <span class="flex-1 truncate {r.error ? 'text-red-300' : 'text-amber-50'}">{r.chosenLabel || r.choice || "(no choice)"}</span>
        <span class="text-amber-100/50 font-mono">{fmt(r.latencyMs)}ms · {fmt(r.usage?.in)}/{fmt(r.usage?.out)}{r.usage?.reasoning ? `+${r.usage.reasoning}` : ""} tok{r.retries ? ` · ${r.retries} retr${r.retries === 1 ? "y" : "ies"}` : ""}</span>
      </button>
      {#if openIdx === i}
        <div class="px-2 pb-2 flex flex-col gap-2 border-t border-amber-900/40">
          <p class="text-amber-100/50 pt-1">{r.provider} / {r.model} · {new Date(r.at).toLocaleTimeString()} · options {JSON.stringify(r.options)}</p>
          {#if r.error}<p class="text-red-300 whitespace-pre-wrap">{r.error}</p>{/if}
          {#if r.reasoning}
            <div><b class="text-amber-200">Reasoning</b><pre class="whitespace-pre-wrap font-sans text-amber-50/90 max-h-40 overflow-y-auto scroll-themed">{r.reasoning}</pre></div>
          {/if}
          <div><b class="text-amber-200">Response</b><pre class="whitespace-pre-wrap font-mono text-amber-50/90 max-h-32 overflow-y-auto scroll-themed">{r.response}</pre></div>
          <div>
            <b class="text-amber-200">Messages sent ({r.messages?.length ?? 0})</b>
            {#each r.messages ?? [] as m}
              <details class="mt-1"><summary class="cursor-pointer text-amber-100/70">{m.role} · {m.content.length} chars</summary><pre class="whitespace-pre-wrap font-mono text-amber-50/80 max-h-64 overflow-y-auto scroll-themed">{m.content}</pre></details>
            {/each}
          </div>
          <details bind:open={showSystem}><summary class="cursor-pointer text-amber-100/70">System prompt · {r.system?.length ?? 0} chars (identical every turn — that is what the provider caches)</summary><pre class="whitespace-pre-wrap font-mono text-amber-50/80 max-h-64 overflow-y-auto scroll-themed">{r.system}</pre></details>
        </div>
      {/if}
    </div>
  {/each}
</div>

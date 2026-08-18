<script>
  /**
   * Who plays a seat: a human, or an AI chosen from the provider catalog with
   * its model and thinking options. Rendered entirely from PROVIDER_CATALOG, so
   * a new provider or option needs no change here.
   *
   * @prop {number} seat          0 or 1 (labels only)
   * @prop {object} value         {kind:"human"} | {kind:"ai", provider, model, options}   (bindable)
   * @prop {() => void} onkeys    opens the API keys modal (the gear)
   * @prop {(id: string) => boolean} hasKey   whether a provider has a stored key (to warn)
   */
  import Icon from "@iconify/svelte";
  import { PROVIDER_CATALOG, defaultModel, defaultOptions, getProvider } from "../../../../src/ai/catalog.js";

  let { seat = 0, value = $bindable({ kind: "human" }), onkeys = () => {}, hasKey = () => true } = $props();

  const providerIds = Object.keys(PROVIDER_CATALOG);
  const cat = $derived(value.kind === "ai" ? PROVIDER_CATALOG[value.provider] : null);

  /** Command. Switches the seat's kind; an AI seat starts on the provider's defaults. */
  function setKind(kind) {
    if (kind === "human") { value = { kind: "human" }; return; }
    setProvider(kind);
  }

  /** Command. Picks a provider and resets model + options to its defaults. */
  function setProvider(id) {
    const p = getProvider(id);
    value = { kind: "ai", provider: id, model: defaultModel(p), options: { ...defaultOptions(p) } };
  }
</script>

<div class="flex flex-col gap-1">
  <div class="flex items-center gap-1">
    <select class="flex-1 min-w-0 px-2 py-1 rounded bg-black/40 border border-amber-900" value={value.kind === "human" ? "human" : value.provider} onchange={(e) => setKind(e.currentTarget.value)} title="who plays P{seat}">
      <option value="human">Human</option>
      {#each providerIds as id}<option value={id}>AI — {PROVIDER_CATALOG[id].label}</option>{/each}
    </select>
    {#if value.kind === "ai"}
      <button type="button" class="px-1.5 py-1 rounded border {hasKey(value.provider) ? 'border-amber-900 hover:bg-amber-900/40' : 'border-red-400/70 bg-red-900/30 hover:bg-red-900/50'}" onclick={onkeys} title={hasKey(value.provider) ? "API keys" : `no ${cat.label} key yet — click to add one`}>
        <Icon icon="mdi:cog" />
      </button>
    {/if}
  </div>
  {#if value.kind === "ai"}
    <select class="px-2 py-1 rounded bg-black/40 border border-amber-900 text-xs" bind:value={value.model} title="model">
      {#each cat.models as m}<option value={m.id}>{m.label}</option>{/each}
    </select>
    <div class="flex flex-wrap gap-1">
      {#each cat.options as opt}
        <label class="text-[0.65rem] text-amber-100/70 inline-flex items-center gap-1" title={opt.note}>
          {opt.label}
          <select class="px-1 py-0.5 rounded bg-black/40 border border-amber-900 text-[0.65rem]" bind:value={value.options[opt.name]}>
            {#each opt.values as v}<option value={v}>{v}</option>{/each}
          </select>
        </label>
      {/each}
    </div>
    {#if !hasKey(value.provider)}
      <p class="text-[0.65rem] text-red-300">No {cat.label} key — add one with the gear or this seat cannot play.</p>
    {/if}
  {/if}
</div>

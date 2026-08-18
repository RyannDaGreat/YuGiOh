<script>
  /**
   * API keys for the AI providers, one row each: enter, remember-on-device,
   * test, clear. Keys stay in this browser (see $lib/keys.js). Rendered from
   * PROVIDER_CATALOG, so a new provider needs no UI change.
   *
   * @prop {boolean} open
   * @prop {() => void} onclose
   */
  import Icon from "@iconify/svelte";
  import { PROVIDER_CATALOG, getProvider } from "../../../../src/ai/index.js";
  import { getKey, isRemembered, setKey } from "$lib/keys.js";

  let { open = false, onclose = () => {} } = $props();

  const ids = Object.keys(PROVIDER_CATALOG);
  /** Draft key text per provider, seeded from storage when the modal opens. */
  let draft = $state({});
  let remember = $state({});
  /** Per-provider test result: {ok, detail} | "testing" | null. */
  let result = $state({});
  let show = $state({});

  $effect(() => {
    if (!open) return;
    for (const id of ids) {
      draft[id] = getKey(id);
      remember[id] = isRemembered(id);
      result[id] = null;
    }
  });

  /** Command. Saves the draft for one provider using its remember flag. */
  function save(id) {
    setKey(id, draft[id], remember[id]);
  }

  /** Command. Saves, then asks the provider's cheapest authenticated endpoint whether the key works. */
  async function test(id) {
    save(id);
    result[id] = "testing";
    try {
      result[id] = await getProvider(id).verifyKey(draft[id]);
    } catch (err) {
      result[id] = { ok: false, detail: String(err.message ?? err) };
    }
  }

  /** Command. Forgets a key everywhere. */
  function clear(id) {
    draft[id] = "";
    setKey(id, "", false);
    result[id] = null;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}>
    <div class="w-full max-w-2xl rounded-lg bg-[#1c1410] border border-amber-900 text-amber-50 shadow-2xl">
      <div class="flex items-center gap-2 px-4 py-3 border-b border-amber-900/60">
        <Icon icon="mdi:key-variant" class="text-amber-300" width="20" height="20" />
        <h2 class="font-bold text-amber-200">API keys</h2>
        <button class="ml-auto px-2 py-0.5 rounded hover:bg-amber-900/40" onclick={onclose} title="close"><Icon icon="mdi:close" /></button>
      </div>
      <div class="p-4 flex flex-col gap-4 text-sm">
        <p class="text-amber-100/70 text-xs leading-relaxed">
          Keys stay in this browser and are sent only to the provider you choose. Off by default they last
          until this tab closes; <b>remember on this device</b> keeps them across visits. Nothing on this
          site can hide a key from someone who controls your browser — treat them like any other secret,
          and prefer keys with a spend limit.
        </p>
        {#each ids as id}
          {@const cat = PROVIDER_CATALOG[id]}
          <div class="rounded border border-amber-900/60 bg-black/30 p-3 flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <b class="text-amber-200">{cat.label}</b>
              <a class="text-xs text-amber-300/70 underline" href={cat.docs} target="_blank" rel="noreferrer">docs</a>
              {#if result[id] === "testing"}
                <span class="ml-auto text-xs text-amber-100/60">testing…</span>
              {:else if result[id]}
                <span class="ml-auto text-xs {result[id].ok ? 'text-emerald-300' : 'text-red-300'}">{result[id].ok ? "✓ works" : "✗"} — {result[id].detail}</span>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              <input
                class="flex-1 min-w-0 px-2 py-1 rounded bg-black/40 border border-amber-900 font-mono text-xs"
                type={show[id] ? "text" : "password"}
                autocomplete="new-password"
                spellcheck="false"
                placeholder={cat.keyHint}
                bind:value={draft[id]}
                onchange={() => save(id)}
              />
              <button class="px-2 py-1 rounded border border-amber-900 hover:bg-amber-900/40" onclick={() => (show[id] = !show[id])} title={show[id] ? "hide" : "show"}><Icon icon={show[id] ? "mdi:eye-off" : "mdi:eye"} /></button>
              <button class="px-2 py-1 rounded bg-amber-300 text-amber-950 font-bold hover:bg-amber-200 disabled:opacity-40" onclick={() => test(id)} disabled={!draft[id]?.trim() || result[id] === "testing"}>Test</button>
              <button class="px-2 py-1 rounded border border-amber-900 hover:bg-amber-900/40 disabled:opacity-40" onclick={() => clear(id)} disabled={!draft[id]} title="forget this key">Clear</button>
            </div>
            <label class="text-xs text-amber-100/70 inline-flex items-center gap-1.5">
              <input type="checkbox" bind:checked={remember[id]} onchange={() => save(id)} /> remember on this device
            </label>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

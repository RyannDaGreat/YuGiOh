<script>
  import Icon from "@iconify/svelte";
  import cardsIcon from "@iconify-icons/mdi/cards";
  import playIcon from "@iconify-icons/mdi/play";
  import DeckThumb from "$lib/pretty/DeckThumb.svelte";

  let { data, form } = $props();

  /** Every duel ever played is kept; the two sections are just "still going" and "over". */
  const active = $derived(data.duels.filter((d) => !d.ended));
  const finished = $derived(data.duels.filter((d) => d.ended));

  /** Deck library, split for the two <optgroup>s and indexed for the live art previews. */
  const structure = $derived(data.library.filter((d) => d.category === "structure"));
  const curated = $derived(data.library.filter((d) => d.category === "curated"));
  const user = $derived(data.library.filter((d) => d.category === "user"));
  const sigOf = $derived(Object.fromEntries(data.library.map((d) => [d.id, d.signatureCode])));
  const nameOf = $derived(Object.fromEntries(data.library.map((d) => [d.id, d.name])));
  const catOf = $derived(Object.fromEntries(data.library.map((d) => [d.id, d.category])));
  const setOf = $derived(Object.fromEntries(data.library.map((d) => [d.id, d.setCode])));

  /**
   * Pure function. A valid seat default: the requested deck id if it exists,
   * else `fallback` if it exists, else the first deck — so the form always has a
   * real selection even when a ?p0=/?p1= link names a deck this build lacks.
   *
   * @param {Array<{id:string}>} library - the deck library
   * @param {string|null} want - requested deck id (from ?p0=/?p1=), or null
   * @param {string} fallback - preferred deck id when nothing is requested
   * @returns {string} a deck id present in the library
   *
   * @example seatDefault([{id:"yugi"},{id:"kaiba"}], "kaiba", "yugi") // "kaiba"
   * @example seatDefault([{id:"yugi"},{id:"kaiba"}], null, "yugi")    // "yugi"
   */
  function seatDefault(library, want, fallback) {
    const ids = library.map((d) => d.id);
    if (want && ids.includes(want)) return want;
    if (ids.includes(fallback)) return fallback;
    return ids[0];
  }

  // The two seats' selected deck ids; a preview card updates as they change.
  // Seeded once from the ?p0=/?p1= preselect (intentional initial-value capture).
  // svelte-ignore state_referenced_locally
  let p0 = $state(seatDefault(data.library, data.preselect.p0, "yugi"));
  // svelte-ignore state_referenced_locally
  let p1 = $state(seatDefault(data.library, data.preselect.p1, "kaiba"));

  /**
   * Pure function. Local "MMM D, HH:MM" for a stored ISO timestamp, or "—" when
   * there is none (a duel with no moves, or one played before src/store.js
   * recorded per-move times).
   *
   * @param {string|null} at - ISO timestamp
   * @returns {string}
   *
   * @example stamp("2026-08-16T18:04:00.000Z") // "Aug 16, 11:04" (local time, UTC-7)
   * @example stamp(null)                       // "—"
   */
  function stamp(at) {
    if (!at) return "—";
    const d = new Date(at);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toTimeString().slice(0, 5)}`;
  }

  /**
   * Table talk, duel records and decks all live in one archive file — the same
   * format `ygo export` writes, so a browser-played duel can be carried to the
   * CLI and back. See src/archive.js.
   */
  let archiveBusy = $state(false);
  let archiveNote = $state("");
  let fileInput = $state(null);
  /** Overwrite files that already exist, rather than keeping what is here. */
  let replaceOnImport = $state(false);

  /** Command. Downloads the whole app state as one JSON file. */
  async function exportArchive() {
    archiveBusy = true;
    archiveNote = "";
    try {
      const res = await fetch("/api/archive");
      if (!res.ok) throw new Error(`export failed (${res.status})`);
      const blob = await res.blob();
      const name = (res.headers.get("content-disposition") ?? "").match(/filename="([^"]+)"/)?.[1] ?? "ygo-duels.json";
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      archiveNote = `downloaded ${name}`;
    } catch (err) {
      archiveNote = String(err.message ?? err);
    } finally {
      archiveBusy = false;
    }
  }

  /** Command. Restores an archive chosen with the file picker, then reloads the list. */
  async function importArchive(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    archiveBusy = true;
    archiveNote = "";
    try {
      const archive = JSON.parse(await file.text());
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archive, replace: replaceOnImport }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? `import failed (${res.status})`);
      archiveNote = `imported ${body.written} file${body.written === 1 ? "" : "s"}` +
        (body.skipped ? `, skipped ${body.skipped} already here` : "");
      if (body.written) location.reload();
    } catch (err) {
      archiveNote = String(err.message ?? err);
    } finally {
      archiveBusy = false;
      event.currentTarget.value = "";
    }
  }
</script>

{#snippet duelRows(rows)}
  <table class="w-full text-sm">
    <thead class="text-amber-100/60 text-left">
      <tr><th class="py-1">id</th><th>P0</th><th>P1</th><th>result</th><th>moves</th><th>chat</th><th>created</th><th>last move</th><th>open</th></tr>
    </thead>
    <tbody>
      {#each rows as d}
        <tr class="border-t border-amber-900/40">
          <td class="py-1 font-mono text-amber-200">{d.id}</td>
          <td>{d.decks[0]} <span class="text-amber-100/50">({d.players[0]})</span></td>
          <td>{d.decks[1]} <span class="text-amber-100/50">({d.players[1]})</span></td>
          <td>{d.status}</td>
          <td>{d.moves}</td>
          <td class="text-amber-100/70">{d.chatCount || "—"}</td>
          <td class="text-amber-100/70 whitespace-nowrap">{stamp(d.created)}</td>
          <td class="text-amber-100/70 whitespace-nowrap">{stamp(d.lastMove)}</td>
          <td class="space-x-2 whitespace-nowrap">
            <a class="underline text-amber-300" href="/duel/{d.id}?as=all" title="watch the whole game back, chat and all">replay</a>
            <a class="underline text-amber-300" href="/duel/{d.id}?as=0">P0</a>
            <a class="underline text-amber-300" href="/duel/{d.id}?as=1">P1</a>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet deckOptions()}
  {#if structure.length}<optgroup label="Structure Decks">{#each structure as d}<option value={d.id}>{d.name}</option>{/each}</optgroup>{/if}
  {#if curated.length}<optgroup label="Curated Decks">{#each curated as d}<option value={d.id}>{d.name}</option>{/each}</optgroup>{/if}
  {#if user.length}<optgroup label="User Decks">{#each user as d}<option value={d.id}>{d.name}</option>{/each}</optgroup>{/if}
{/snippet}

<svelte:head><title>YuGi — duels</title></svelte:head>

<main class="min-h-screen bg-[#120c08] text-amber-50 p-6 w-full flex flex-col gap-6">
  <header class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-amber-200 tracking-wide">YuGi</h1>
      <p class="text-amber-100/60 text-sm">Headless Yu-Gi-Oh! for LLM agents. Every duel is kept forever: pick one up, or replay a finished one move by move.</p>
    </div>
    <div class="shrink-0 flex flex-col items-end gap-2">
      <div class="flex items-center gap-2">
        <!-- Whole-state export/import: duels, their chat logs, and decks (src/archive.js). -->
        <button class="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-black/40 border border-amber-900 text-amber-100 hover:bg-amber-900/40 transition-colors disabled:opacity-50" onclick={exportArchive} disabled={archiveBusy} title="download every duel, chat log and deck as one file">
          <Icon icon="mdi:download" /> Export
        </button>
        <button class="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-black/40 border border-amber-900 text-amber-100 hover:bg-amber-900/40 transition-colors disabled:opacity-50" onclick={() => fileInput?.click()} disabled={archiveBusy} title="restore duels, chat logs and decks from an exported file">
          <Icon icon="mdi:upload" /> Import
        </button>
        <input bind:this={fileInput} type="file" accept="application/json,.json" class="hidden" onchange={importArchive} />
        <a class="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-amber-900/40 border border-amber-700/60 text-amber-100 hover:bg-amber-800/50 transition-colors" href="/decks">
          <Icon icon={cardsIcon} /> Deck Library
        </a>
      </div>
      <label class="text-[0.7rem] text-amber-100/60 inline-flex items-center gap-1.5" title="off: keep what is here and skip duplicates. on: let the archive overwrite them.">
        <input type="checkbox" bind:checked={replaceOnImport} /> overwrite on import
      </label>
      {#if archiveNote}<p class="text-[0.7rem] text-amber-200/80">{archiveNote}</p>{/if}
    </div>
  </header>

  <section class="rounded-md bg-black/40 border border-amber-900/60 p-3">
    <h2 class="font-bold text-amber-200 mb-2">In progress</h2>
    {#if active.length === 0}
      <p class="text-amber-100/60 text-sm">None — create one below.</p>
    {:else}
      {@render duelRows(active)}
    {/if}
  </section>

  <section class="rounded-md bg-black/40 border border-amber-900/60 p-3">
    <h2 class="font-bold text-amber-200 mb-2">Finished <span class="text-amber-100/50 font-normal text-sm">({finished.length})</span></h2>
    {#if finished.length === 0}
      <p class="text-amber-100/60 text-sm">No duel has ended yet.</p>
    {:else}
      {@render duelRows(finished)}
    {/if}
  </section>

  <section id="new-duel" class="rounded-md bg-black/40 border border-amber-900/60 p-3">
    <h2 class="font-bold text-amber-200 mb-2">New duel</h2>
    <form method="POST" action="?/create" class="grid grid-cols-3 gap-3 items-end text-sm">
      <label class="flex flex-col gap-1">id <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="id" required pattern="[A-Za-z0-9_\-]+" placeholder="game1" /></label>
      <label class="flex flex-col gap-1">P0 deck (goes first)
        <div class="flex items-center gap-2">
          <select class="flex-1 min-w-0 px-2 py-1 rounded bg-black/40 border border-amber-900" name="p0" bind:value={p0}>{@render deckOptions()}</select>
          <a href="/decks/{p0}?seat=0" title="inspect {nameOf[p0]}" class="shrink-0 rounded hover:ring-2 hover:ring-amber-500/70"><DeckThumb setCode={setOf[p0]} signatureCode={sigOf[p0]} name={nameOf[p0]} category={catOf[p0]} size="mini" /></a>
        </div>
      </label>
      <label class="flex flex-col gap-1">P1 deck
        <div class="flex items-center gap-2">
          <select class="flex-1 min-w-0 px-2 py-1 rounded bg-black/40 border border-amber-900" name="p1" bind:value={p1}>{@render deckOptions()}</select>
          <a href="/decks/{p1}?seat=1" title="inspect {nameOf[p1]}" class="shrink-0 rounded hover:ring-2 hover:ring-amber-500/70"><DeckThumb setCode={setOf[p1]} signatureCode={sigOf[p1]} name={nameOf[p1]} category={catOf[p1]} size="mini" /></a>
        </div>
      </label>
      <label class="flex flex-col gap-1">P0 player <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="player0" placeholder="ryan" /></label>
      <label class="flex flex-col gap-1">P1 player <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="player1" placeholder="claude" /></label>
      <label class="flex flex-col gap-1">seed <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="seed" placeholder="random" /></label>
      <button type="submit" class="col-span-3 justify-self-start inline-flex items-center gap-1.5 px-4 py-1 rounded bg-amber-300 text-amber-950 font-bold hover:bg-amber-200 transition-colors">
        <Icon icon={playIcon} /> Create
      </button>
      {#if form?.error}<p class="col-span-3 text-red-300">{form.error}</p>{/if}
    </form>
  </section>
</main>

<script>
  let { data, form } = $props();

  /** Every duel ever played is kept; the two sections are just "still going" and "over". */
  const active = $derived(data.duels.filter((d) => !d.ended));
  const finished = $derived(data.duels.filter((d) => d.ended));

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

<svelte:head><title>YuGi — duels</title></svelte:head>

<main class="min-h-screen bg-[#120c08] text-amber-50 p-6 max-w-6xl mx-auto flex flex-col gap-6">
  <header>
    <h1 class="text-3xl font-black text-amber-200 tracking-wide">YuGi</h1>
    <p class="text-amber-100/60 text-sm">Headless Yu-Gi-Oh! for LLM agents. Every duel is kept forever: pick one up, or replay a finished one move by move.</p>
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

  <section class="rounded-md bg-black/40 border border-amber-900/60 p-3">
    <h2 class="font-bold text-amber-200 mb-2">New duel</h2>
    <form method="POST" action="?/create" class="grid grid-cols-3 gap-3 items-end text-sm">
      <label class="flex flex-col gap-1">id <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="id" required pattern="[A-Za-z0-9_\-]+" placeholder="game1" /></label>
      <label class="flex flex-col gap-1">P0 deck (goes first)
        <select class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="p0">{#each data.decks as d}<option value={d} selected={d === "yugi"}>{d}</option>{/each}</select>
      </label>
      <label class="flex flex-col gap-1">P1 deck
        <select class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="p1">{#each data.decks as d}<option value={d} selected={d === "kaiba"}>{d}</option>{/each}</select>
      </label>
      <label class="flex flex-col gap-1">P0 player <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="player0" placeholder="ryan" /></label>
      <label class="flex flex-col gap-1">P1 player <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="player1" placeholder="claude" /></label>
      <label class="flex flex-col gap-1">seed <input class="px-2 py-1 rounded bg-black/40 border border-amber-900" name="seed" placeholder="random" /></label>
      <button type="submit" class="col-span-3 justify-self-start px-4 py-1 rounded bg-amber-300 text-amber-950 font-bold">Create</button>
      {#if form?.error}<p class="col-span-3 text-red-300">{form.error}</p>{/if}
    </form>
  </section>
</main>

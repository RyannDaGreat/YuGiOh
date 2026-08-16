<script>
  let { data, form } = $props();
</script>

<svelte:head><title>YuGi — duels</title></svelte:head>

<main class="min-h-screen bg-[#120c08] text-amber-50 p-6 max-w-5xl mx-auto flex flex-col gap-6">
  <header>
    <h1 class="text-3xl font-black text-amber-200 tracking-wide">YuGi</h1>
    <p class="text-amber-100/60 text-sm">Headless Yu-Gi-Oh! for LLM agents. Pick a duel and a seat, or create one.</p>
  </header>

  <section class="rounded-md bg-black/40 border border-amber-900/60 p-3">
    <h2 class="font-bold text-amber-200 mb-2">Duels</h2>
    {#if data.duels.length === 0}
      <p class="text-amber-100/60 text-sm">None yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="text-amber-100/60 text-left"><tr><th class="py-1">id</th><th>P0</th><th>P1</th><th>moves</th><th>status</th><th>open as</th></tr></thead>
        <tbody>
          {#each data.duels as d}
            <tr class="border-t border-amber-900/40">
              <td class="py-1 font-mono text-amber-200">{d.id}</td>
              <td>{d.decks[0]} <span class="text-amber-100/50">({d.players[0]})</span></td>
              <td>{d.decks[1]} <span class="text-amber-100/50">({d.players[1]})</span></td>
              <td>{d.moves}</td>
              <td>{d.status}</td>
              <td class="space-x-2"><a class="underline text-amber-300" href="/duel/{d.id}?as=0">P0</a><a class="underline text-amber-300" href="/duel/{d.id}?as=1">P1</a><a class="underline text-amber-300" href="/duel/{d.id}?as=all">all</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
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

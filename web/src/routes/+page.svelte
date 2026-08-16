<script>
  let { data, form } = $props();
</script>

<svelte:head><title>YuGi — duels</title></svelte:head>

<main class="page">
  <h1>YuGi</h1>
  <p class="muted">Headless Yu-Gi-Oh! for LLM agents. Pick a duel and a seat, or create one.</p>

  <section>
    <h2>Duels</h2>
    {#if data.duels.length === 0}
      <p class="muted">None yet.</p>
    {:else}
      <table>
        <thead><tr><th>id</th><th>P0</th><th>P1</th><th>moves</th><th>status</th><th>open as</th></tr></thead>
        <tbody>
          {#each data.duels as d}
            <tr>
              <td><code>{d.id}</code></td>
              <td>{d.decks[0]} <span class="muted">({d.players[0]})</span></td>
              <td>{d.decks[1]} <span class="muted">({d.players[1]})</span></td>
              <td>{d.moves}</td>
              <td>{d.status}</td>
              <td><a href="/duel/{d.id}?as=0">P0</a> · <a href="/duel/{d.id}?as=1">P1</a> · <a href="/duel/{d.id}?as=all">all</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section>
    <h2>New duel</h2>
    <form method="POST" action="?/create" class="new-form">
      <label>id <input name="id" required pattern="[A-Za-z0-9_\-]+" placeholder="game1" /></label>
      <label>P0 deck (goes first)
        <select name="p0">{#each data.decks as d}<option value={d} selected={d === "yugi"}>{d}</option>{/each}</select>
      </label>
      <label>P1 deck
        <select name="p1">{#each data.decks as d}<option value={d} selected={d === "kaiba"}>{d}</option>{/each}</select>
      </label>
      <label>P0 player <input name="player0" placeholder="ryan" /></label>
      <label>P1 player <input name="player1" placeholder="claude" /></label>
      <label>seed <input name="seed" placeholder="random" /></label>
      <button type="submit">Create</button>
      {#if form?.error}<p class="error">{form.error}</p>{/if}
    </form>
  </section>
</main>

<style>
  :root {
    --page-max-width: 60rem;
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 1rem;
    --space-4: 1.5rem;
    --color-bg: #f7f5ef;
    --color-fg: #222;
    --color-muted: #6b6b6b;
    --color-error: #b00020;
    --color-border: #d8d3c4;
    --color-accent: #2f5d8a;
    --font-body: system-ui, sans-serif;
  }
  :global(body) { margin: 0; background: var(--color-bg); color: var(--color-fg); font-family: var(--font-body); }
  .page { max-width: var(--page-max-width); margin: 0 auto; padding: var(--space-4); }
  .muted { color: var(--color-muted); }
  .error { color: var(--color-error); }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--color-border); }
  a { color: var(--color-accent); }
  .new-form { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2) var(--space-3); align-items: end; }
  .new-form label { display: flex; flex-direction: column; gap: var(--space-1); }
  .new-form button { grid-column: 1 / -1; justify-self: start; padding: var(--space-1) var(--space-3); }
</style>

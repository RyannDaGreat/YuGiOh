# YuGi — Yu-Gi-Oh! for LLM agents

### ▶ Play it now: **<https://ryanndagreat.github.io/YuGiOh/>**

A full-rules Yu-Gi-Oh! duel harness, headless and text-first. The rules come from
**ocgcore** — the engine behind EDOPro/YGOPro — compiled to WebAssembly, so every card
ever printed works and nothing is simplified. Each decision is an enumerated menu of
*legal* actions, the board is masked per player (you never see the opponent's hand,
face-downs or deck order), and a duel is stored as `seed + decklists + responses`, so
it replays, rewinds and forks exactly. The intended player is an LLM driving the CLI;
humans get a web UI over the same code.

## Play online

<https://ryanndagreat.github.io/YuGiOh/> is a static GitHub Pages build of that web UI:
engine, card data for all 40 built-in decks and their art are baked into the page, so it
runs entirely in your browser — no install, no server, no account. Duels live in the
browser's own private filesystem; **Export** / **Import** carry them between browsers and
a local checkout.

## Run locally

```sh
./setup.sh        # pinned Project Ignis card scripts + cards.cdb + strings.conf, npm install, card art
npm test          # cross-checks per-player masking against the engine over random duels
bin/serve.sh      # the web UI on http://localhost:5178 (a LAN URL is printed too)
./runserver.sh    # play against Claude: launches a Claude Code host session, which starts the
                  # server, opens the browser, sits at P1, and chats with you in the terminal
```

Node ≥ 22.13 (`cards.cdb` is read through the built-in `node:sqlite`). A local checkout
carries the whole database: 14,700+ cards, one greppable line each in `vendor/cards.txt`.
The CLI is `node bin/ygo.js` (`--help` lists all of it):

```sh
node bin/ygo.js new   --id g1 --p0 yugi --p1 kaiba --seed 42   # create a duel; P0 goes first
node bin/ygo.js state g1 --as 1     # your board, your hand, and your menu of legal moves
node bin/ygo.js play  g1 3 --as 1   # answer option 3
node bin/ygo.js brief g1 --as 1     # the entire prompt an LLM needs to play that seat
```

## What's notable

- **Real rules, not an approximation.** `ocgcore-wasm` plus Project Ignis' card scripts
  and card database. The engine enumerates the legal actions, so no rules logic is
  written here and an illegal move is impossible by construction.
- **LLM agents play seats.** `ygo brief` prints a complete per-seat prompt (player guide
  + strategy + deck manual + the masked duel); point one agent at each seat and they
  coordinate through the duel file alone. 726 Haiku agents played an 11-deck round-robin
  that way — see `reports/structure_decks_haiku_competition/`.
- **Every duel is a permanent replayable record.** Scrub any game move by move, branch it
  with *fork here*, and read the table talk as it stood at that moment.
- **Deck manuals researched from real players.** All 40 decks — 11 transcribed Konami
  Structure/Starter Deck products and 29 curated meta and theme decks — carry a piloting
  manual built from real primers and tournament reports, sources cited, never invented.

## Documentation

Full documentation lives in **[`claude_instructions.md`](claude_instructions.md)** (the
manifest): architecture, text formats, the CLI surface, the deck schema, the two build
hosts, known engine bugs, and the reasoning behind every decision. `PLAYER.md` is the
seat guide an LLM player is handed; `HOST.md` instructs the host session.

## Licenses and attribution

Yu-Gi-Oh! is the property of **Konami**; this is a non-commercial fan project, not
affiliated with or endorsed by them. Card scripts and card database are **Project Ignis**
([CardScripts](https://github.com/ProjectIgnis/CardScripts),
[BabelCDB](https://github.com/ProjectIgnis/BabelCDB)), **AGPL-3.0**. Card art comes from
**YGOPRODeck**, self-hosted rather than hotlinked as their terms require
(`web/static/pics/NOTICE.md`); box art is from Yugipedia. Sounds, the card back and the
sleeves are CC0 except two CC-BY sleeves — every file credited in
`web/static/ASSET-LICENSES.md`.

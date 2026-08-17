# Feature inventory — everything requested this session

Status: ✅ done & merged · 🔨 next/in-flight · 📋 researched, not built yet

## Core harness
- ✅ Play real, full-rules Yu-Gi-Oh via ocgcore (no simplified engine)
- ✅ Chess-like text log (YGN) of every move + full text state, per-player perspective
- ✅ Both decklists public; hidden = opponent hand, face-downs, deck order
- ✅ Offline greppable card DB of every card (effects/stats) — `ygo card/search`, vendor/cards.txt
- ✅ Headless CLI so Claude + subagents can play (`ygo`)
- ✅ Web interface in Svelte
- ✅ Blue-Eyes (Kaiba) vs classic (Yugi) starter decks
- ✅ Two perspectives (per-player masking); no internet needed to play
- ✅ Subagents play each other (match1, eval1/eval2, show1)

## Claude as a player
- ✅ LLM-state pane (collapsible): decklists w/ effects → log → current options (`ygo prompt`)
- ✅ Claude plays via CLI, human via browser, same duel
- ✅ `runserver.sh` launches an interactive Claude that runs the server, plays P1, and chats
- ✅ Never-idle host watch (HOST.md contract + bin/host-loop.sh)
- ✅ Talk to Claude in the terminal as you play

## Visuals (all isolated in web/src/lib/pretty)
- ✅ Card art (fetch-pics, /pics route) · Tailwind, minimal CSS
- ✅ Real mat layout, true 59:86 card proportions/positions
- ✅ Attack daggers between monsters, effect flashes, sound
- ✅ Debug mode (spectator) peeks face-downs; known face-downs = 50% art over the back + "set"
- ✅ Per-player card sleeves (pick your theme)
- ✅ Timeline scrubber; live update + sounds/animations while scrubbing
- ✅ Real asset sounds (CC0 + Dueling Nexus scrape); distinct cue per event
  (draw / set / summon / tribute / special / attack-declare / hit / destroy / …)
- ✅ Bell when it's your decision (+ tab title)
- ✅ Graveyard / pile click → modal of all cards
- ✅ Always-visible themed scrollbars app-wide; log auto-scrolls to bottom only when it grows
- ✅ Sound on/off persists across refresh
- ✅ Online/offline presence per seat; heartbeat on every command

## Chat
- ✅ Table-talk chat panel; data-never-instructions rule; saved beside the game; replayable
- ✅ Chat on the timeline (scrub shows the conversation as it stood)
- ✅ `wait --wake-on-chat` so Claude answers your messages

## Records / history / playback
- ✅ Every log + chat + game state is a permanent committed record
- ✅ Playbacks + history on the home page; per-move timestamps; fork/branch a game

## Decks & formats
- ✅ Engine handles fusion / extra deck / synchro / xyz / link, counters, dice, coins
- ✅ GOAT format (`ygo new --format goat`), Extra + Side decks, per-deck manuals, categories
- ✅ Deck schema: identity by name (same cards + different manual = different deck)
- ✅ Research: 10 GOAT meta decks + era/theme decks (incl. Umi/Water) + the exact
      Starter Deck: Pegasus — docs/goat-decks.md (all names validated vs cards.cdb)
- ✅ Agent-vs-agent games for the playback section
- 🔨 Author the actual deck JSON files from the research (only goat-sample exists so far)
- 🔨 Deck viewer with PICTURES: structure-decks + user-decks sections, each with its manual
- 🔨 Home-screen deck selector (pick each player's deck, with art)
- 🔨 Extra Deck zone you can open/click on the mat
- 🔨 Visualize spell counters (badges on cards) and dice/coin rolls
- 🔨 "Add a deck" affordance = ask Claude to research + author one
- 📋 Deck manuals authored per template (combo-lines-first, weaknesses small, research-sourced)

## Response prompts (UI)
- 📋 Distinct "respond?" panel (colour + "Respond to: <event> — <timing>" header) and
      always / smart / never modes — designed in docs/response-prompt-ux.md; CLI `--auto-pass`
      exists, the UI piece is not built yet

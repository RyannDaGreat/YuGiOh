# GOAT Format Deck Library

A curated set of GOAT-format (April 2005) Yu-Gi-Oh! decks for the ocgcore harness,
each with an exact, DB-validated decklist and a combo-line-first pilot manual.

## Sourcing & confidence (read this first)

Card **names and counts** are the thing the harness validates, so every card below was
checked to exist **verbatim** in `vendor/BabelCDB/cards.cdb`. Manual **mechanics** (what a
card does, how two cards interact) are grounded in the **exact card text pulled from that
same database** — quoted where it matters — so the combo lines are not invented; they follow
from printed effects.

Source tags used inline:
- **[CDB]** — exact effect text from `vendor/BabelCDB/cards.cdb` (authoritative for *how*
  cards interact; I queried and quote it).
- **[YP-GOAT]** — YGOPRODeck "An Introduction to Goat Format":
  <https://ygoprodeck.com/an-introduction-to-goat-format/> (high-level strategy: card
  advantage, bluffing, BLS as the format's "queen"/late-game finisher, reusing Flip monsters
  and Thousand-Eyes Restrict via Tsukuyomi).
- **[FL]** — FormatLibrary GOAT page/API: <https://formatlibrary.com/formats/goat> (banlist,
  meta framing).
- **[GF]** — GoatFormat.com: <https://www.goatformat.com/>, <https://www.goatformat.com/whatisgoat.html>
  (format definition, pool through *The Lost Millennium*, Scapegoat+Metamorphosis core).
- **[SDP]** — YGOPRODeck set page for the real Pegasus product:
  <https://ygoprodeck.com/pack/Starter+Deck:+Pegasus>.
- **[WIKI-PEG]** — <https://en.wikipedia.org/wiki/Maximillion_Pegasus> (Pegasus uses a Toon
  deck; Relinquished is his ace).

**Honesty caveat.** This session's WebSearch budget was exhausted and most dedicated primer
sites (reddit r/goatformat wiki, Pojo, Yugipedia, Fandom) returned 403/402/blocked, so I
could not mine tournament-report-level lines for every deck. The **format-defining** lines
(Scapegoat→Metamorphosis→Thousand-Eyes Restrict, Tsukuyomi loops, Book of Moon tricks, BLS
finisher, the Cyber-Stein/Megamorph math, the Fisherman/Tornado-Wall lock) are corroborated
by [CDB] card text and [YP-GOAT]/[GF]. Where a manual leans on **general format knowledge I
could not corroborate with a fetched primer** (notably Empty Jar's exact loop, Last Turn FTK
setup, burn sequencing, and Reasoning "reads"), it is **explicitly flagged `⚠ unverified line`**
— treat those as starting points to check against a deck guide, per the "confidently-wrong is
worse than none" rule.

These lists are *representative* archetype builds (clean, legal, typical), not photocopies of
one tournament sheet — except the Pegasus deck, which is the **exact printed product**.

---

## 1. What is GOAT format

**GOAT** = the competitive Advanced-format metagame frozen at the **March/April 2005 TCG
Forbidden & Limited list**, card pool cutting off at **The Lost Millennium (TLM)** [GF]. Named
after **Scapegoat** (and jokingly "Greatest Of All Time"). Games are **8000 LP**, 40–60 Main,
≤15 Extra, ≤15 Side. It is a slow, grindy tempo-and-resource format prized for reading,
bluffing, and sequencing [YP-GOAT].

**Banlist essentials (what defines the format):**
- **Chaos split:** `Black Luster Soldier - Envoy of the Beginning` is **Limited (1)** and is
  the premier finisher; `Chaos Emperor Dragon - Envoy of the End` is **Forbidden**.
  `Chaos Sorcerer` is the light Chaos beater most decks run [YP-GOAT][FL].
- **Forbidden** (famous ones): `Chaos Emperor Dragon - Envoy of the End`, `Yata-Garasu`,
  `Butterfly Dagger - Elma`, `Fiber Jar`, `Painful Choice`, `Confiscation` [FL],
  `The Forceful Sentry` [FL], `Harpie's Feather Duster`, `Makyura the Destructor`,
  `Monster Reborn`. (Edge cards like `Witch of the Black Forest` vary between the strict TCG
  list and the GoatFormat.com pool — verify before use.)
- **Limited (1)** staples: `Pot of Greed`, `Graceful Charity`, `Delinquent Duo`, `Heavy
  Storm`, `Mystical Space Typhoon`, `Premature Burial`, `Snatch Steal`, `Change of Heart`,
  `Scapegoat`, `Metamorphosis`, `Cyber-Stein`, `Sinister Serpent`, `Sangan`, `Exarion
  Universe`, `Reinforcement of the Army`, `Nobleman of Crossout`, `Mirror Force`, `Torrential
  Tribute`, `Ring of Destruction`, `Solemn Judgment`, `Call of the Haunted`, `Morphing Jar`,
  `Cyber Jar` (⚠ Cyber Jar's exact status varies by banlist build — verify).
- **Unlimited/flexible tech:** `Book of Moon`, `Tsukuyomi` (up to 3 each), `Book of Taiyou`,
  `Sakuretsu Armor`, `Bottomless Trap Hole`, `Nobleman of Extermination`, `Dust Tornado`,
  `Enemy Controller`, `Creature Swap`.
- **NOT in the pool** (post-TLM — exist in `cards.cdb` but illegal): `Cyber Dragon`/`Cyber
  Twin/End Dragon`, `Magician's Circle`, `Compulsory Evacuation Device`, `Chain Strike`,
  `Card Trooper`, `Salvage`, `Zombie Master`, `Marshmallon`, Gadgets, `Magician's Valkyria`,
  `Sage's Stone`, `Kaibaman`.

**The "GOAT Control" game plan.** The engine is **Scapegoat + Metamorphosis**. `Scapegoat`
makes four Level-1 tokens; `Metamorphosis` is "Tribute 1 monster. Special Summon 1 Fusion
Monster from your Extra Deck with the same Level as the Tributed monster" [CDB] — so a Level-1
token becomes **`Thousand-Eyes Restrict`** (Level 1). TER reads: "Other monsters on the field
cannot change their battle positions or attack. Once per turn … equip 1 monster your opponent
controls … This card's ATK/DEF become equal to that equipped monster's" [CDB] — i.e. it **steals
one monster and freezes the whole board** (yours included: it is a lock, not an attacker). Around
that you grind 1-for-1 removal, recur Flip monsters with **`Tsukuyomi`** ("flip 1 face-up monster
face-down … return it to the hand" in the End Phase [CDB]), protect and trick with `Book of
Moon`, float with `Sangan`/`Sinister Serpent`/`Airknight Parshath`, and eventually win with
**`Black Luster Soldier - Envoy of the Beginning`** — "banish 1 LIGHT and 1 DARK monster from
your GY" to summon, then either banish a threat or, on a kill, "make a second attack in a row"
[CDB]; the "queen" of the format [YP-GOAT]. LP totals decide games (`Ring of Destruction`,
`Delinquent Duo`).

---

## 2. Ten meta / known GOAT decks

Notation: `Nx Card Name`. All lists total **40 Main**. Extra Deck fusions are `Metamorphosis`
targets (Level must match the tributed monster) and `Cyber-Stein` targets. A Limited card may
appear only **once across Main+Side+Extra combined**, so sides use unlimited cards.

### 2.1 Goat Control (the archetype — "Chaos Goat")
**Monsters (17):** 1x Black Luster Soldier - Envoy of the Beginning, 1x Chaos Sorcerer,
1x Airknight Parshath, 1x Sangan, 1x Sinister Serpent, 1x Magician of Faith, 2x Tsukuyomi,
1x Dekoichi the Battlechanted Locomotive, 1x Breaker the Magical Warrior, 2x D.D. Warrior Lady,
1x D.D. Assailant, 1x Exiled Force, 1x Spirit Reaper, 1x Cyber-Stein, 1x Night Assailant
**Spells (12):** 1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm,
1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch Steal, 1x Scapegoat, 1x Metamorphosis,
1x Nobleman of Crossout, 2x Book of Moon
**Traps (11):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado,
1x Ceasefire, 1x Trap Dustshoot
**Extra (6):** 1x Thousand-Eyes Restrict, 1x Ryu Senshi, 1x Dark Balter the Terrible,
1x Musician King, 1x Master of Oz, 1x Flame Swordsman
**Side (sample):** 2x Kycoo the Ghost Destroyer, 2x Royal Decree, 2x Nobleman of Extermination,
1x Divine Wrath, 1x Ceasefire

**Manual.**
*Game plan:* grind card advantage with cheap removal and Flip recursion, then close with one
protected beater [YP-GOAT].
*Key cards / engine:* Scapegoat + Metamorphosis → Thousand-Eyes Restrict; Tsukuyomi + Magician
of Faith/Dekoichi; Book of Moon; BLS.
*How to pilot / combo lines:*
- **The TER swing is two turns, not one.** Scapegoat is a Quick-Play; its text says "You cannot
  Summon other monsters the turn you activate this card" [CDB], so you **cannot** Scapegoat and
  Metamorphosis a token on the same turn. Make goats on the **opponent's** End Phase (or a prior
  turn), then on **your** turn tribute one token to `Metamorphosis` → `Thousand-Eyes Restrict`,
  which absorbs their best monster and locks the board [CDB].
- **Tsukuyomi is the value engine.** Flip your `Magician of Faith` face-down to re-use its flip
  (rebuy a Limited Spell), flip `Dekoichi` for another draw, or flip an **opponent's** face-up
  beater face-down — stripping its Equip and position and setting it up for `Nobleman of
  Crossout` or a clean attack. Tsukuyomi bounces to hand each End Phase [CDB], so it repeats.
- **Book of Moon** is your Swiss-army trick: flip your monster face-down to dodge targeted
  removal or a battle, flip the opponent's attacker mid-combat to blank it, deny a Tribute
  Summon, or flip a monster to enable `Nobleman of Crossout` [CDB].
- **Sequencing:** lead with floaters (`Sangan`, `Sinister Serpent`) and set one reactive trap;
  make the opponent commit into `Bottomless`/`Sakuretsu`/`Mirror Force`. Hold `Delinquent Duo`
  and `Graceful Charity` for when they refill your grip rather than emptying it.
- **Closing:** bank chip damage, then drop `Black Luster Soldier`; banish their wall (no attack
  that turn) or swing and take the double attack for lethal [CDB]. `Cyber-Stein → Master of Oz`
  is an emergency finisher, not the plan.
*Weaknesses:* soft to a fast `Heavy Storm` blowing out a set-heavy board, to being out-tempoed
by pure aggro before the grind starts, and to your own brick hands (all traps / all monsters).
Watch LP vs `Ring of Destruction`.

### 2.2 Warrior Toolbox
**Monsters (18):** 1x Black Luster Soldier - Envoy of the Beginning, 1x Chaos Sorcerer,
1x Exarion Universe, 2x D.D. Warrior Lady, 1x D.D. Assailant, 1x Don Zaloog, 1x Gearfried the
Iron Knight, 2x Marauding Captain, 1x Blade Knight, 1x Exiled Force, 1x Breaker the Magical
Warrior, 1x Mystic Swordsman LV2, 1x Sangan, 1x Sinister Serpent, 1x Magician of Faith,
1x Spirit Reaper
**Spells (12):** 1x Reinforcement of the Army, 1x Pot of Greed, 1x Graceful Charity,
1x Delinquent Duo, 1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch
Steal, 1x Scapegoat, 1x Metamorphosis, 2x Book of Moon
**Traps (10):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado,
1x Trap Dustshoot
**Extra (5):** 1x Thousand-Eyes Restrict, 1x Ryu Senshi, 1x Dark Balter the Terrible,
1x Musician King, 1x Master of Oz

**Manual.**
*Game plan:* faster "fair" deck — tutor the right Warrior, apply board+hand pressure, still keep
the Chaos/Metamorphosis reach.
*Key cards / engine:* Reinforcement of the Army toolbox; Marauding Captain; D.D. Warrior Lady;
BLS.
*How to pilot / combo lines:*
- **`Reinforcement of the Army` is your answer tutor** — fetch `D.D. Warrior Lady` into a big
  beater (banishes both in battle — denies the opponent's Chaos fuel), `Exiled Force` to pop a
  problem, or `Marauding Captain` to develop.
- **`Marauding Captain` doubles up:** on Normal Summon it Special Summons a Level-4-or-lower
  monster from hand [CDB], so one card becomes two bodies, and while it's up the opponent
  "cannot target Warrior monsters for attacks, except this one" [CDB] — your backrow-light board
  survives a turn.
- **`Blade Knight` is 2000 ATK when you hold ≤1 card**, so empty your hand into the board and let
  it close; `Don Zaloog` chips the hand/deck on damage; `Exarion Universe` pierces defense.
- Lead with `Trap Dustshoot` where possible to strip their key card and read the game plan;
  use `Book of Moon`/`Sakuretsu` to punch a lane open, then race.
- The `Scapegoat`→`Metamorphosis`→TER package is still here as a defensive reset when the race
  stalls — same two-turn timing as 2.1.
*Weaknesses:* thinner trap suite than Control means it folds to a bigger control deck's grind if
the aggression stalls; mass removal (`Torrential`, `Mirror Force`) punishes over-committing your
Warriors.

### 2.3 Chaos Turbo / Chaos Control
**Monsters (19):** 1x Black Luster Soldier - Envoy of the Beginning, 2x Chaos Sorcerer,
1x Airknight Parshath, 2x D.D. Warrior Lady, 1x D.D. Assailant, 1x Dekoichi the Battlechanted
Locomotive, 2x Mystic Tomato, 1x Sangan, 1x Sinister Serpent, 1x Magician of Faith, 1x Spirit
Reaper, 1x Night Assailant, 1x Breaker the Magical Warrior, 1x Exiled Force, 1x Zaborg the
Thunder Monarch, 1x Tsukuyomi
**Spells (11):** 1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm,
1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch Steal, 1x Nobleman of Crossout,
1x Scapegoat, 1x Metamorphosis, 1x Book of Moon
**Traps (10):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado,
1x Ceasefire
**Extra (4):** 1x Thousand-Eyes Restrict, 1x Ryu Senshi, 1x Dark Balter the Terrible,
1x Musician King

**Manual.**
*Game plan:* Goat Control with the dial toward tempo; leverage DARK/LIGHT density to spam Chaos.
*Key cards / engine:* Mystic Tomato recruiter chain; Chaos Sorcerer x2 + BLS; Zaborg.
*How to pilot / combo lines:*
- **`Mystic Tomato` fuels everything:** it dies to Special Summon a DARK (≤1500 ATK) from deck
  [CDB] — fetch `Sinister Serpent`, `Don Zaloog`, or another Tomato — chaining bodies while
  stocking DARKs in the grave for Chaos.
- **Keep a live LIGHT count** (Airknight, D.D. Warrior Lady, Magician of Faith) so `Chaos
  Sorcerer`/`BLS` (each needs "1 LIGHT and 1 DARK" banished [CDB]) are always online: banish
  their best monster, then swing.
- **`Zaborg the Thunder Monarch`** tributes a token or spent Tomato on summon to pop a monster —
  tempo plus a body.
- You are the beatdown in control mirrors and still hold the full trap suite vs aggro. Same
  Scapegoat→Metamorphosis→TER two-turn line as 2.1 for the reset.
*Weaknesses:* graveyard hate (`Kycoo`, `Soul Release`, `D.D. Warrior Lady`) shuts your Chaos off;
drawing Chaos monsters with no LIGHT/DARK in grave = dead cards early.

### 2.4 Zombie ("Zoo")
*Interpretation:* the "Zoo" slot most plausibly means a Zombie tribal deck. `Rescue Cat` is legal
but has weak Beast targets in this pool, so a Beast "Zoo" is fringe; the Zombie build is the real
era deck.
**Monsters (20):** 3x Pyramid Turtle, 2x Vampire Lord, 2x Ryu Kokki, 2x Double Coston, 1x Spirit
Reaper, 1x Regenerating Mummy, 2x Mystic Tomato, 1x Sangan, 1x Sinister Serpent, 1x Magician of
Faith, 1x Breaker the Magical Warrior, 1x Exiled Force, 1x Night Assailant, 1x Don Zaloog
**Spells (11):** 1x Book of Life, 1x Call of the Mummy, 1x Pot of Greed, 1x Graceful Charity,
1x Delinquent Duo, 1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch
Steal, 1x Nobleman of Crossout, 1x Book of Moon
**Traps (9):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado
**Extra:** none required.

**Manual.**
*Game plan:* resilient midrange that keeps refueling bodies until it grinds the opponent out.
*Key cards / engine:* Pyramid Turtle → Vampire Lord/Ryu Kokki; Book of Life; Call of the Mummy.
*How to pilot / combo lines:*
- **`Pyramid Turtle` is the engine:** when destroyed by battle it Special Summons any Zombie with
  ≤2000 DEF from the deck [CDB] — grab `Vampire Lord` (recurs itself and mills the opponent) or
  `Ryu Kokki` (2400, eats Warrior/Spellcaster attackers). So trading Turtle away is pure profit.
- **`Mystic Tomato` overlaps** — it fetches DARK Zombies (Pyramid Turtle 1200, Double Coston,
  Spirit Reaper), so both recruiters chain into a wall.
- **`Book of Life`** revives a Zombie **and** banishes one from the opponent's grave [CDB] —
  double duty as anti-Chaos tech. **`Call of the Mummy`** free-summons a Zombie from hand each
  turn while you control no monsters [CDB], so lead with it on an empty board.
- **`Double Coston`** is a one-body tribute for `Vampire Lord`. Play to the grind: attack into
  recruiters happily, the deck out-values fair decks.
*Weaknesses:* `Nobleman of Crossout` blows out `Pyramid Turtle`/set recruiters (banishes them,
no float); mass removal on a wide board; graveyard banishing turns off `Book of Life`/`Vampire
Lord` recursion.

### 2.5 Reasoning Gate Turbo
**Monsters (17):** 1x Black Luster Soldier - Envoy of the Beginning, 2x Chaos Sorcerer,
1x Airknight Parshath, 1x Jinzo, 1x Zaborg the Thunder Monarch, 1x Mobius the Frost Monarch,
2x Mystic Tomato, 1x Sangan, 1x Sinister Serpent, 1x Dekoichi the Battlechanted Locomotive,
1x Magician of Faith, 1x Spirit Reaper, 1x Breaker the Magical Warrior, 1x Night Assailant,
1x D.D. Assailant
**Spells (14):** 3x Reasoning, 2x Monster Gate, 1x Pot of Greed, 1x Graceful Charity,
1x Delinquent Duo, 1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch
Steal, 1x Nobleman of Crossout, 1x Book of Moon
**Traps (9):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado
**Extra:** none.

**Manual.**
*Game plan:* cheat a big body onto the board for free while milling the deck to power Chaos.
*Key cards / engine:* Reasoning + Monster Gate; Jinzo/Monarchs as free drops; Chaos.
*How to pilot / combo lines:*
- **`Monster Gate`** ("Tribute 1 monster; excavate … until … a monster that can be Normal
  Summoned/Set. Special Summon it, send the rest to the GY" [CDB]) and **`Reasoning`** (opponent
  declares a Level; you excavate to the first Normal-Summonable monster and, unless the Level
  matches, Special Summon it and mill the rest [CDB]) drop `Jinzo`, `Zaborg`, `Mobius`, or
  `Airknight` **for free** — the excavation cost is a feature.
- **Sequence: mill first, Chaos second.** The excavated pile stuffs the grave with LIGHT/DARK, so
  after a Gate/Reasoning you often have live `Chaos Sorcerer`/`BLS` the same turn.
- Your nomi Chaos monsters and Tribute monsters can get milled by the excavation — that is fine,
  they feed the grave; just don't rely on drawing them.
- ⚠ **unverified line:** the "how hard do I go" and the psychology of what Level to bait with
  `Reasoning` (opponents name the Level they think you'll hit) come from general format lore, not
  a primer I could fetch this session — verify the exact monster-Level spread against a Reasoning
  Gate guide before treating it as optimized.
*Weaknesses:* `Reasoning` can whiff into a small body if the opponent name-guesses your Level;
top-heavy hands with no engine spell brick; graveyard hate hits the Chaos backend.

### 2.6 Burn (Wave-Motion / Stall Burn)
*Legality flag:* the modern "Chain Burn" deck relies on `Chain Strike` (Enemy of Justice, 2006) —
**not GOAT-legal**. The era build is a stall-and-burn shell.
**Monsters (5):** 1x Des Koala, 1x Des Lacooda, 1x Spirit Reaper, 2x Nimble Momonga
**Spells (15):** 2x Wave-Motion Cannon, 1x Dark Room of Nightmare, 1x Poison of the Old Man,
1x Messenger of Peace, 1x Level Limit - Area B, 1x Gravity Bind, 1x Swords of Revealing Light,
1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm, 1x Mystical Space
Typhoon, 1x Upstart Goblin, 1x Emergency Provisions
**Traps (20):** 2x Secret Barrel, 2x Just Desserts, 2x Ojama Trio, 2x Ceasefire, 2x Waboku,
2x Threatening Roar, 2x Sakuretsu Armor, 1x Magic Cylinder, 1x Mirror Force, 1x Torrential
Tribute, 1x Ring of Destruction, 1x Call of the Haunted, 1x Dust Tornado
**Extra:** none.

**Manual.**
*Game plan:* survive behind lockdown, chip the opponent to 0 with effect burn.
*Key cards / engine:* Gravity Bind / Level Limit / Messenger walls; Wave-Motion Cannon; Ojama
Trio + Secret Barrel/Just Desserts.
*How to pilot / combo lines:*
- **Lock first:** `Gravity Bind` / `Level Limit - Area B` / `Messenger of Peace` stop most
  attackers cold; `Swords of Revealing Light`, `Waboku`, `Threatening Roar` buy individual turns;
  `Nimble Momonga` walls and nets 1000 LP each time it dies.
- **Then burn:** `Ojama Trio` gives the opponent three tokens, which `Secret Barrel` (200 per card
  they control) and `Just Desserts` (500 per monster) then punish; `Ceasefire` burns 500 per
  effect monster; `Wave-Motion Cannon` stores 1000 per turn it sits, then fires for the total.
  `Dark Room of Nightmare` adds 300 to each instance of effect damage.
- `Emergency Provisions` cashes spent continuous cards for LP when you're racing a clock.
- ⚠ **unverified line:** exact burn-math sequencing and the optimal turn to fire Wave-Motion are
  general-knowledge here, not from a fetched burn primer — sanity-check totals before relying on
  a specific "turn-N lethal."
*Weaknesses:* a fast `Heavy Storm`/`MST` on your stall wall, a single big beater that ignores
`Gravity Bind` via direct pressure before the walls land, and decks that gain LP; hold a
`Waboku`/`Torrential` as insurance.

### 2.7 Empty Jar / Draw-Loop Exodia  ⚠ fringe combo
*Reality check:* with `Fiber Jar` Forbidden, this loops the **Limited** `Morphing Jar` to churn
the deck toward the five Exodia pieces (or deck-out). Slower and less consistent than the pre-ban
Jar decks. **The loop's viability/consistency is `⚠ unverified` — I could not fetch a dedicated
Empty-Jar primer this session; treat the list as a starting skeleton.**
**Monsters (11):** 1x Morphing Jar, 1x Cyber Jar, 1x Exodia the Forbidden One, 1x Right Arm of
the Forbidden One, 1x Left Arm of the Forbidden One, 1x Right Leg of the Forbidden One, 1x Left
Leg of the Forbidden One, 1x Magical Merchant, 1x Sangan, 1x Sinister Serpent, 1x Dekoichi the
Battlechanted Locomotive
**Spells (23):** 3x Book of Taiyou, 2x Book of Moon, 3x Upstart Goblin, 3x Good Goblin
Housekeeping, 2x Reload, 1x Card Destruction, 1x Convulsion of Nature, 1x Magical Stone
Excavation, 1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm, 1x Mystical
Space Typhoon, 2x Emergency Provisions
**Traps (6):** 3x Jar of Greed, 2x Threatening Roar, 1x Ceasefire
**Extra:** none.

**Manual.**
*Game plan:* draw your whole deck via forced Jar draws, assemble Exodia (or deck the opponent).
*Key cards / engine:* Morphing Jar + Book of Taiyou + Book of Moon loop; draw spells.
*How to pilot / combo lines:*
- **The loop (mechanics are [CDB]-grounded, the *engine's overall consistency* is `⚠ unverified`):**
  `Book of Taiyou` "change 1 face-down monster to face-up Attack Position" flips a set `Morphing
  Jar` up, whose FLIP makes "both players discard … then each draws 5" [CDB]; `Book of Moon` then
  sets the Jar back down to reload the flip [CDB]. Each cycle churns 5 fresh cards.
- Bridge the loop with `Upstart Goblin`, `Reload`, `Good Goblin Housekeeping`, `Convulsion of
  Nature`; `Magical Stone Excavation` rebuys a used `Book`; `Magical Merchant` digs to a `Book`
  while thinning.
- **Win by** holding all five `Forbidden One` pieces, or grinding the opponent's deck out through
  the forced draws.
*Weaknesses:* hand disruption (`Delinquent Duo`, `Don Zaloog`) tossing a piece; `Cyber Jar`/
`Morphing Jar` flips also *help the opponent* draw; no board presence if the loop stalls. A spice
deck, not a tournament pick.

### 2.8 Cyber-Stein Combo/OTK
*Legality flag:* the famous Stein OTK targets (`Cyber Twin Dragon`, `Cyber End Dragon`) are
**post-TLM and illegal**. The GOAT-legal kill uses `Master of Oz` + `Megamorph`; `Cyber-Stein`
is Limited (1) so this is a *backup* inside a control shell.
**Monsters (16):** 1x Cyber-Stein, 1x Black Luster Soldier - Envoy of the Beginning, 1x Chaos
Sorcerer, 1x Airknight Parshath, 2x D.D. Warrior Lady, 1x D.D. Assailant, 1x Sangan, 1x Sinister
Serpent, 1x Magician of Faith, 2x Tsukuyomi, 1x Dekoichi the Battlechanted Locomotive, 1x Breaker
the Magical Warrior, 1x Spirit Reaper, 1x Exiled Force
**Spells (14):** 1x Megamorph, 1x Metamorphosis, 1x Scapegoat, 1x Brain Control, 1x Premature
Burial, 1x Snatch Steal, 1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm,
1x Mystical Space Typhoon, 1x Nobleman of Crossout, 2x Book of Moon
**Traps (10):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado,
1x Ceasefire
**Extra (5):** 1x Master of Oz, 1x Thousand-Eyes Restrict, 1x Ryu Senshi, 1x Dark Balter the
Terrible, 1x Musician King
**Side (sample):** 2x Kycoo the Ghost Destroyer, 2x Nobleman of Extermination, 2x Royal Decree

**Manual.**
*Game plan:* play straight Goat Control until you can assemble the one-card burst kill.
*Key cards / engine:* Cyber-Stein → Master of Oz → Megamorph.
*How to pilot / combo lines:*
- **The math (all [CDB]):** `Cyber-Stein` "pay 5000 LP; Special Summon 1 Fusion Monster from your
  Extra Deck in Attack Position" → summon `Master of Oz` (4200 ATK). You are now at **3000 LP**.
  `Megamorph`: "While your LP is lower than your opponent's, the equipped monster's ATK becomes
  double its original ATK" → 4200 × 2 = **8400**, exactly lethal through an open board.
- **Set it up:** clear blockers first with `Brain Control`/`Snatch Steal` (steal their monster,
  swing or tribute it) so Master of Oz connects; revive a used `Cyber-Stein` with `Premature
  Burial`/`Call of the Haunted` for a second attempt.
- Until you draw the pieces, pilot 2.1: Scapegoat→TER, Tsukuyomi value, full trap suite.
*Weaknesses:* you dip to 3000 LP mid-combo, so a live `Ring of Destruction`/`Sakuretsu`/`Mirror
Force` can kill or blank you — only commit when it ends the game; `Megamorph` and Master of Oz are
otherwise dead draws.

### 2.9 Water / Umi Control
**Monsters (18):** 2x The Legendary Fisherman, 3x Mother Grizzly, 2x Star Boy, 2x Fenrir,
2x Abyss Soldier, 2x 7 Colored Fish, 1x Amphibian Beast, 1x Gagagigo, 1x Levia-Dragon - Daedalus,
1x Sangan, 1x Sinister Serpent
**Spells (13):** 3x A Legendary Ocean, 1x Umi, 1x Big Wave Small Wave, 1x Pot of Greed,
1x Graceful Charity, 1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch
Steal, 1x Nobleman of Crossout, 1x Book of Moon
**Traps (9):** 2x Tornado Wall, 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction,
1x Call of the Haunted, 1x Bottomless Trap Hole, 1x Sakuretsu Armor, 1x Dust Tornado
**Extra:** none.

**Manual.**
*Game plan:* set up an "Umi" lock where you take zero battle damage and swing with an
untouchable Fisherman.
*Key cards / engine:* A Legendary Ocean/Umi + The Legendary Fisherman + Tornado Wall; Mother
Grizzly toolbox.
*How to pilot / combo lines:*
- **`A Legendary Ocean` is treated as "Umi", gives WATER +200, and lowers WATER Levels by 1**
  [CDB] — so `The Legendary Fisherman` becomes **Level 4 (no tribute)** and the fish get cheaper.
- **The lock:** with an "Umi" up, `The Legendary Fisherman` "is unaffected by Spell effects and
  cannot be targeted for attacks" [CDB] (a safe attacker), and `Tornado Wall` means "you take no
  battle damage" while Umi is up [CDB]. Net: you attack freely; the opponent can only attack you
  directly for **0**. That is the whole deck.
- **`Mother Grizzly`** dies to Special Summon a WATER (≤1500 ATK) from deck [CDB] — fetch a
  Fisherman, `Star Boy` (all WATER +500), or a fish. `Fenrir` recurs by banishing a WATER;
  `Abyss Soldier` discards a WATER to bounce any card.
- **`Levia-Dragon - Daedalus`**: "send 1 face-up 'Umi' you control to the GY; destroy all other
  cards on the field" [CDB] — a board reset. But it removes your own Umi, dropping the lock, so
  use it to break a stall and immediately re-lay a spare `A Legendary Ocean`.
*Weaknesses:* `Heavy Storm`/`MST` on `Tornado Wall` or the field spell collapses the lock; non-
battle removal (`Smashing Ground`, `Bottomless`, `Snatch Steal`) ignores the Fisherman's
protection; slow clock lets control decks out-resource you.

### 2.10 EARTH Beatdown (iconic rogue)
**Monsters (18):** 3x Giant Rat, 2x Berserk Gorilla, 1x Enraged Battle Ox, 2x Chiron the Mage,
1x Gigantes, 1x Exarion Universe, 2x D.D. Warrior Lady, 1x Breaker the Magical Warrior, 1x Exiled
Force, 1x Sangan, 1x Sinister Serpent, 1x Spirit Reaper, 1x Magician of Faith
**Spells (12):** 1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm,
1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch Steal, 1x Scapegoat, 1x Metamorphosis,
1x Nobleman of Crossout, 2x Book of Moon
**Traps (10):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado,
1x Trap Dustshoot
**Extra (4):** 1x Thousand-Eyes Restrict, 1x Ryu Senshi, 1x Dark Balter the Terrible,
1x Musician King

**Manual.**
*Game plan:* flood cheap EARTH beaters via recruiters, trade profitably, grind the opponent out.
*Key cards / engine:* Giant Rat recruiter; Berserk Gorilla; Chiron the Mage.
*How to pilot / combo lines:*
- **`Giant Rat`** dies to Special Summon an EARTH (≤1500 ATK) from deck [CDB] — fetch a `Berserk
  Gorilla` (2000 ATK, but it "must attack if able" and self-destructs in face-up Defense [CDB], so
  keep it attacking) or another Rat to keep the chain going.
- **`Chiron the Mage`** discards to blow up a Spell/Trap — pointed removal for the control decks'
  backrow. **`Gigantes`** banishes an EARTH from grave for a 1900 body. `Exarion Universe` pierces.
- Still runs the Scapegoat/Metamorphosis + Chaos-lite reach; the plan is a Rat-by-Rat attrition
  race backed by `Trap Dustshoot` up front to strip their key card.
*Weaknesses:* `Nobleman of Crossout` blows out set Giant Rats (no float); mass removal on a wide
board; lacks a single dominant threat, so a resolved TER or big Chaos beater can wall the swarm.

---

## 3. Theme / era decks (2003–2005) beyond the meta

Casual, flavorful builds. All names validated against `cards.cdb`. Manuals are combo-line-first;
mechanics are [CDB]-grounded, and where a piloting note is lore rather than a fetched primer it is
flagged `⚠`.

### 3.1 Blue-Eyes Dragons (Lord of D. + Flute)
**Monsters (18):** 3x Lord of D., 3x Blue-Eyes White Dragon, 2x Luster Dragon,
2x Luster Dragon #2, 2x Spear Dragon, 2x Masked Dragon, 1x Twin-Headed Behemoth,
1x Kaiser Sea Horse, 1x Sangan, 1x Sinister Serpent
**Spells (13):** 3x The Flute of Summoning Dragon, 1x Stamping Destruction, 1x Pot of Greed,
1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature
Burial, 1x Snatch Steal, 1x Nobleman of Crossout, 1x Book of Moon
**Traps (9):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado
**Extra:** none (optional `King Dragun` if you add `Polymerization` + `Divine Dragon Ragnarok`).

**Manual.**
*Game plan:* cheat big Dragons out early and beat down while they can't be targeted.
*Key cards / engine:* Lord of D. + The Flute of Summoning Dragon; Kaiser Sea Horse; Masked Dragon.
*How to pilot / combo lines:*
- **The signature turn:** Normal Summon `Lord of D.` (its text: "Neither player can target Dragon
  monsters on the field with card effects" [CDB]), then `The Flute of Summoning Dragon` "Special
  Summon up to 2 Dragon monsters from your hand" [CDB] — drop two `Blue-Eyes White Dragon`
  behind a Lord of D. that makes them untargetable.
- **`Kaiser Sea Horse`** counts as two tributes for a LIGHT Tribute Summon, so one tribute brings
  out `Blue-Eyes` the fair way. **`Masked Dragon`** recruits a Dragon on death (grab a Blue-Eyes
  or `Twin-Headed Behemoth`). `Spear Dragon` pierces; `Stamping Destruction` pops a backrow + burns
  500 while you control a Dragon.
*Weaknesses:* Lord of D. only stops *targeting* — `Torrential Tribute`, `Mirror Force`, `Dark
Hole` still wipe the Dragons; drawing Blue-Eyes with no Flute/Kaiser Sea Horse is a slow brick.

### 3.2 Dark Magician
**Monsters (18):** 2x Dark Magician, 1x Dark Magician Girl, 1x Dark Magician of Chaos, 2x Skilled
Dark Magician, 2x Skilled White Magician, 3x Apprentice Magician, 1x Old Vindictive Magician,
1x Magician of Faith, 1x Breaker the Magical Warrior, 1x Tsukuyomi, 1x Spirit Reaper, 1x Sangan,
1x Sinister Serpent
**Spells (13):** 1x Magical Dimension, 1x Dark Magic Attack, 1x Thousand Knives, 1x Magical Hats,
1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm, 1x Mystical Space
Typhoon, 1x Premature Burial, 1x Snatch Steal, 2x Book of Moon
**Traps (9):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado
**Extra:** none. **Do not use `Magician's Circle`** — it is Cybernetic Revolution, illegal.

**Manual.**
*Game plan:* Spellcaster control-beatdown that tutors and cheats out Dark Magician for 2-for-1s.
*Key cards / engine:* Apprentice Magician + Skilled Magicians; Magical Dimension.
*How to pilot / combo lines:*
- **`Apprentice Magician`** searches another Level-2 Spellcaster on death (chain Apprentices, or
  grab `Old Vindictive Magician`/`Magician of Faith`) and builds counters on `Skilled Dark/White
  Magician`, which Special Summon `Dark Magician` at three counters.
- **`Magical Dimension` is the payoff:** "Tribute [a Spellcaster you control]; Special Summon 1
  Spellcaster from your hand, then you can destroy 1 monster on the field" [CDB] — tribute a
  token/Apprentice, drop `Dark Magician`, and blow up an opponent's monster in one card.
- `Thousand Knives` (with Dark Magician out) and `Dark Magic Attack` clear threats/backrow;
  `Dark Magician of Chaos` is a Level-8 finisher that rebuys a Spell on summon.
*Weaknesses:* the vanilla Dark Magicians are slow if you don't draw the Apprentice/Skilled engine;
`Nobleman of Crossout` and mass removal punish the set-up bodies.

### 3.3 Relinquished / Thousand-Eyes (GOAT-legal Pegasus engine)
**Monsters (17):** 2x Relinquished, 2x Senju of the Thousand Hands, 2x Sonic Bird,
1x Thousand-Eyes Idol, 2x Mystic Tomato, 2x Tsukuyomi, 1x Sangan, 1x Sinister Serpent,
1x Magician of Faith,
1x Breaker the Magical Warrior, 1x Spirit Reaper, 1x Dekoichi the Battlechanted Locomotive
**Spells (14):** 2x Black Illusion Ritual, 1x Metamorphosis, 1x Scapegoat, 1x Premature Burial,
1x Snatch Steal, 1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo, 1x Heavy Storm,
1x Mystical Space Typhoon, 1x Nobleman of Crossout, 2x Book of Moon
**Traps (9):** 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Call of the
Haunted, 2x Sakuretsu Armor, 1x Bottomless Trap Hole, 1x Solemn Judgment, 1x Dust Tornado
**Extra (3):** 1x Thousand-Eyes Restrict, 1x Ryu Senshi, 1x Musician King

**Manual.**
*Game plan:* absorb the opponent's best monster twice over (Relinquished, then TER) and lock the
board.
*Key cards / engine:* Black Illusion Ritual + Relinquished; Metamorphosis token → TER.
*How to pilot / combo lines:*
- **Search the ritual:** `Senju of the Thousand Hands` (search a Ritual Monster on summon) and
  `Sonic Bird` (search a Ritual Spell) assemble `Relinquished` + `Black Illusion Ritual` — whose
  text tributes "a monster … whose Level is 1 or more" [CDB], so a `Scapegoat` token or a
  searcher pays for it.
- **`Relinquished` absorb line:** "target 1 monster your opponent controls; equip that target …
  ATK/DEF become equal … any battle damage you take from battles involving this card inflicts
  equal effect damage to your opponent" [CDB] — steal their beater and turn incoming damage into
  burn.
- **The bigger swing:** `Metamorphosis` a `Scapegoat` token → `Thousand-Eyes Restrict`, which
  absorbs a monster *and* freezes the board [CDB]. `Premature Burial`/`Call of the Haunted`
  recycle a used Relinquished. `Thousand-Eyes Idol` is only here as searchable Fusion material —
  keep it to one.
*Weaknesses:* Relinquished is a Ritual — dead without both halves; `Nobleman of Crossout`/battle
removal on the absorbing monster; `Heavy Storm` isn't relevant but backrow removal on your traps
opens the grind.

### 3.4 Exodia Stall
**Monsters (8):** 1x Exodia the Forbidden One, 1x Right Arm of the Forbidden One, 1x Left Arm of
the Forbidden One, 1x Right Leg of the Forbidden One, 1x Left Leg of the Forbidden One, 1x Sangan,
1x Magician of Faith, 1x Spirit Reaper
**Spells (18):** 3x Upstart Goblin, 3x Good Goblin Housekeeping, 2x Reload, 1x Magical Stone
Excavation, 1x Convulsion of Nature, 1x Pot of Greed, 1x Graceful Charity, 1x Delinquent Duo,
1x Swords of Revealing Light, 1x Messenger of Peace, 1x Level Limit - Area B, 1x Scapegoat,
1x Heavy Storm
**Traps (14):** 3x Jar of Greed, 2x Wall of Revealing Light, 2x Threatening Roar, 2x Waboku,
1x Gravity Bind, 1x Mirror Force, 1x Torrential Tribute, 1x Ring of Destruction, 1x Dust Tornado
**Extra:** none.

**Manual.**
*Game plan:* draw fast, never die, assemble all five `Forbidden One` pieces for the instant win.
*Key cards / engine:* Sangan + heavy draw; full stall suite.
*How to pilot / combo lines:*
- **Dig:** `Sangan` fetches a missing piece; `Magical Stone Excavation` rebuys `Pot`/`Graceful`;
  `Upstart`, `Reload`, `Good Goblin Housekeeping`, `Convulsion of Nature` churn cards.
- **Stall:** rotate `Scapegoat`, `Waboku`, `Threatening Roar`, `Jar of Greed`, `Gravity Bind`,
  `Level Limit - Area B`, `Messenger of Peace`, `Swords of Revealing Light`, `Wall of Revealing
  Light` so you never take a fatal turn while you draw toward the pieces.
- ⚠ **unverified line:** the exact draw-count/turn to expect the assembly is not from a fetched
  Exodia primer — the skeleton is sound but tune ratios against a guide.
*Weaknesses:* `Heavy Storm`/`MST` cracking the stall, and hand disruption (`Delinquent Duo`,
`Don Zaloog`) discarding a piece — hold a `Jar of Greed`/`Waboku` for the exposed turn.

### 3.5 Last Turn FTK (fringe, for completeness)  ⚠ unverified setup
Not a full 40 — a named gimmick. **`Last Turn`**: "activated during your opponent's turn when your
Life Points are 1000 or less. Select 1 monster on your field and send all other cards … your
opponent Special Summons 1 monster from their Deck … and attacks. The player whose monster remains
alone at the End Phase wins" [CDB]. The kill keeps **`Jowgen the Spiritualist`** — "Neither player
can Special Summon monsters" [CDB] — so the opponent **cannot** put out their attacker, leaving
your Jowgen alone → you win. `Last Turn` is **Limited (1)** and legal in April 2005 (hit later),
which is why the deck is a notorious GOAT-era gimmick. ⚠ The precise shell that safely drops you to
≤1000 LP with Jowgen already locking the board is **not corroborated by a fetched primer** — treat
as a novelty to verify, not a tuned list.

---

## 3B. Pegasus's deck — Starter Deck: Pegasus (the real product)

The coordinator asked for the **official Pegasus product**, verbatim. It is **Starter Deck:
Pegasus**, TCG set code **SDP**, **released March 30, 2003** [SDP] — the Duelist-Kingdom-era
"character" starter alongside Yugi (SDY), Kaiba (SDK), and Joey (SDJ), i.e. the TCG release of
Pegasus J. Crawford's deck (the Japanese character-deck line). Pegasus is a **Toon** duelist whose
ace is **Relinquished** [WIKI-PEG]. It is a **50-card starter (one copy of each card)** — a legal
deck as-is (≥40). **The exact printed contents [SDP]:**

**Monster (Ultra Rare):** 1x Relinquished (SDP-001)
**Monsters (Common):** 1x Red Archery Girl (SDP-002), 1x Ryu-Ran (SDP-003), 1x Illusionist
Faceless Mage (SDP-004), 1x Rogue Doll (SDP-005), 1x Uraby (SDP-006), 1x Giant Soldier of Stone
(SDP-007), 1x Aqua Madoor (SDP-008), 1x Toon Alligator (SDP-009), 1x Hane-Hane (SDP-010),
1x Sonic Bird (SDP-011), 1x Jigen Bakudan (SDP-012), 1x Mask of Darkness (SDP-013), 1x Witch of
the Black Forest (SDP-014), 1x Man-Eater Bug (SDP-015), 1x Muka Muka (SDP-016), 1x Dream Clown
(SDP-017), 1x Armed Ninja (SDP-018), 1x Hiro's Shadow Scout (SDP-019), 1x Blue-Eyes Toon Dragon
(SDP-020), 1x Toon Summoned Skull (SDP-021), 1x Manga Ryu-Ran (SDP-022), 1x Toon Mermaid (SDP-023)
**Spells:** 1x Toon World (SDP-024), 1x Black Pendant (SDP-025), 1x Dark Hole (SDP-026), 1x Dian
Keto the Cure Master (SDP-027), 1x Fissure (SDP-028), 1x De-Spell (SDP-029), 1x Change of Heart
(SDP-030), 1x Stop Defense (SDP-031), 1x Mystical Space Typhoon (SDP-032), 1x Rush Recklessly
(SDP-033), 1x Remove Trap (SDP-034), 1x Monster Reborn (SDP-035), 1x Soul Release (SDP-036),
1x Yami (SDP-037), 1x Black Illusion Ritual (SDP-038), 1x Ring of Magnetism (SDP-039), 1x Graceful
Charity (SDP-040, Super Rare)
**Traps:** 1x Gryphon Wing (SDP-050, Super Rare), 1x Trap Hole (SDP-041), 1x Reinforcements
(SDP-042), 1x Castle Walls (SDP-043), 1x Waboku (SDP-044), 1x Seven Tools of the Bandit (SDP-045),
1x Ultimate Offering (SDP-046), 1x Robbin' Goblin (SDP-047), 1x Magic Jammer (SDP-048), 1x
Enchanted Javelin (SDP-049)
**Extra Deck:** **none.** The product's ace `Relinquished` is a **Ritual** (via `Black Illusion
Ritual`), not a Fusion, so SDP ships no Extra Deck. Note: `Thousand-Eyes Restrict`, `Dragon
Piper`, and `Parrot Dragon` are **anime-only** Pegasus cards **not** in SDP (all three do exist in
`cards.cdb` if you want to add them — see the GOAT adaptation below).

**All 50 SDP names map 1:1 to `cards.cdb`** (validated). Retro spellings are preserved exactly:
`Red Archery Girl`, `Ryu-Ran`, `Robbin' Goblin` (apostrophe), `Hiro's Shadow Scout`. The Toon
monsters have `(GOAT)` errata entries (see section 4).

**Manual (authentic Toon/Relinquished play).**
*Game plan:* open `Toon World`, then either beat down with direct-attacking Toons or grind with
Relinquished's absorb.
*Key cards / engine:* Toon World enabler; Toon monsters; Relinquished (Black Illusion Ritual).
*How to pilot / combo lines (all [CDB]):*
- **Open Toon World, mind the tax.** `Toon World`: "Activate this card by paying 1000 LP" [CDB].
  Once it's up, your Toons can be Special Summoned from hand and — per each Toon's text — "Can
  attack your opponent directly, unless they control a Toon monster" [CDB]. But every attack costs
  "pay 500 LP" and **"If 'Toon World' on the field is destroyed, destroy this card"** [CDB]: the
  Toons live and die with Toon World.
- **Toon curve:** `Toon Mermaid` needs no tribute (just Toon World); `Toon Summoned Skull` tributes
  1; `Manga Ryu-Ran` and `Blue-Eyes Toon Dragon` tribute 2 [CDB]. Summon the cheapest that closes,
  swing directly, and watch your LP (1000 for the field + 500 per attack).
- **Relinquished control line:** Ritual-summon `Relinquished` with `Black Illusion Ritual`
  (tribute a Level-1+ monster [CDB]), then "equip [an opponent monster] … ATK/DEF become equal …
  battle damage you take … inflicts equal effect damage to your opponent" [CDB] — steal their
  attacker and turn its swings into burn. `Mask of Darkness`/`Magician of Faith`-style recursion
  and `Monster Reborn`/`Premature`-style revival rebuy Relinquished if it's removed.
- **Decision:** go Toon beatdown when the opponent's board is empty (direct damage races); switch
  to Relinquished control when they have a big threat worth absorbing.
*Weaknesses (small but fatal):* **`Toon World` is a single point of failure** — `Mystical Space
Typhoon`/`Heavy Storm`/`De-Spell` on it destroys **every** Toon at once [CDB]; the **1000 LP + 500-
per-attack tax** bleeds you into `Ring`/burn range; and `Relinquished` is a **Ritual brick** without
both halves. A flavor/rogue deck, not tier-0.

**Closest GOAT-legal build (if you want SDP to be tournament-legal).** As printed, SDP is a 2003
deck and includes cards **Forbidden** on the April-2005 list — remove **`Monster Reborn`** and
**`Witch of the Black Forest`** (edge; forbidden on the strict list). Everything else is legal at
these counts (the Limited-1 cards `Dark Hole`, `Change of Heart`, `Graceful Charity`, `Mystical
Space Typhoon` are each present exactly once). For a *competitive* Toon/Relinquished deck, use the
**Relinquished/TER engine in 3.3** and splash the pool-legal Toons — `Toon World`, `Toon Mermaid`,
`Toon Summoned Skull`, `Manga Ryu-Ran`, `Blue-Eyes Toon Dragon`, `Toon Alligator` all predate GOAT
and are legal — plus `Metamorphosis`→`Thousand-Eyes Restrict` for the lock. (⚠ Verify pool
legality of any *Toon support* like `Toon Table of Contents` before adding — it has a `(GOAT)`
errata entry but that is not a legality guarantee; see section 4.)

---

## 4. Card-name & database notes (for deck JSON authoring)

**Every card in this document exists verbatim in `vendor/BabelCDB/cards.cdb`** — I queried each.
Keep this punctuation exactly (it bites most often):
- Spaced hyphen ` - `: `Black Luster Soldier - Envoy of the Beginning`, `Chaos Emperor Dragon -
  Envoy of the End`, `Levia-Dragon - Daedalus`, `Level Limit - Area B`.
- Trailing/internal periods: `Lord of D.`, `D.D. Warrior Lady`, `D.D. Assailant`.
- Numerals/symbols: `7 Colored Fish`, `Luster Dragon #2`, `Level Up!`.
- Uppercase `LV`, no space: `Mystic Swordsman LV2/LV4`, `Armed Dragon LV3/LV5/LV7`,
  `Horus the Black Flame Dragon LV4/LV6/LV8`.
- Leading article kept: `The Legendary Fisherman`, `The Flute of Summoning Dragon`, `A Legendary
  Ocean`, `The Forceful Sentry`.
- Apostrophes/retro names (Pegasus deck): `Robbin' Goblin`, `Hiro's Shadow Scout`, `Red Archery
  Girl`, `Ryu-Ran`.
- **Gotcha:** it is **`Tribute to The Doomed`** (capital "The"), not "…the Doomed".

**GOAT errata variants — `vendor/BabelCDB/goat-entries.cdb`.** The harness ships a **second** DB of
**191 cards suffixed `(GOAT)`** with IDs in the `504700000+` range: era-erratum copies the simulator
swaps in for correct 2005 behavior. **When a card in your decklists has a `(GOAT)` entry, the deck
JSON should reference that entry** (by its GOAT id / `(GOAT)` name). Cards used above that have a
`(GOAT)` variant include: `Black Luster Soldier - Envoy of the Beginning`, `Sangan`, `Scapegoat`,
`Reasoning`, `Monster Gate`, `Rescue Cat`, `Cyber Jar`, `Nobleman of Crossout`, `Nobleman of
Extermination`, `Injection Fairy Lily`, `Thousand-Eyes Restrict`, `Relinquished`, `Fenrir`, `Mother
Grizzly`, `Mystic Tomato`, `Nimble Momonga`, `Spirit Reaper`, `Pyramid Turtle`, `Vampire Lord`,
`Levia-Dragon - Daedalus`, `Senju of the Thousand Hands`, `Sonic Bird`, `Apprentice Magician`,
`Skilled Dark Magician`, `Skilled White Magician`, `Magical Hats`, `Mystic Swordsman LV2/LV4`,
`Reinforcement of the Army`, `Gearfried the Iron Knight`, `Giant Germ`, `Masked Dragon`, `Element
Dragon`, `Horus … LV4/LV6`, `Armed Dragon LV3/LV5`, `Bottomless Trap Hole`, `Penguin Soldier`,
`Gravekeeper's Spy/Servant`, and the Toons `Blue-Eyes Toon Dragon`, `Toon Summoned Skull`, `Toon
Mermaid`, `Manga Ryu-Ran`, `Toon Table of Contents`, plus `Castle Walls`, `Reinforcements`,
`Rush Recklessly`, `Ring of Magnetism`, `Witch of the Black Forest`. (Common staples with **no**
`(GOAT)` variant — use the plain entry: `Airknight Parshath`, `Chaos Sorcerer`, `Tsukuyomi`,
`Metamorphosis`, `Book of Moon`, `Pot of Greed`, `Graceful Charity`, `Mirror Force`, `Sakuretsu
Armor`, `D.D. Warrior Lady`, `Blue-Eyes White Dragon`, `Dark Magician`, `Relinquished`'s ritual
`Black Illusion Ritual`, etc.)

**Caveat about `goat-entries.cdb`:** presence there is about **errata, not a legality whitelist**.
A few post-2005 names appear as `(GOAT)` entries (e.g. `Sage's Stone (GOAT)`, `Manju of the Ten
Thousand Hands (GOAT)`), which are *not* in the strict April-2005 / TLM pool. Gate legality on the
banlist + set cutoff, not on "does a `(GOAT)` row exist."

**Exist in `cards.cdb` but NOT GOAT-legal** (don't let a name-match fool the validator):
`Cyber Twin Dragon`/`Cyber End Dragon`/`Cyber Dragon`, `Magician's Circle`, `Compulsory Evacuation
Device`, `Chain Strike`, `Card Trooper`, `Salvage`, `Zombie Master`, `Marshmallon`, `Magician's
Valkyria`, `Sage's Stone`, `Kaibaman`, `The White Stone of Legend`. And the **Forbidden** cards in
section 1 (`Chaos Emperor Dragon - Envoy of the End`, `Yata-Garasu`, `Fiber Jar`, `Confiscation`,
`The Forceful Sentry`, `Monster Reborn`, `Painful Choice`, `Butterfly Dagger - Elma`, etc.) exist
in the DB but must never be added to a GOAT deck.

---

## Glossary
- **GOAT format** — metagame frozen at the March/April 2005 TCG banlist, pool through *The Lost
  Millennium*; 8000 LP.
- **Goat Control** — the archetypal deck: `Scapegoat` + `Metamorphosis` + `Tsukuyomi` value +
  Chaos finisher + heavy 1-for-1 removal.
- **Chaos monsters** — `Black Luster Soldier - Envoy of the Beginning` (Limited) and `Chaos
  Sorcerer`, banish-summon beaters needing LIGHT + DARK in grave.
- **TER** — `Thousand-Eyes Restrict`: absorbs one opponent monster and locks every other monster
  from attacking/changing position (yours too — it is a control lock).
- **Metamorphosis engine** — tribute a monster to Special Summon a same-Level Fusion; the Scapegoat
  token → TER line is the format's signature swing.
- **Floater** — a monster that replaces itself when it dies (`Sangan`, `Mystic Tomato`, recruiters).
- **Toon** — Pegasus's monsters; live only while `Toon World` is up, can attack directly, cost 500
  LP per attack, and die if Toon World is destroyed.
- **⚠ unverified line** — a piloting note grounded in card text but not corroborated by a strategy
  primer I could fetch this session; verify before relying on it.

## Sources
- YGOPRODeck, "An Introduction to Goat Format": <https://ygoprodeck.com/an-introduction-to-goat-format/>
  (strategy principles; BLS the "queen"/late finisher; reusing Flip monsters + TER via Tsukuyomi;
  card advantage; bluffing).
- YGOPRODeck set page, Starter Deck: Pegasus (exact contents, set code SDP, 50 cards, released
  2003-03-30): <https://ygoprodeck.com/pack/Starter+Deck:+Pegasus>.
- FormatLibrary — GOAT overview/banlist (April 2005; `Confiscation`/`The Forceful Sentry`
  Forbidden; `Delinquent Duo`/`Graceful Charity` usable; `Rescue Cat`/`Brain Control`/`Lightning
  Vortex` added; Chaos Turbo prominent): <https://formatlibrary.com/formats/goat>.
- GoatFormat.com — format definition (summer-2005 format named after Scapegoat; pool through *The
  Lost Millennium*; Scapegoat + Metamorphosis core): <https://www.goatformat.com/>,
  <https://www.goatformat.com/whatisgoat.html>.
- Wikipedia — Maximillion Pegasus (Toon deck; Relinquished ace): <https://en.wikipedia.org/wiki/Maximillion_Pegasus>.
- Card-effect text and exact-name validation: `vendor/BabelCDB/cards.cdb` and
  `vendor/BabelCDB/goat-entries.cdb` (queried directly in this repo — authoritative for mechanics
  and legal name spelling).

*Note on method:* WebSearch was unavailable this session (budget exhausted) and several primer
sites (reddit r/goatformat, Pojo, Yugipedia, Fandom) returned 403/402/blocked, so deeper
tournament-report lines could not be mined for every deck; those spots are flagged `⚠ unverified`
above per the "confidently-wrong is worse than none" rule. All *mechanics* are grounded in the
quoted `cards.cdb` text.

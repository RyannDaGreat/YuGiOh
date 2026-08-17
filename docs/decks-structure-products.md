# Early Structure Deck Products (Exact Printed Lists)

A catalogue of the **real, fixed-list** first-wave Yu-Gi-Oh! *Structure Deck* products
(TCG, 2005–2007), each a 40-card sealed product with an unchanging contents list. These are
intended to be turned into deck JSON for the harness under **category `"structure"`,
format `"classic"`** — one deck object per product, `main` built from the card list below,
`extra` only where the product ships an Extra-Deck card (none of SD1–SD10 do), no `side`.

## Sourcing & confidence (read this first)

**Card numbers, names, and counts** are transcribed from the Yugipedia product / Set Card
List pages (English/TCG printing), fetched live for this document — the source URL is cited
under each deck. Every deck's copy-counts were **hand-verified to sum to exactly 40**. These
counts are the load-bearing fact: the sealed products are fixed, so the list is the product.

**Manual mechanics** (what a card does, how the deck wins) are grounded in each deck's *actual
composition* (which cards, how many) — that part is factual from the list — plus the
**well-documented printed effects** of these classic cards. I did **not** have the card-effect
database open in this pass, so treat any specific effect wording as "from general knowledge of
these long-established cards, verify against the DB when authoring the JSON." Where a claim is
a strategy judgement rather than a printed fact it is phrased as such. This mirrors the honesty
convention used in `docs/goat-decks.md`.

**Honesty caveats.**
- **WebSearch budget was exhausted**, so I could not mine tournament/primer write-ups; piloting
  notes are derived from the printed composition and each archetype's well-known game plan, not
  from a fetched strategy guide. They are starting points, not photocopied deck guides.
- **Release dates**: Yugipedia's English(NA) field shows `January 1, YYYY` for several of these,
  which is Yugipedia's **placeholder for "year known, exact day unknown"** — treat any `Jan 1`
  date below as *year-accurate, day-uncertain*. Dates that are not Jan 1 (e.g. Blaze's May 9,
  2005) are real specific dates.
- Rarity: every card in these products is **Common** except a single **Ultra Rare** boss
  monster (`-EN001`) per deck — the box's showcase card.

## Glossary

- **Structure Deck (SD)** — a sealed, ready-to-play **40-card** product with a **fixed**
  contents list (unlike random booster packs). Built around one archetype/strategy with one
  Ultra Rare showcase boss. The first-wave TCG line is numbered SD1–SD10.
- **Set code prefix** — e.g. `SD1-EN`; each card is `SD1-EN001`, `SD1-EN002`, … These are the
  card *print* codes, not the DB card id.
- **Staple package** — a recurring core of generic power cards shipped in almost every early
  SD: `Snatch Steal`, `Mystical Space Typhoon`, `Nobleman of Crossout`, `Pot of Greed`,
  `Heavy Storm`, `Reload`, plus one of `Premature Burial` / `Call of the Haunted`. Many of
  these are Forbidden today; in the classic (2005-era) format they define the decks' power.
- **Boss (-EN001)** — the Ultra Rare headline monster of the box (Red-Eyes Darkness Dragon,
  Vampire Genesis, etc.). Usually a high-Level, two-tribute payoff.
- **Rename flag** — a card whose *printed* name here differs from its current Master-Duel /
  modern-DB name; flagged per deck so the JSON author uses the DB-verbatim name the harness
  expects. (Almost none in SD1–SD10; noted where they occur.)

## Authoring note (for the later JSON pass)

Each product below is one deck: `{"name": "<product name>", "category": "structure",
"format": "classic", "main": [[cardName, count], ...], "extra": []}`. Build `main` straight
from the deck's card-list table (name + Qty). **None of SD1–SD10 contains a Fusion/Extra-Deck
card**, so `extra` is empty for all of them. Map each printed name to the DB-verbatim name
(harness validates names against `vendor/BabelCDB/cards.cdb`); the tables below are already in
modern TCG spelling except where a **rename flag** says otherwise.

---

## SD1 — Structure Deck: Dragon's Roar

- **Set code:** `SD1-EN`  •  **Release (English/NA):** January 1, 2005 *(Jan 1 = year-accurate,
  day-uncertain)*  •  **40 cards, 28 unique**  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Dragon's_Roar>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD1-EN001 | Red-Eyes Darkness Dragon | Ultra Rare | 1 |
| SD1-EN002 | Red-Eyes B. Dragon | Common | 1 |
| SD1-EN003 | Luster Dragon | Common | 2 |
| SD1-EN004 | Twin-Headed Behemoth | Common | 1 |
| SD1-EN005 | Armed Dragon LV3 | Common | 2 |
| SD1-EN006 | Armed Dragon LV5 | Common | 2 |
| SD1-EN007 | Black Dragon's Chick | Common | 1 |
| SD1-EN008 | Element Dragon | Common | 1 |
| SD1-EN009 | Masked Dragon | Common | 3 |
| SD1-EN010 | Snatch Steal | Common | 1 |
| SD1-EN011 | Mystical Space Typhoon | Common | 1 |
| SD1-EN012 | Nobleman of Crossout | Common | 2 |
| SD1-EN013 | Premature Burial | Common | 1 |
| SD1-EN014 | Swords of Revealing Light | Common | 1 |
| SD1-EN015 | Pot of Greed | Common | 1 |
| SD1-EN016 | Heavy Storm | Common | 1 |
| SD1-EN017 | Stamping Destruction | Common | 3 |
| SD1-EN018 | Creature Swap | Common | 2 |
| SD1-EN019 | Reload | Common | 2 |
| SD1-EN020 | The Graveyard in the Fourth Dimension | Common | 1 |
| SD1-EN021 | Call of the Haunted | Common | 1 |
| SD1-EN022 | Ceasefire | Common | 1 |
| SD1-EN023 | The Dragon's Bead | Common | 1 |
| SD1-EN024 | Dragon's Rage | Common | 2 |
| SD1-EN025 | Reckless Greed | Common | 1 |
| SD1-EN026 | Interdimensional Matter Transporter | Common | 2 |
| SD1-EN027 | Trap Jammer | Common | 1 |
| SD1-EN028 | Curse of Anubis | Common | 1 |

**Rename flags:** `Red-Eyes B. Dragon` (`-EN002`) is the classic printed name; the current DB
name is **`Red-Eyes Black Dragon`** — use the DB form in JSON. Others match modern spelling.

**Manual.** *Game plan:* a **Dragon beatdown/tempo** deck — flood 1900-ATK bodies (`Luster
Dragon` x2, `Red-Eyes B. Dragon`) behind a recursion engine and close with the boss.
*Key cards:* **`Masked Dragon` x3** is the engine — when it dies it fetches another Dragon
(≤1500 ATK) from the deck, so trades never cost you tempo and thin toward `Armed Dragon LV3`,
`Element Dragon`, `Black Dragon's Chick`. **`Stamping Destruction` x3** is the signature card:
while you control a Dragon it blows up a Spell/Trap *and* burns 500 — cheap backrow control the
opponent must respect. **`Armed Dragon LV3 → LV5`** is a level-up beater line; **`Twin-Headed
Behemoth`** revives itself once (great chump/attacker); **`Dragon's Rage` x2** grants piercing
for reach. Boss **`Red-Eyes Darkness Dragon`** (two-tribute) gains ATK for every Dragon in
either Graveyard, snowballing past 3000 in the mid-game. *Core lines:* set up `Masked Dragon`
walls, grind 1-for-1 with `Stamping Destruction` + generic staples (`Snatch Steal`,
`Nobleman of Crossout` x2, `Heavy Storm`), then tribute chaff into the boss for a piercing
alpha strike; `Premature Burial` / `Call of the Haunted` recycle a fallen Dragon.
*Weaknesses:* the payoff is a slow two-tribute monster with no protection; heavy on beatsticks
and light on hard removal beyond staples; `Reckless Greed` / `Reload` can leave you topdecking.

---

## SD2 — Structure Deck: Zombie Madness

- **Set code:** `SD2-EN`  •  **Release (English/NA):** January 1, 2005 *(Jan 1 = year-accurate,
  day-uncertain)*  •  **40 cards, 28 unique**  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Zombie_Madness>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD2-EN001 | Vampire Genesis | Ultra Rare | 1 |
| SD2-EN002 | Master Kyonshee | Common | 1 |
| SD2-EN003 | Vampire Lord | Common | 1 |
| SD2-EN004 | Dark Dust Spirit | Common | 1 |
| SD2-EN005 | Pyramid Turtle | Common | 3 |
| SD2-EN006 | Spirit Reaper | Common | 1 |
| SD2-EN007 | Despair from the Dark | Common | 2 |
| SD2-EN008 | Ryu Kokki | Common | 2 |
| SD2-EN009 | Soul-Absorbing Bone Tower | Common | 1 |
| SD2-EN010 | Vampire Lady | Common | 1 |
| SD2-EN011 | Double Coston | Common | 1 |
| SD2-EN012 | Regenerating Mummy | Common | 2 |
| SD2-EN013 | Snatch Steal | Common | 1 |
| SD2-EN014 | Mystical Space Typhoon | Common | 1 |
| SD2-EN015 | Giant Trunade | Common | 1 |
| SD2-EN016 | Nobleman of Crossout | Common | 1 |
| SD2-EN017 | Pot of Greed | Common | 1 |
| SD2-EN018 | Card of Safe Return | Common | 1 |
| SD2-EN019 | Heavy Storm | Common | 1 |
| SD2-EN020 | Creature Swap | Common | 2 |
| SD2-EN021 | Book of Life | Common | 2 |
| SD2-EN022 | Call of the Mummy | Common | 3 |
| SD2-EN023 | Reload | Common | 2 |
| SD2-EN024 | Dust Tornado | Common | 1 |
| SD2-EN025 | Torrential Tribute | Common | 1 |
| SD2-EN026 | Magic Jammer | Common | 1 |
| SD2-EN027 | Reckless Greed | Common | 1 |
| SD2-EN028 | Compulsory Evacuation Device | Common | 3 |

**Rename flags:** none noted; names match modern spelling.

**Manual.** *Game plan:* a **Zombie swarm/recursion** deck that abuses cheap revival and
Graveyard setup to keep re-deploying bodies until a big Zombie ends it. *Key cards:*
**`Pyramid Turtle` x3** is the engine — on death it Special Summons any Zombie with ≤2000 DEF
from the deck (fetches `Vampire Lord`, `Ryu Kokki`, `Despair from the Dark`, or another Turtle),
so every combat trade builds board. **`Call of the Mummy` x3** free-summons a Zombie from hand
while you control no monsters — repeatable pressure. **`Book of Life` x2** revives a Zombie
*and* banishes a card from the opponent's Graveyard. **`Card of Safe Return`** turns all that
revival into raw card draw. Beaters: **`Ryu Kokki`** (2400, wrecks Warriors/Zombies),
**`Vampire Lord`** (recurs on destruction, decks-out cards), boss **`Vampire Genesis`**
(two-tribute; recycles Zombies from GY). *Core lines:* set `Pyramid Turtle`, trade or
`Torrential Tribute` to trigger it, chain revival with `Book of Life` / `Call of the Mummy`,
draw off `Card of Safe Return`, then swing with `Ryu Kokki` / boss. `Compulsory Evacuation
Device` x3 and `Torrential Tribute` reset bad boards; `Creature Swap` dumps a token/weak Zombie
for a threat. *Weaknesses:* `Card of Safe Return` and the revival engine are dead if the GY is
empty or banished; leans on flip/trigger tempo, so fast aggro can race it; boss again is a
vulnerable two-tribute.

---

## SD3 — Structure Deck: Blaze of Destruction

- **Set code:** `SD3-EN`  •  **Release (English/NA):** May 9, 2005  •  **40 cards, 31 unique**
  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Blaze_of_Destruction>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD3-EN001 | Infernal Flame Emperor | Ultra Rare | 1 |
| SD3-EN002 | Great Angus | Common | 1 |
| SD3-EN003 | Blazing Inpachi | Common | 1 |
| SD3-EN004 | UFO Turtle | Common | 3 |
| SD3-EN005 | Little Chimera | Common | 1 |
| SD3-EN006 | Inferno | Common | 2 |
| SD3-EN007 | Molten Zombie | Common | 1 |
| SD3-EN008 | Solar Flare Dragon | Common | 2 |
| SD3-EN009 | Ultimate Baseball Kid | Common | 2 |
| SD3-EN010 | Raging Flame Sprite | Common | 1 |
| SD3-EN011 | Thestalos the Firestorm Monarch | Common | 1 |
| SD3-EN012 | Gaia Soul the Combustible Collective | Common | 1 |
| SD3-EN013 | Fox Fire | Common | 1 |
| SD3-EN014 | Snatch Steal | Common | 1 |
| SD3-EN015 | Mystical Space Typhoon | Common | 1 |
| SD3-EN016 | Molten Destruction | Common | 2 |
| SD3-EN017 | Nobleman of Crossout | Common | 1 |
| SD3-EN018 | Premature Burial | Common | 1 |
| SD3-EN019 | Pot of Greed | Common | 1 |
| SD3-EN020 | Tribute to the Doomed | Common | 1 |
| SD3-EN021 | Heavy Storm | Common | 1 |
| SD3-EN022 | Dark Room of Nightmare | Common | 1 |
| SD3-EN023 | Reload | Common | 1 |
| SD3-EN024 | Level Limit - Area B | Common | 2 |
| SD3-EN025 | Necklace of Command | Common | 1 |
| SD3-EN026 | Meteor of Destruction | Common | 1 |
| SD3-EN027 | Dust Tornado | Common | 2 |
| SD3-EN028 | Call of the Haunted | Common | 1 |
| SD3-EN029 | Jar of Greed | Common | 1 |
| SD3-EN030 | Spell Shield Type-8 | Common | 1 |
| SD3-EN031 | Backfire | Common | 2 |

**Rename flags:** none — note the correct spelling is `Tribute to the Doomed` (lowercase "the").

**Manual.** *Game plan:* a **FIRE burn/control** deck — grind the opponent's Life Points with
recurring effect damage while `Level Limit` stalls the board, then finish with the boss.
*Key cards:* **`Solar Flare Dragon` x2** deals 500 each End Phase and is unattackable while you
control another Pyro — a slow clock plus a wall. **`UFO Turtle` x3** replaces itself with a FIRE
monster (≤1500 ATK) on death (fetches `Solar Flare Dragon`, `Raging Flame Sprite`, etc.).
**`Dark Room of Nightmare`** adds 300 to every instance of effect damage — it multiplies
`Solar Flare Dragon`, `Meteor of Destruction`, `Ultimate Baseball Kid`, `Inferno`. **`Molten
Destruction`** (Field) pumps FIRE +500 ATK. **`Level Limit - Area B` x2** flips the opponent's
high-ATK monsters to defense so your burn out-races them. `Thestalos the Firestorm Monarch`
(tribute boss discard-and-burn) and boss **`Infernal Flame Emperor`** (two-tribute; on summon,
banish FIRE from GY to destroy that many of the opponent's cards). *Core lines:* stall with
`Level Limit` + `Solar Flare Dragon` walls, tick damage every turn (boosted by `Dark Room of
Nightmare`), point `Meteor of Destruction` / `Ultimate Baseball Kid` at the face, close with
Emperor's mass removal. `Backfire` x2 punishes the opponent for destroying your FIRE monsters.
*Weaknesses:* burn is a *slow* clock and folds to lifegain or a fast beatdown that ignores the
wall; `Dark Room of Nightmare` and `Backfire` are dead draws on their own; boss needs FIRE
already banked in the GY to pay off.

---

## SD4 — Structure Deck: Fury from the Deep

- **Set code:** `SD4-EN`  •  **Release (English/NA):** May 9, 2005  •  **40 cards, 32 unique**
  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Fury_from_the_Deep>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD4-EN001 | Ocean Dragon Lord - Neo-Daedalus | Ultra Rare | 1 |
| SD4-EN002 | 7 Colored Fish | Common | 1 |
| SD4-EN003 | Sea Serpent Warrior of Darkness | Common | 1 |
| SD4-EN004 | Space Mambo | Common | 1 |
| SD4-EN005 | Mother Grizzly | Common | 3 |
| SD4-EN006 | Star Boy | Common | 1 |
| SD4-EN007 | Tribe-Infecting Virus | Common | 1 |
| SD4-EN008 | Fenrir | Common | 2 |
| SD4-EN009 | Amphibious Bugroth MK-3 | Common | 1 |
| SD4-EN010 | Levia-Dragon - Daedalus | Common | 1 |
| SD4-EN011 | Mermaid Knight | Common | 1 |
| SD4-EN012 | Mobius the Frost Monarch | Common | 1 |
| SD4-EN013 | Unshaven Angler | Common | 1 |
| SD4-EN014 | Creeping Doom Manta | Common | 1 |
| SD4-EN015 | Snatch Steal | Common | 1 |
| SD4-EN016 | Mystical Space Typhoon | Common | 1 |
| SD4-EN017 | Premature Burial | Common | 1 |
| SD4-EN018 | Pot of Greed | Common | 1 |
| SD4-EN019 | Heavy Storm | Common | 1 |
| SD4-EN020 | A Legendary Ocean | Common | 3 |
| SD4-EN021 | Creature Swap | Common | 1 |
| SD4-EN022 | Reload | Common | 2 |
| SD4-EN023 | Salvage | Common | 2 |
| SD4-EN024 | Hammer Shot | Common | 1 |
| SD4-EN025 | Big Wave Small Wave | Common | 1 |
| SD4-EN026 | Dust Tornado | Common | 1 |
| SD4-EN027 | Call of the Haunted | Common | 1 |
| SD4-EN028 | Gravity Bind | Common | 2 |
| SD4-EN029 | Tornado Wall | Common | 1 |
| SD4-EN030 | Torrential Tribute | Common | 1 |
| SD4-EN031 | Spell Shield Type-8 | Common | 1 |
| SD4-EN032 | Xing Zhen Hu | Common | 1 |

**Rename flags:** none noted; names match modern spelling.

**Manual.** *Game plan:* a **WATER "Umi" control/beatdown** deck built on **`A Legendary Ocean`
x3** (a version of Umi that lowers the Level of all WATER monsters by 1 and gives WATER +200
ATK/−200 DEF). *Key cards:* `A Legendary Ocean` makes the boss `Levia-Dragon - Daedalus`
one-tribute (Level 7→6) and turns `7 Colored Fish` / `Amphibious Bugroth MK-3` into pumped
beaters — Bugroth can attack directly while Umi is up. **`Mother Grizzly` x3** is the recruiter
(dies → Special Summon a WATER ≤1500 ATK), and **`Salvage` x2** returns two low-ATK WATER
monsters from GY to hand, so the deck refuses to run out of bodies. **`Tribe-Infecting Virus`**
(discard 1 → destroy every monster of a declared Type) is the panic-button board wipe.
**`Tornado Wall`** + Umi negates all battle damage to you — a soft lock — while `Gravity Bind`
x2 stalls big attackers. `Mobius the Frost Monarch` tribute-pops two backrow. *Core lines:*
resolve `A Legendary Ocean`, beat down with discounted WATER monsters + the Bugroth direct
attacker, grind with `Mother Grizzly`/`Salvage`, reset with `Tribe-Infecting Virus` /
`Torrential Tribute`, then send Umi to the GY with **`Ocean Dragon Lord - Neo-Daedalus`** /
`Levia-Dragon - Daedalus` to nuke every other card on the field and swing for game.
*Weaknesses:* the deck lives and dies on its Field Spell — `Heavy Storm` / `Mystical Space
Typhoon` / `Giant Trunade` on `A Legendary Ocean` collapses the level-discounts *and* the
`Tornado Wall` lock at once; the boss nukes need Umi on the field to fire; low individual ATK
without the field pump.

---

## SD5 — Structure Deck: Warrior's Triumph

- **Set code:** `SD5-EN`  •  **Release (English/NA):** November 2, 2005  •  **40 cards, 36 unique**
  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Warrior's_Triumph>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD5-EN001 | Gilford the Legend | Ultra Rare | 1 |
| SD5-EN002 | Warrior Lady of the Wasteland | Common | 1 |
| SD5-EN003 | Dark Blade | Common | 1 |
| SD5-EN004 | Goblin Attack Force | Common | 1 |
| SD5-EN005 | Gearfried the Iron Knight | Common | 2 |
| SD5-EN006 | Swift Gaia the Fierce Knight | Common | 1 |
| SD5-EN007 | Obnoxious Celtic Guard | Common | 1 |
| SD5-EN008 | Command Knight | Common | 1 |
| SD5-EN009 | Marauding Captain | Common | 2 |
| SD5-EN010 | Exiled Force | Common | 1 |
| SD5-EN011 | D.D. Warrior Lady | Common | 1 |
| SD5-EN012 | Mataza the Zapper | Common | 1 |
| SD5-EN013 | Mystic Swordsman LV2 | Common | 1 |
| SD5-EN014 | Mystic Swordsman LV4 | Common | 1 |
| SD5-EN015 | Ninja Grandmaster Sasuke | Common | 1 |
| SD5-EN016 | Gearfried the Swordmaster | Common | 1 |
| SD5-EN017 | Armed Samurai - Ben Kei | Common | 1 |
| SD5-EN018 | Divine Sword - Phoenix Blade | Common | 1 |
| SD5-EN019 | Snatch Steal | Common | 1 |
| SD5-EN020 | Mystical Space Typhoon | Common | 1 |
| SD5-EN021 | Giant Trunade | Common | 1 |
| SD5-EN022 | Lightning Blade | Common | 1 |
| SD5-EN023 | Heavy Storm | Common | 1 |
| SD5-EN024 | Reinforcement of the Army | Common | 2 |
| SD5-EN025 | The Warrior Returning Alive | Common | 1 |
| SD5-EN026 | Fusion Sword Murasame Blade | Common | 1 |
| SD5-EN027 | Wicked-Breaking Flamberge - Baou | Common | 1 |
| SD5-EN028 | Fairy of the Spring | Common | 1 |
| SD5-EN029 | Reload | Common | 2 |
| SD5-EN030 | Lightning Vortex | Common | 1 |
| SD5-EN031 | Swords of Concealing Light | Common | 1 |
| SD5-EN032 | Release Restraint | Common | 1 |
| SD5-EN033 | Call of the Haunted | Common | 1 |
| SD5-EN034 | Magic Jammer | Common | 1 |
| SD5-EN035 | Royal Decree | Common | 1 |
| SD5-EN036 | Blast with Chain | Common | 1 |

**Rename flags:** none; note `Swift Gaia the Fierce Knight` is its own card (distinct from
`Gaia The Fierce Knight`) — keep the name verbatim.

**Manual.** *Game plan:* **Warrior swarm/toolbox aggro** — search and chain small Warriors,
buff them, and end with `Gilford the Legend`. *Key cards:* **`Reinforcement of the Army` x2**
searches any Level ≤4 Warrior and **`The Warrior Returning Alive`** recurs one from GY — so you
almost always open a play. **`Marauding Captain` x2** is the swarm engine: on Normal Summon it
Special Summons a Level ≤4 monster from hand, *and* your other Warriors can't be attacked while
it's up. **`Command Knight`** gives all your Warriors +400 and can't be attacked while you
control another monster. The equip toolbox — `Divine Sword - Phoenix Blade` (returns itself from
GY), `Fusion Sword Murasame Blade`, `Lightning Blade`, `Wicked-Breaking Flamberge - Baou` —
feeds **`Armed Samurai - Ben Kei`** (extra attack per equip) and the boss. **`Gearfried the Iron
Knight` x2 → `Gearfried the Swordmaster`** via `Release Restraint` turns equip-triggers into
removal. `Exiled Force`, `D.D. Warrior Lady`, `Mataza the Zapper` (double attack) round out the
toolbox; `Royal Decree` shuts off the opponent's traps for the alpha strike. *Core lines:* RotA
→ `Marauding Captain`, chain Captains to flood, pump with `Command Knight`, stack equips on
`Ben Kei`/`Mataza` for multi-attacks, then tribute chaff into **`Gilford the Legend`** for the
board-clearing finisher. *Weaknesses:* equip-heavy, so `Heavy Storm` / `Mystical Space Typhoon`
generate blowout 2-for-1s; a wide board is a `Torrential Tribute` / `Mirror Force` magnet;
`Goblin Attack Force` sits at 0 ATK in defense after attacking.

---

## SD6 — Structure Deck: Spellcaster's Judgment

- **Set code:** `SD6-EN`  •  **Release (English/NA):** January 18, 2006  •  **40 cards, 36 unique**
  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Spellcaster's_Judgment>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD6-EN001 | Dark Eradicator Warlock | Ultra Rare | 1 |
| SD6-EN002 | Mythical Beast Cerberus | Common | 1 |
| SD6-EN003 | Dark Magician | Common | 1 |
| SD6-EN004 | Gemini Elf | Common | 1 |
| SD6-EN005 | Magician of Faith | Common | 2 |
| SD6-EN006 | Skilled Dark Magician | Common | 2 |
| SD6-EN007 | Apprentice Magician | Common | 2 |
| SD6-EN008 | Chaos Command Magician | Common | 1 |
| SD6-EN009 | Breaker the Magical Warrior | Common | 1 |
| SD6-EN010 | Royal Magical Library | Common | 1 |
| SD6-EN011 | Tsukuyomi | Common | 1 |
| SD6-EN012 | Chaos Sorcerer | Common | 1 |
| SD6-EN013 | White Magician Pikeru | Common | 1 |
| SD6-EN014 | Blast Magician | Common | 1 |
| SD6-EN015 | Ebon Magician Curran | Common | 1 |
| SD6-EN016 | Rapid-Fire Magician | Common | 1 |
| SD6-EN017 | Magical Blast | Common | 1 |
| SD6-EN018 | Mystical Space Typhoon | Common | 1 |
| SD6-EN019 | Nobleman of Crossout | Common | 1 |
| SD6-EN020 | Premature Burial | Common | 1 |
| SD6-EN021 | Swords of Revealing Light | Common | 1 |
| SD6-EN022 | Mage Power | Common | 1 |
| SD6-EN023 | Heavy Storm | Common | 1 |
| SD6-EN024 | Diffusion Wave-Motion | Common | 1 |
| SD6-EN025 | Reload | Common | 1 |
| SD6-EN026 | Dark Magic Attack | Common | 1 |
| SD6-EN027 | Spell Absorption | Common | 1 |
| SD6-EN028 | Lightning Vortex | Common | 1 |
| SD6-EN029 | Magical Dimension | Common | 2 |
| SD6-EN030 | Mystic Box | Common | 1 |
| SD6-EN031 | Nightmare's Steelcage | Common | 1 |
| SD6-EN032 | Call of the Haunted | Common | 1 |
| SD6-EN033 | Spell Shield Type-8 | Common | 1 |
| SD6-EN034 | Pitch-Black Power Stone | Common | 1 |
| SD6-EN035 | Divine Wrath | Common | 1 |
| SD6-EN036 | Magic Cylinder | Common | 1 |

**Rename flags:** none noted; names match modern spelling.

**Manual.** *Game plan:* a **Spellcaster toolbox/control** deck that cheats out `Dark Magician`
and converts spell-casting into damage via the boss. *Key cards:* **`Skilled Dark Magician` x2**
(3 Spell Counters → Special Summon `Dark Magician`) and **`Apprentice Magician` x2** (on summon
SS a Level ≤2 Spellcaster and place a counter) build the counter economy that also feeds
**`Royal Magical Library`** (draw) and `Breaker the Magical Warrior` (pop a S/T). **`Magical
Dimension` x2** is the key combo card: tribute a Spellcaster to instantly SS `Dark Magician`
from hand *and* destroy a monster. **`Diffusion Wave-Motion`** (pay 1000; a Level 7+ Spellcaster
attacks every monster) turns `Dark Magician` into a board-clearing OTK threat, while **`Dark
Magic Attack`** strips all opponent Spells/Traps once Dark Magician is up. The boss **`Dark
Eradicator Warlock`** makes every Normal Spell either player activates burn the opponent for
1000 — with the deck's dense Normal-Spell count that ends games fast. `Tsukuyomi` recycles
`Magician of Faith` for repeated Spell retrieval. *Core lines:* stack counters with
Apprentice/Skilled → `Magical Dimension` to drop `Dark Magician` while popping a blocker →
`Diffusion Wave-Motion` for the wide swing, or land `Warlock` and chain Normal Spells for burn.
*Weaknesses:* combo-piece dependent (needs enablers *and* payoff in hand); `Dark Magician` is a
vanilla 2500 if the support is answered; hard removal beyond staples is thin; both `Dark
Magician`-tier payoffs and `Warlock` are fragile two-tribute-class monsters that fold to a
single `Nobleman of Crossout` / trap.

---

## SD7 — Structure Deck: Invincible Fortress

- **Set code:** `SD7-EN`  •  **Release (English/NA):** May 15, 2006  •  **40 cards, 32 unique**
  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Invincible_Fortress>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD7-EN001 | Exxod, Master of The Guard | Ultra Rare | 1 |
| SD7-EN002 | Great Spirit | Common | 1 |
| SD7-EN003 | Giant Rat | Common | 3 |
| SD7-EN004 | Maharaghi | Common | 1 |
| SD7-EN005 | Guardian Sphinx | Common | 1 |
| SD7-EN006 | Gigantes | Common | 2 |
| SD7-EN007 | Stone Statue of the Aztecs | Common | 1 |
| SD7-EN008 | Golem Sentry | Common | 1 |
| SD7-EN009 | Hieracosphinx | Common | 1 |
| SD7-EN010 | Criosphinx | Common | 1 |
| SD7-EN011 | Moai Interceptor Cannons | Common | 2 |
| SD7-EN012 | Megarock Dragon | Common | 1 |
| SD7-EN013 | Guardian Statue | Common | 1 |
| SD7-EN014 | Medusa Worm | Common | 1 |
| SD7-EN015 | Sand Moth | Common | 1 |
| SD7-EN016 | Canyon | Common | 1 |
| SD7-EN017 | Mystical Space Typhoon | Common | 1 |
| SD7-EN018 | Premature Burial | Common | 1 |
| SD7-EN019 | Swords of Revealing Light | Common | 1 |
| SD7-EN020 | Shield & Sword | Common | 2 |
| SD7-EN021 | Magical Mallet | Common | 1 |
| SD7-EN022 | Hammer Shot | Common | 1 |
| SD7-EN023 | Ectoplasmer | Common | 1 |
| SD7-EN024 | Brain Control | Common | 1 |
| SD7-EN025 | Shifting Shadows | Common | 1 |
| SD7-EN026 | Waboku | Common | 1 |
| SD7-EN027 | Ultimate Offering | Common | 1 |
| SD7-EN028 | Magic Drain | Common | 2 |
| SD7-EN029 | Robbin' Goblin | Common | 1 |
| SD7-EN030 | Ordeal of a Traveler | Common | 2 |
| SD7-EN031 | Reckless Greed | Common | 1 |
| SD7-EN032 | Compulsory Evacuation Device | Common | 2 |

**Rename flags:** `Shield & Sword` (`-EN020`) — use a literal ampersand `&` in JSON (the raw
page rendered it as the HTML entity `&amp;`). Others match modern spelling.

**Manual.** *Game plan:* an **EARTH Rock stall/control** deck — wall up behind huge-DEF Rocks
and flip effects, grind the opponent out, and sit behind `Exxod, Master of The Guard`. *Key
cards:* **`Giant Rat` x3** recruits an EARTH ≤1500 ATK on death, endlessly refilling walls.
**`Guardian Sphinx`** is the engine beatstick — its flip effect bounces all of the opponent's
monsters back to hand and it can re-set itself, a repeatable board reset plus a 1700 body.
**`Stone Statue of the Aztecs`** (2000 DEF) doubles battle damage to whatever attacks it.
**`Ultimate Offering`** (pay 500 LP for an extra Normal Summon) fuels the two-tribute plays that
put `Guardian Sphinx` / the boss down early. **`Ordeal of a Traveler` x2** forms a guessing-game
bounce soft-lock; `Compulsory Evacuation Device` x2, `Waboku`, and `Magic Drain` x2 buy time.
The boss **`Exxod, Master of The Guard`** is a 0/4000 wall that is near-impossible to beat in
battle and pressures the opponent while your flip Rocks reset their side. *Core lines:* `Giant
Rat` into walls, loop `Guardian Sphinx` to keep the opponent boardless, accelerate tributes with
`Ultimate Offering`, chip with `Robbin' Goblin`/`Ectoplasmer`, and grind to a slow win behind
`Exxod`. *Weaknesses:* extremely **passive and slow** — it has almost no proactive damage plan
and folds to burn, to non-battle removal that ignores DEF (`Nobleman of Crossout`, `Smashing
Ground`), or to any deck that simply goes over the top; `Exxod` is a two-tribute wall with no
offense of its own.

---

## SD8 — Structure Deck: Lord of the Storm

- **Set code:** `SD8-EN`  •  **Release (English/NA):** July 12, 2006  •  **40 cards, 36 unique**
  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Lord_of_the_Storm>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD8-EN001 | Simorgh, Bird of Divinity | Ultra Rare | 1 |
| SD8-EN002 | Sonic Shooter | Common | 1 |
| SD8-EN003 | Sonic Duck | Common | 1 |
| SD8-EN004 | Harpie Girl | Common | 1 |
| SD8-EN005 | Slate Warrior | Common | 1 |
| SD8-EN006 | Flying Kamakiri #1 | Common | 2 |
| SD8-EN007 | Harpie Lady Sisters | Common | 2 |
| SD8-EN008 | Bladefly | Common | 1 |
| SD8-EN009 | Birdface | Common | 1 |
| SD8-EN010 | Silpheed | Common | 1 |
| SD8-EN011 | Lady Ninja Yae | Common | 1 |
| SD8-EN012 | Roc from the Valley of Haze | Common | 1 |
| SD8-EN013 | Harpie Lady 1 | Common | 1 |
| SD8-EN014 | Harpie Lady 2 | Common | 1 |
| SD8-EN015 | Harpie Lady 3 | Common | 1 |
| SD8-EN016 | Swift Birdman Joe | Common | 1 |
| SD8-EN017 | Harpie's Pet Baby Dragon | Common | 1 |
| SD8-EN018 | Card Destruction | Common | 1 |
| SD8-EN019 | Mystical Space Typhoon | Common | 1 |
| SD8-EN020 | Nobleman of Crossout | Common | 1 |
| SD8-EN021 | Elegant Egotist | Common | 2 |
| SD8-EN022 | Heavy Storm | Common | 1 |
| SD8-EN023 | Reload | Common | 1 |
| SD8-EN024 | Harpies' Hunting Ground | Common | 2 |
| SD8-EN025 | Triangle Ecstasy Spark | Common | 1 |
| SD8-EN026 | Lightning Vortex | Common | 1 |
| SD8-EN027 | Hysteric Party | Common | 1 |
| SD8-EN028 | Aqua Chorus | Common | 1 |
| SD8-EN029 | Dust Tornado | Common | 1 |
| SD8-EN030 | Call of the Haunted | Common | 1 |
| SD8-EN031 | Magic Jammer | Common | 1 |
| SD8-EN032 | Dark Coffin | Common | 1 |
| SD8-EN033 | Reckless Greed | Common | 1 |
| SD8-EN034 | Sakuretsu Armor | Common | 1 |
| SD8-EN035 | Ninjitsu Art of Transformation | Common | 1 |
| SD8-EN036 | Icarus Attack | Common | 1 |

**Rename flags:** `Ninjitsu Art of Transformation` (`-EN035`) — the original TCG print; modern
databases (incl. Master Duel) spell it **`Ninjutsu Art of Transformation`**. Use the DB form in
JSON. `Harpies' Hunting Ground` keeps the plural apostrophe. Others match modern spelling.

**Manual.** *Game plan:* a **WIND control/beatdown** deck that fuses a Harpie sub-engine with
Winged-Beast tempo. *Key cards:* the Harpie package — `Harpie Lady 1/2/3` + **`Harpie Lady
Sisters` x2**, deployed by **`Elegant Egotist` x2** and **`Hysteric Party`** — runs under
**`Harpies' Hunting Ground` x2** (each Harpie summon destroys a Spell/Trap, and Harpies get
+200/−200), giving relentless backrow removal. **`Triangle Ecstasy Spark`** (needs `Harpie Lady
Sisters`) sets every opposing monster to defense and blocks effect activations for a turn — the
swing-turn enabler. **`Icarus Attack`** (tribute a Winged Beast → destroy any 2 cards) is the
premier tempo trap. **`Flying Kamakiri #1` x2** recruits a WIND ≤1500 ATK on death, and
`Birdface` searches a Harpie when a Harpie dies. The boss **`Simorgh, Bird of Divinity`** is a
Special-Summonable 2700 that pressures set cards and resists traps. *Core lines:* build Harpies
under `Harpies' Hunting Ground` to grind the opponent's backrow to zero, use `Icarus Attack`
for 2-for-1 tempo, then `Triangle Ecstasy Spark` to freeze their board and alpha strike; add
`Simorgh` on top for reach. *Weaknesses:* the engine is fragile — losing `Harpies' Hunting
Ground` or the `Sisters` guts the combos, and **`Hysteric Party` is a huge `Mystical Space
Typhoon`/`Heavy Storm` blowout target**; individual WIND beaters are small; the payoffs depend
on keeping specific named pieces alive.

---

## SD09 — Structure Deck: Dinosaur's Rage

- **Set code:** `SD09-EN` *(zero-padded — this is the 9th TCG Structure Deck; Yugipedia: "In the
  TCG, it is the ninth deck")*  •  **Release (English/NA):** October 20, 2006  •  **40 cards,
  36 unique**  •  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Dinosaur's_Rage>

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD09-EN001 | Super Conductor Tyranno | Ultra Rare | 1 |
| SD09-EN002 | Kabazauls | Common | 1 |
| SD09-EN003 | Sabersaurus | Common | 1 |
| SD09-EN004 | Mad Sword Beast | Common | 1 |
| SD09-EN005 | Gilasaurus | Common | 2 |
| SD09-EN006 | Dark Driceratops | Common | 1 |
| SD09-EN007 | Hyper Hammerhead | Common | 2 |
| SD09-EN008 | Black Tyranno | Common | 1 |
| SD09-EN009 | Tyranno Infinity | Common | 1 |
| SD09-EN010 | Hydrogeddon | Common | 2 |
| SD09-EN011 | Oxygeddon | Common | 1 |
| SD09-EN012 | Black Ptera | Common | 1 |
| SD09-EN013 | Black Stego | Common | 1 |
| SD09-EN014 | Ultimate Tyranno | Common | 1 |
| SD09-EN015 | Miracle Jurassic Egg | Common | 1 |
| SD09-EN016 | Babycerasaurus | Common | 1 |
| SD09-EN017 | Big Evolution Pill | Common | 1 |
| SD09-EN018 | Tail Swipe | Common | 1 |
| SD09-EN019 | Jurassic World | Common | 1 |
| SD09-EN020 | Sebek's Blessing | Common | 1 |
| SD09-EN021 | Riryoku | Common | 1 |
| SD09-EN022 | Mesmeric Control | Common | 1 |
| SD09-EN023 | Mystical Space Typhoon | Common | 1 |
| SD09-EN024 | Megamorph | Common | 1 |
| SD09-EN025 | Heavy Storm | Common | 1 |
| SD09-EN026 | Lightning Vortex | Common | 1 |
| SD09-EN027 | Magical Mallet | Common | 2 |
| SD09-EN028 | Hunting Instinct | Common | 1 |
| SD09-EN029 | Survival Instinct | Common | 1 |
| SD09-EN030 | Volcanic Eruption | Common | 1 |
| SD09-EN031 | Seismic Shockwave | Common | 1 |
| SD09-EN032 | Magical Arm Shield | Common | 1 |
| SD09-EN033 | Negate Attack | Common | 1 |
| SD09-EN034 | Goblin Out of the Frying Pan | Common | 1 |
| SD09-EN035 | Malfunction | Common | 1 |
| SD09-EN036 | Fossil Excavation | Common | 1 |

**Rename flags:** none noted; names match modern spelling. (Set-code prefix is `SD09`, not
`SD9` — the print codes are zero-padded.)

**Manual.** *Game plan:* **Dinosaur aggro** — cheat out oversized Dinos and hit for big
numbers, backed by burn from the boss. *Key cards:* **`Big Evolution Pill`** (tribute a Dino,
then Normal Summon Dinosaurs *without* tribute for 3 turns) lets you drop `Ultimate Tyranno`
(3000, attacks all) or `Black Tyranno` as normal summons; **`Gilasaurus` x2** Special Summons
itself for free, providing the tribute fodder and quick bodies. `Sabersaurus` / `Kabazauls` are
1900 Level-4 beaters. **`Hydrogeddon` x2** snowballs — each time it destroys a monster by battle
it Special Summons another `Hydrogeddon` from the deck. **`Hyper Hammerhead` x2** bounces
whatever it battles. **`Jurassic World`** gives all Dinos +300; `Super Conductor Tyranno` (boss,
3300) can tribute your own monsters to burn 1000 each; `Tyranno Infinity` scales with banished
Dinos. `Fossil Excavation` revives a Dino; `Sebek's Blessing`/`Riryoku`/`Megamorph` add reach.
*Core lines:* `Gilasaurus` + fodder → `Big Evolution Pill` → drop a huge Dino for a
tribute-free swing; let `Hydrogeddon` snowball on combat; pump with `Jurassic World`, then close
with `Super Conductor Tyranno` burn + beats. *Weaknesses:* `Big Evolution Pill` is the linchpin
and a slow, `Mystical Space Typhoon`-vulnerable enabler; `Ultimate Tyranno`'s forced "attack all"
walks into `Mirror Force`/traps; thin backrow disruption; monster-heavy, so board wipes
(`Torrential Tribute`, `Mirror Force`) are backbreaking.

---

## SD10 — Structure Deck: Machine Re-Volt

- **Set code:** `SD10-EN` *(the 10th TCG Structure Deck; Yugipedia: "In the TCG, it is the tenth
  deck")*  •  **Release (English/NA):** January 17, 2007  •  **40 cards, 37 unique**  •
  **Extra Deck:** none
- **Source:** <https://r.jina.ai/https://yugipedia.com/wiki/Structure_Deck:_Machine_Re-Volt>
- **Sourcing note:** Machine Re-Volt's dedicated Set-Card-List page was an empty stub, so this
  list is from the main product page; it self-verifies (quantities sum to 40, ordinal + set code
  + date each confirmed on two prompts).

| Card # | Name | Rarity | Qty |
|--------|------|--------|-----|
| SD10-EN001 | Ancient Gear Gadjiltron Dragon | Ultra Rare | 1 |
| SD10-EN002 | Ancient Gear Gadjiltron Chimera | Common | 1 |
| SD10-EN003 | Ancient Gear Engineer | Common | 1 |
| SD10-EN004 | Boot-Up Soldier - Dread Dynamo | Common | 1 |
| SD10-EN005 | Mechanicalchaser | Common | 1 |
| SD10-EN006 | Green Gadget | Common | 1 |
| SD10-EN007 | Red Gadget | Common | 1 |
| SD10-EN008 | Yellow Gadget | Common | 1 |
| SD10-EN009 | Cannon Soldier | Common | 1 |
| SD10-EN010 | Gear Golem the Moving Fortress | Common | 1 |
| SD10-EN011 | Heavy Mech Support Platform | Common | 2 |
| SD10-EN012 | Ancient Gear Golem | Common | 1 |
| SD10-EN013 | Ancient Gear Beast | Common | 1 |
| SD10-EN014 | Ancient Gear Soldier | Common | 1 |
| SD10-EN015 | Ancient Gear | Common | 2 |
| SD10-EN016 | Ancient Gear Cannon | Common | 1 |
| SD10-EN017 | Ancient Gear Workshop | Common | 1 |
| SD10-EN018 | Ancient Gear Tank | Common | 1 |
| SD10-EN019 | Ancient Gear Explosive | Common | 1 |
| SD10-EN020 | Ancient Gear Fist | Common | 1 |
| SD10-EN021 | Ancient Gear Factory | Common | 1 |
| SD10-EN022 | Ancient Gear Drill | Common | 1 |
| SD10-EN023 | Ancient Gear Castle | Common | 1 |
| SD10-EN024 | Mystical Space Typhoon | Common | 1 |
| SD10-EN025 | Limiter Removal | Common | 1 |
| SD10-EN026 | Heavy Storm | Common | 1 |
| SD10-EN027 | Enemy Controller | Common | 1 |
| SD10-EN028 | Weapon Change | Common | 1 |
| SD10-EN029 | Machine Duplication | Common | 1 |
| SD10-EN030 | Pot of Avarice | Common | 1 |
| SD10-EN031 | Stronghold the Moving Fortress | Common | 1 |
| SD10-EN032 | Ultimate Offering | Common | 1 |
| SD10-EN033 | Sakuretsu Armor | Common | 2 |
| SD10-EN034 | Micro Ray | Common | 1 |
| SD10-EN035 | Rare Metalmorph | Common | 1 |
| SD10-EN036 | Covering Fire | Common | 1 |
| SD10-EN037 | Roll Out! | Common | 1 |

**Rename flags:** none noted; names match modern spelling.

**Manual.** *Game plan:* **Ancient Gear / Machine midrange** — grind card advantage with Gadgets
and land `Ancient Gear Golem` for unanswerable 3000 damage, topping out on the Gadjiltron boss.
*Key cards:* **`Green` / `Red` / `Yellow Gadget`** each add another Gadget from the deck on
Normal Summon — a card-neutral advantage loop that also supplies tribute fodder. **`Ancient Gear
Golem`** (3000, inflicts piercing and prevents the opponent from responding with Spells/Traps
during its attack) is the payoff; **`Ancient Gear Soldier`/`Beast`** apply the same
response-suppression at lower cost. **`Ancient Gear Castle`** (counts up ATK and can be tributed
toward the Golem's summon) and **`Ancient Gear Factory`** accelerate the big Machines out.
**`Limiter Removal`** doubles Machine ATK for surprise lethal; `Machine Duplication` clones a
low-ATK Machine; `Heavy Mech Support Platform` x2 and `Roll Out!` recur equips/Unions. Boss
**`Ancient Gear Gadjiltron Dragon`** (and `Chimera`) declare a Type on attack for burn/effects.
*Core lines:* churn Gadgets for advantage and fodder → tribute into `Ancient Gear Golem` for
3000 unpreventable damage → convert with `Limiter Removal` when you need to close, with the
Gadjiltron boss as top-end. *Weaknesses:* `Ancient Gear Golem` is a two-tribute investment that
any single removal answers after you commit; **`Limiter Removal` destroys your own Machines at
the End Phase** (all-in), and Gadgets are steady but *slow* tempo — the deck can stall if its big
beater is repeatedly answered.

---

## Appendix: shared "staple package" across SD1–SD10

Every early Structure Deck ships from the same generic power pool; recognizing it helps the JSON
author spot the archetype cards vs. the filler. Recurring across most boxes:

- **Draw/consistency:** `Pot of Greed`, `Reload`, `Reckless Greed` (and later `Pot of Avarice`,
  `Card Destruction`, `Magical Mallet`).
- **Backrow/board removal:** `Mystical Space Typhoon`, `Heavy Storm`, `Dust Tornado`,
  `Nobleman of Crossout`, `Lightning Vortex`, `Torrential Tribute`, `Giant Trunade`.
- **Revival/theft:** `Premature Burial`, `Call of the Haunted`, `Snatch Steal`, `Creature Swap`,
  `Brain Control`.
- **Defensive/utility traps:** `Sakuretsu Armor`, `Waboku`, `Magic Jammer` / `Magic Drain`,
  `Compulsory Evacuation Device`, `Spell Shield Type-8`, `Swords of Revealing Light`.

Many of these (`Pot of Greed`, `Heavy Storm`, `Snatch Steal`, `Premature Burial`) are Forbidden
on modern lists but were legal in the **classic (2005-era)** environment these products target —
which is why the JSON `format` is `"classic"`, not a modern banlist.

## Verification summary

| # | Product | Set code | Release (EN/NA) | Cards (unique) | Σ=40? | Extra |
|---|---------|----------|-----------------|----------------|-------|-------|
| SD1 | Dragon's Roar | SD1-EN | 2005-01-01\* | 40 (28) | yes | none |
| SD2 | Zombie Madness | SD2-EN | 2005-01-01\* | 40 (28) | yes | none |
| SD3 | Blaze of Destruction | SD3-EN | 2005-05-09 | 40 (31) | yes | none |
| SD4 | Fury from the Deep | SD4-EN | 2005-05-09 | 40 (32) | yes | none |
| SD5 | Warrior's Triumph | SD5-EN | 2005-11-02 | 40 (36) | yes | none |
| SD6 | Spellcaster's Judgment | SD6-EN | 2006-01-18 | 40 (36) | yes | none |
| SD7 | Invincible Fortress | SD7-EN | 2006-05-15 | 40 (32) | yes | none |
| SD8 | Lord of the Storm | SD8-EN | 2006-07-12 | 40 (36) | yes | none |
| SD09 | Dinosaur's Rage | SD09-EN | 2006-10-20 | 40 (36) | yes | none |
| SD10 | Machine Re-Volt | SD10-EN | 2007-01-17 | 40 (37) | yes | none |

\* Jan 1 = Yugipedia year-known/day-unknown placeholder.

**Confidence:** card numbers/names/counts transcribed from the cited Yugipedia pages; every
deck's counts hand-verified to sum to exactly 40; none of SD1–SD10 contains a Fusion/Extra-Deck
card. Rename flags to apply when authoring JSON: `Red-Eyes B. Dragon`→`Red-Eyes Black Dragon`
(SD1), `Ninjitsu`→`Ninjutsu Art of Transformation` (SD8), and use a literal `&` in `Shield &
Sword` (SD7). All other names should still be validated verbatim against
`vendor/BabelCDB/cards.cdb` before the harness will accept them.

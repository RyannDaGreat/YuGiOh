# Character & Starter Deck Library

Official **character / Starter Decks** with **exact printed contents**, plus **anime-character
deck reconstructions** (clearly labelled) for the ocgcore harness. Companion to
`docs/goat-decks.md`; intended to be authored later as deck JSON with **category `"structure"`,
format `"classic"`**.

## Sourcing & confidence (read this first)

Two very different kinds of list live here, and they are labelled on every deck:

- **[REAL PRODUCT]** — an actual printed set. The list is the **exact 50-card contents** in
  set-number order, so it can be transcribed verbatim into a deck JSON. Sourced from
  **Yugipedia** set pages (fetched via `https://r.jina.ai/` because Yugipedia 403s a bare
  fetch). Accuracy of these is the top priority and each is cited.
- **[ANIME RECONSTRUCTION — not a printed product]** — the character never had a single
  official constructed product, so this is a **faithful ~40-card build** using the cards that
  character actually played in the anime plus **era-legal staples** of their arc
  (Duelist Kingdom / Battle City, roughly *Legend of Blue Eyes* → *Pharaonic Guardian* pool).
  Card **names are exact modern DB names** so they validate, but **counts and the exact
  40 are my construction**, not a photocopy of a decklist. These are starting points.

**Honesty caveat (matches `goat-decks.md`).** This session's **WebSearch budget was exhausted**
and the dedicated anime-deck wikis were largely unreachable: **Fandom (yugioh.fandom.com) is
CAPTCHA-walled** even through the jina proxy, and **Yugipedia character overview pages do not
expose a full card-by-card anime decklist** (they render prose + a couple of signature combos
only). So the four **Starter Deck** lists below are **verbatim from Yugipedia and trustworthy**;
the **anime reconstructions are grounded in show knowledge + era-legality**, and any card whose
inclusion or modern name I am not certain of is flagged **⚠**. Treat reconstructions as
"authorable drafts to sanity-check against an episode guide", never as canonical decklists.

Source tags:
- **[YP-SDY/SDK/SDJ/SDP]** — Yugipedia Starter Deck set pages (exact contents):
  `yugipedia.com/wiki/Starter_Deck:_Yugi` (and `_Kaiba`, `_Joey`, `_Pegasus`), fetched via
  `https://r.jina.ai/`.
- **[GD]** — `docs/goat-decks.md` in this repo (Pegasus/Toon, Relinquished, Fisherman/Tornado
  Wall already analysed there).
- **[ANIME]** — general Duel Monsters anime knowledge (Duelist Kingdom + Battle City arcs);
  used for reconstructions, flagged ⚠ where a specific card is uncertain.

---

# Part A — Real official products (exact printed lists)

The classic-era **English Starter Decks** are the closest thing to official "character decks":
each is a 50-card, one-of-each constructed product built around that character's signature card.
They are **tournament-legal as printed** and map cleanly to a `"structure"` deck JSON. Note the
product ships **one copy of each card** (no duplicates); a "playable" build would trim/duplicate,
but the JSON should reflect the **product as sold** unless the harness wants a tuned version.

## A.1 Starter Deck: Yugi — set code **SDY** [REAL PRODUCT]
Released **2002-03-29** (TCG). 50 cards: 1 Ultra, 2 Super, 47 Common. Ace: **Dark Magician**.
Rarities matter for flavour only. Source: **[YP-SDY]**.

**Exact list (SDY-001 … 050):**
1 Mystical Elf, 1 Feral Imp, 1 Winged Dragon, Guardian of the Fortress #1, 1 Summoned Skull,
1 Beaver Warrior, 1 Dark Magician *(Ultra)*, 1 Gaia The Fierce Knight, 1 Curse of Dragon,
1 Celtic Guardian, 1 Mammoth Graveyard, 1 Great White, 1 Silver Fang, 1 Giant Soldier of Stone,
1 Dragon Zombie, 1 Doma The Angel of Silence, 1 Ansatsu, 1 Witty Phantom, 1 Claw Reacher,
1 Mystic Clown, 1 Sword of Dark Destruction, 1 Book of Secret Arts, 1 Dark Hole,
1 Dian Keto the Cure Master, 1 Ancient Elf, 1 Magical Ghost, 1 Fissure, 1 Trap Hole,
1 Two-Pronged Attack, 1 De-Spell, 1 Monster Reborn, 1 Reinforcements, 1 Change of Heart,
1 The Stern Mystic, 1 Wall of Illusion, 1 Neo the Magic Swordsman, 1 Baron of the Fiend Sword,
1 Man-Eating Treasure Chest, 1 Sorcerer of the Doomed, 1 Last Will, 1 Waboku,
1 Soul Exchange *(Super)*, 1 Card Destruction *(Super)*, 1 Trap Master, 1 Dragon Capture Jar,
1 Yami, 1 Man-Eater Bug, 1 Reverse Trap, 1 Remove Trap, 1 Castle Walls, 1 Ultimate Offering.
*(European 46-card version omits Beaver Warrior, Mammoth Graveyard, Neo the Magic Swordsman,
Man-Eating Treasure Chest — those went to Magic Ruler. Use the 50-card NA list for the JSON.)*

**Manual.**
*Game plan:* fair beatdown around **Dark Magician** (2500) and **Summoned Skull** (2500), with
**Gaia The Fierce Knight** (2300) as a third big beater; grind with cheap **1-for-1 removal**
(Dark Hole, Fissure, Trap Hole, Man-Eater Bug) and swing tempo with **Change of Heart /
Monster Reborn / Soul Exchange**. *Key cards / lines:* **Book of Secret Arts** +
**Sword of Dark Destruction** stack ATK on the spellcaster/fiend beaters; **Yami** field pumps
Dark Magician & Summoned Skull; **Ultimate Offering** lets you overload for a surprise double
Summon; **Card Destruction / Last Will** refill. *How to pilot (the meat):* this is a **value
grind** deck, not a combo deck — lead with Flip walls (**Man-Eater Bug**, **The Stern Mystic**,
**Trap Master**, **Wall of Illusion**) to trade up, hold **Waboku/Castle Walls** to survive a
big turn, then **Monster Reborn / Soul Exchange / Change of Heart** to steal or recur the
biggest body and close with an equipped Dark Magician under Yami. Every removal card is a
singleton, so **sequence removal for the real threat, not the first monster**. *Weaknesses:*
no engine, no draw beyond Card Destruction — it can brick into small vanillas; removal is
one-shot. *Sources:* **[YP-SDY]**.

## A.2 Starter Deck: Kaiba — set code **SDK** [REAL PRODUCT]
Released **2002-03-29** (TCG). 50 cards: 1 Ultra, 2 Super, 47 Common. Ace: **Blue-Eyes White
Dragon**. Source: **[YP-SDK]**.

**Exact list (SDK-001 … 050):**
1 Blue-Eyes White Dragon *(Ultra)*, 1 Hitotsu-Me Giant, 1 Ryu-Kishin, 1 The Wicked Worm Beast,
1 Battle Ox, 1 Koumori Dragon, 1 Judge Man, 1 Rogue Doll, 1 Kojikocy, 1 Uraby,
1 Gyakutenno Megami, 1 Mystic Horseman, 1 Terra the Terrible, 1 Dark Titan of Terror,
1 Dark Assailant, 1 Master & Expert, 1 Unknown Warrior of Fiend, 1 Mystic Clown,
1 Ogre of the Black Shadow, 1 Dark Energy, 1 Invigoration, 1 Dark Hole, 1 Ookazi,
1 Ryu-Kishin Powered, 1 Swordstalker, 1 La Jinn the Mystical Genie of the Lamp, 1 Rude Kaiser,
1 Destroyer Golem, 1 Skull Red Bird, 1 D. Human, 1 Pale Beast, 1 Fissure, 1 Trap Hole,
1 Two-Pronged Attack, 1 De-Spell, 1 Monster Reborn, 1 The Inexperienced Spy, 1 Reinforcements,
1 Ancient Telescope, 1 Just Desserts, 1 Lord of D. *(Super)*,
1 The Flute of Summoning Dragon *(Super)*, 1 Mysterious Puppeteer, 1 Trap Master, 1 Sogen,
1 Hane-Hane, 1 Reverse Trap, 1 Remove Trap, 1 Castle Walls, 1 Ultimate Offering.
*(European 46-card version omits Hitotsu-Me Giant, Ookazi, Pale Beast, Hane-Hane. Use 50-card NA.)*

**Manual.**
*Game plan:* aggressive beatdown behind **Blue-Eyes White Dragon** (3000, the biggest vanilla
in the era) and a pile of solid 1500–1800 beaters (**La Jinn** 1800, **Battle Ox** 1700,
**Rude Kaiser** 1800, **Judge Man** 2200). *Key line:* **Lord of D.** + **The Flute of Summoning
Dragon** — Flute lets you drop **two Dragons from hand** (Blue-Eyes + Koumori/Ryu-Kishin
Powered) and Lord of D. protects them from targeted removal; that is the deck's one real combo.
*How to pilot (the meat):* mulligan toward a **1700+ beater turn 1**, apply pressure, and use
**Dark Hole / Fissure / Trap Hole / Hane-Hane** to clear blockers so Blue-Eyes connects.
**Sogen** pumps your Warriors/Beast-Warriors (Battle Ox, Rude Kaiser); **Dark Energy /
Invigoration** are equip pumps for Fiends/Beasts to push a beater over the next size class.
Hold **Just Desserts** as reach (500 per opposing monster) and **Waboku-style** stall is *not*
here, so you must **win the board race** — trade down opposing monsters with removal, keep
attacking. **Mysterious Puppeteer** (gain 500 on any summon) is minor lifegain, not a plan.
*Weaknesses:* only one 3000 body and it's a singleton; no card draw at all; folds to a bigger
wall (Blue-Eyes bounces off nothing but is answered by their own removal). *Sources:* **[YP-SDK]**.

## A.3 Starter Deck: Joey — set code **SDJ** [REAL PRODUCT]
Released **2003-03-30** (TCG), tournament-legal 2003-05-08. 50 cards: 1 Ultra, 2 Super, 47
Common. Ace: **Red-Eyes Black Dragon**. Yugipedia notes it "includes cards used by Joey Wheeler
in the anime." Source: **[YP-SDJ]**.

**Exact list (SDJ-001 … 050):**
1 Red-Eyes Black Dragon *(Ultra)*, 1 Swordsman of Landstar, 1 Baby Dragon, 1 Spirit of the Harp,
1 Island Turtle, 1 Flame Manipulator, 1 Masaki the Legendary Swordsman, 1 7 Colored Fish,
1 Armored Lizard, 1 Darkfire Soldier #1, 1 Sky Scout, 1 Gearfried the Iron Knight, 1 Karate Man,
1 Milus Radiant, 1 Time Wizard, 1 Maha Vailo, 1 Magician of Faith, 1 Big Eye, 1 Sangan,
1 Princess of Tsurugi, 1 White Magical Hat, 1 Penguin Soldier *(Super)*, 1 Thousand Dragon,
1 Flame Swordsman, 1 Malevolent Nuzzler, 1 Dark Hole, 1 Dian Keto the Cure Master, 1 Fissure,
1 De-Spell, 1 Change of Heart, 1 Block Attack, 1 Giant Trunade, 1 The Reliable Guardian,
1 Remove Trap, 1 Monster Reborn, 1 Polymerization, 1 Mountain, 1 Dragon Treasure,
1 Eternal Rest, 1 Shield & Sword, 1 Scapegoat *(Super)*, 1 Just Desserts, 1 Trap Hole,
1 Reinforcements, 1 Castle Walls, 1 Waboku, 1 Ultimate Offering, 1 Seven Tools of the Bandit,
1 Fake Trap, 1 Reverse Trap.

**Manual.**
*Game plan:* Warrior/Dragon midrange with the signature **Time Wizard gamble**. *Key lines:*
(1) **Baby Dragon + Time Wizard → Thousand Dragon** — Time Wizard's coin flip ages Baby Dragon
into **Thousand Dragon** (2400) and halves opposing ATK, Joey's iconic Duelist-Kingdom combo;
the product ships all three pieces. (2) **Flame Manipulator + Masaki → Flame Swordsman** via
**Polymerization** (or just play the printed Flame Swordsman); pump it with **Dragon Treasure /
Malevolent Nuzzler / Mountain**. *How to pilot (the meat):* it plays like a slightly gimmicky
SDY — trade with **Sangan** (search on death), **Magician of Faith** (recur a Spell),
**Penguin Soldier** (bounce two monsters) and **Princess of Tsurugi** (burn on flip), then land
a pumped **Red-Eyes** (2400) or **Thousand Dragon**. **Scapegoat + Waboku + Castle Walls**
buy the turn you need to assemble Time Wizard; **Giant Trunade** clears their backrow before a
big swing; **Shield & Sword** swaps ATK/DEF to blow out a wall. **Block Attack** shuts off their
best attacker for a turn. *Weaknesses:* Time Wizard is a **literal coin flip** (miss = often
lose your Baby Dragon); many low-ATK filler vanillas; no consistent draw. *Sources:* **[YP-SDJ]**.

## A.4 Starter Deck: Pegasus — set code **SDP** [REAL PRODUCT — analysed in `goat-decks.md` §3B]
Released **2003-03-30**. Ace: **Relinquished** (Ultra). This is the **Toon / Relinquished**
product and is already given with its exact 50-card list, Toon-World mechanics, and pilot
manual in **`docs/goat-decks.md` §3B (and the Relinquished/Thousand-Eyes engine in §3.3)**.
**Do not re-transcribe here — author the JSON from that section.** One-line reminder of its
shape: `Relinquished` + `Black Illusion Ritual` (absorb a monster), the four **Toon** beaters
(`Blue-Eyes Toon Dragon`, `Toon Summoned Skull`, `Manga Ryu-Ran`, `Toon Mermaid`) live under
`Toon World`, plus DK-era Flip/control staples (`Man-Eater Bug`, `Mask of Darkness`,
`Witch of the Black Forest`, `Graceful Charity`, `Mystical Space Typhoon`). Source: **[GD]**,
**[YP-SDP]**.

## A.5 Japanese & later real character products (pointers, not full lists)
The task asked whether the **Japanese character Structure Decks** have distinct exact lists to
transcribe. Honest answer: **the classic-era Japanese equivalents of SDY/SDK were not
per-character** — they were the generic **Starter Box / Starter Box: Theatrical Version** and the
**EX / EX-R Starter Boxes** (Yugi-vs-Kaiba dual boxes), which is where SDK/SDY drew their cards.
So there is **no separate Japanese "Structure Deck: Yugi" with a different exact list** worth a
second JSON in the classic era; SDY/SDK/SDJ above are the canonical character products.

Later **real** character products do exist and could be mined in a future pass (each has an exact
list, but most are **booster-style pools or non-classic formats**, so flagged):
- **Duelist Pack: Yugi Muto (DPYG)** and **Duelist Pack: Kaiba (DPKB)** — 2010 booster packs of
  each duelist's signature cards (Dark Magician / Blue-Eyes support). Real, exact pools, but a
  *booster*, not a constructed deck.
- **Legendary Decks II (LDK2, 2016)** — three real **constructed 43-card decks** (Yami Yugi,
  Kaiba, Joey) *each bundling that duelist's Egyptian God card*. This is the best "official
  anime-accurate constructed deck" product; worth transcribing if the harness wants God-card
  variants. ⚠ exact lists not fetched this session.
- **Speed Duel Starter Decks** (e.g. *Match of the Millennium*, *Twisted Nightmares*,
  *Duelists of Tomorrow*) — real constructed character decks (Yugi/Kaiba, Bakura/Pegasus,
  Joey/Mai) but in **Speed Duel** rules (Skill cards, no Main-Phase-2, 4 zones), so **not
  `"classic"`** — do not mix into a classic JSON without conversion.

---

# Part B — Iconic anime-character decks (reconstructions)

**Every deck in Part B is `[ANIME RECONSTRUCTION — not a printed product]`.** ~40 Main; small
Extra where the character used Fusions. Names are exact DB names; **counts/exact-40 are my
construction**; ⚠ marks a card whose inclusion or modern name I could not verify this session.

## B.1 Joey Wheeler — Red-Eyes / Warrior / Gamble (Battle City build)
*(Distinct from the printed SDJ above: this is Joey's evolved **Battle City** deck, which added
`Jinzo`, `Panther Warrior`, and the dice cards.)*

**Monsters (18):** 1 Red-Eyes Black Dragon, 1 Jinzo, 1 Panther Warrior, 1 Gearfried the Iron
Knight, 1 Flame Swordsman, 1 Rocket Warrior, 1 Alligator's Sword, 1 Baby Dragon, 1 Time Wizard,
1 Swordsman of Landstar, 1 Little-Winguard, 1 Axe Raider, 1 Goblin Attack Force, 1 Garoozis ⚠,
1 Warrior Dai Grepher ⚠, 1 Masaki the Legendary Swordsman, 1 Flame Manipulator, 1 Sangan
**Spells (13):** 1 Scapegoat, 1 Polymerization, 1 Monster Reborn, 1 Giant Trunade, 1 De-Spell,
1 Mystical Space Typhoon, 1 Legendary Sword, 1 Salamandra, 1 Lightning Blade ⚠, 1 Dragon
Treasure, 1 Question ⚠, 1 Graceful Dice, 1 Skull Dice
**Traps (9):** 1 Skull Dice, 1 Graceful Dice *(anime dice appear as both Spell & Trap prints —
use the DB category)*, 1 Kunai with Chain, 1 Magic Arm Shield ⚠, 1 Fairy Box ⚠, 1 Waboku,
1 Castle Walls, 1 Just Desserts, 1 Reinforcements
**Extra (Fusion, 3):** 1 Flame Swordsman *(Flame Manipulator + Masaki)*, 1 Thousand Dragon
*(Baby Dragon + Time Wizard)*, 1 Meteor B. Dragon *(Red-Eyes + Meteor Dragon)* ⚠ — add
`Meteor Dragon` to Main if the harness requires a real Fusion material.

**Manual.**
*Game plan:* aggressive Warrior beatdown with a **Red-Eyes / Jinzo** top end and a **luck-based
tempo swing** (Time Wizard, dice) as the finisher, exactly Joey's underdog identity.
*Key cards / engine:* **Jinzo** shuts off all Traps (turns off the opponent's Mirror Force /
Waboku so your beaters connect); **Panther Warrior** (tribute a monster to attack — pairs with
**Scapegoat** tokens for a guaranteed 2000 swing); **Time Wizard** as coin-flip removal +
Thousand Dragon; **Red-Eyes** as the equip target (Legendary Sword / Salamandra / Dragon
Treasure push it to ~2900). *How to pilot (the meat):* open with a mid Warrior and **Scapegoat**;
next turn **Panther Warrior + tribute a Goat → 2000 unblockable-tempo attack**, or land
**Jinzo** to neuter their traps and start swinging with Red-Eyes. The **dice cards** are your
comeback buttons — **Skull Dice** (shrink their monster ATK/DEF ×result) and **Graceful Dice**
(pump yours) turn a losing combat into a blowout; **Time Wizard** can wipe *their* board on a
good flip. Sequence: **remove their backrow (Giant Trunade / MST) → drop Jinzo → alpha strike**.
Hold **Waboku / Castle Walls / Fairy Box** to survive to the turn you assemble a big body.
*Weaknesses:* variance (dice + Time Wizard can whiff and cost you tempo); Jinzo also **turns off
your own** Traps; thin on draw. *Sources:* **[ANIME]**; renames: none major — dice cards print
in DB as listed; `Meteor B. Dragon` is the classic fusion name.

## B.2 Mai Valentine — Harpie Ladies + Harpie's Pet Dragon
**Monsters (17):** 3 Harpie Lady, 1 Harpie Lady Sisters, 2 Cyber Harpie Lady, 1 Harpie's Pet
Dragon, 1 Harpie Lady 1 ⚠ *(the ATK-boosting Wind version; DB splits the original into
`Harpie Lady 1/2/3` — pick per harness pool)*, 1 Amazoness Chain Master, 1 Amazoness Swords
Woman ⚠, 1 Sonic Duck ⚠, 1 Birdface ⚠ *(searches Harpie Lady)*, 1 Cyber Harpie ⚠ *(older print
name of Cyber Harpie Lady — use only one form)*, 1 Skelengel ⚠, 1 Dunames Dark Witch ⚠
**Spells (14):** 3 Elegant Egotist *(clone a Harpie Lady / make Harpie Lady Sisters)*, 1 Cyber
Shield *(equip, +500 to a Harpie Lady)*, 1 Rose Whip, 1 Harpie's Feather Duster ⚠ *(banned in
many formats — her "rarest card"; include only if the classic pool allows)*, 1 Mystical Space
Typhoon, 1 Monster Reborn, 1 Graceful Charity, 1 Pot of Greed, 1 Harpie's Hunting Ground
*(Field: destroy a S/T on Harpie summon)*, 1 Shrink ⚠, 1 Rush Recklessly ⚠, 1 Cyber Harpie's
support…, 1 Elegant Egotist *(4th listed → cap at 3)*
**Traps (9):** 2 Mirror Wall *(halve attacking ATK — Mai's signature wall)*, 1 Dust Tornado,
1 Waboku, 1 Call of the Haunted, 1 Amazoness Archers ⚠, 1 Gravity Bind ⚠, 1 Rescue Operation ⚠,
1 Widespread Ruin ⚠
**Extra:** none required (Harpie's Pet Dragon is a Normal Monster, not a Fusion).
> ⚠ **Build note:** the counts above list *options*; trim to a legal 40 (e.g. 3 Harpie Lady,
> 2 Cyber Harpie Lady, 1 Harpie Lady Sisters, 1 Harpie's Pet Dragon, 1 Amazoness Chain Master +
> ~10 era beaters; 3 Elegant Egotist, Cyber Shield, Harpie's Hunting Ground, MST, Graceful
> Charity, Pot of Greed, Monster Reborn; 2 Mirror Wall + Dust Tornado + Waboku + Call of the
> Haunted).

**Manual.**
*Game plan:* **Harpie swarm + equip pump behind Mirror Wall**. Flood with Harpie Ladies, buff
them with **Cyber Shield / Rose Whip**, and hide behind **Mirror Wall** halving every attacker
while you race. *Key cards / engine:* **Elegant Egotist** is the engine — it Special Summons a
**Harpie Lady** (or upgrades to **Harpie Lady Sisters**, 1950) from hand/deck, multiplying bodies
fast; **Harpie's Hunting Ground** (Field) pops an opposing S/T **every time a Harpie hits the
field**, so Egotist doubles as backrow removal; **Cyber Harpie Lady** (1800) is the workhorse
beater; **Harpie's Pet Dragon** gains **+300 ATK/DEF per Harpie Lady** you control — with two or
three Ladies out it's a 2500–2800 finisher. *How to pilot (the meat):* set **Mirror Wall** early;
spam Egotist to build a Harpie board while Hunting Ground strips their traps; equip **Cyber
Shield** onto a Cyber Harpie Lady (2300) and **Rose Whip** for reach; deploy **Harpie's Pet
Dragon** once you have ≥2 Ladies so it's oversized, then alpha-strike. **Amazoness Chain Master**
is her famous tech — on death it can **steal a card from the opponent's hand** (in the anime she
took Marik's God card). Keep **Graceful Charity / Pot of Greed** to refuel the swarm.
*Weaknesses:* leans on Mirror Wall staying up (folds to MST/Heavy Storm); mass-removal
(Dark Hole / Torrential) wipes the swarm and shrinks Harpie's Pet Dragon; without Egotist she can
flood-then-stall. *Sources:* **[ANIME]**. **Renames to flag:** anime **"Cyber Harpie" → DB
"Cyber Harpie Lady"** (pick one form); the original single **"Harpie Lady"** is split in the
modern DB into **"Harpie Lady 1 / 2 / 3"** plus a generic **"Harpie Lady"** — choose whichever
the harness card pool actually contains.

## B.3 Bakura (Yami Bakura) — Occult / Fiend / Dark Necrofear
**Monsters (16):** 1 Dark Necrofear *(ace)*, 2 The Portrait's Secret, 2 The Gross Ghost of Fled
Dreams, 2 Headless Knight, 2 Souls of the Forgotten, 1 Earthbound Spirit, 2 Man-Eater Bug,
1 The Earl of Demise, 1 Puppet Master ⚠, 1 Jowls of Dark Demise ⚠, 1 Sangan
**Spells (10):** 1 Dark Sanctuary *(Field — Bakura's signature; hides monsters & drains LP on
attack)*, 1 Dark Necrofear's ritual…, 1 Monster Reborn, 1 Premature Burial, 1 Dark Hole,
1 Mystical Space Typhoon, 1 Book of Life ⚠ *(Zombie-revive tech)*, 1 Multiply ⚠, 1 Graceful
Charity, 1 Pot of Greed
**Traps (14):** 1 Destiny Board, 1 Spirit Message 'I', 1 Spirit Message 'N', 1 Spirit Message
'A', 1 Spirit Message 'L', 1 Call of the Haunted, 2 Waboku, 1 Dark Spirit of the Silent ⚠,
1 Just Desserts, 1 Michizure ⚠, 1 Dust Tornado, 1 Mirror Force, 1 Compulsory ⚠ *(era-check)*
**Extra:** none.
> ⚠ Trim to 40 (e.g. drop a Spell or a ⚠ Trap). Destiny Board + 4 Spirit Messages = a 5-card
> alt-win package; keep all five together or cut the package entirely.

**Manual.**
*Game plan:* **grindy Fiend control that wins by attrition or by the Destiny Board alt-win**,
under the fog of **Dark Sanctuary**. *Key cards / engine:* **Dark Necrofear** (2200) is the ace —
it's summoned by banishing 3 Fiends from the GY, and when destroyed it **equips to an opponent's
monster and takes control of it**; because Bakura's deck is *all Fiends*, the GY fuels it
naturally. **Destiny Board**: while it's up, each turn a **Spirit Message** letter is placed;
spelling **F-I-N-A-L** (Destiny Board + I + N + A + L) is an **automatic win** — the deck's
primary kill. **Dark Sanctuary** (Field) hides a monster face-down as a "ghost" that **drains
half the ATK of anything that attacks it** and can't be safely removed. *How to pilot (the meat):*
stall the early game with **Man-Eater Bug**, **Souls of the Forgotten** / **The Gross Ghost of
Fled Dreams** (weak Flip/defensive Fiends), and **Waboku**; set **Dark Sanctuary** to tax their
attacks; then either (a) resolve **Destiny Board** and **protect it 4 turns** with Waboku/Mirror
Force/backrow to spell FINAL, or (b) assemble **Dark Necrofear**, let it trade, and **hijack their
best monster** on its death. **Michizure/Just Desserts** are reach; **Premature Burial / Call of
the Haunted / Monster Reborn** recur Necrofear or a Flip wall. The whole plan is **protect the
board state, not race** — you want the game to go long. *Weaknesses:* Destiny Board is fragile
(one **MST/Heavy Storm/Dust Tornado** on the *board* or on a Message resets the clock, and its
removal breaks the whole line); slow clock invites being run over by aggro before FINAL lands;
Necrofear needs GY setup. *Sources:* **[ANIME]**. **Renames to flag:** anime **"Ouija Board" →
DB "Destiny Board"**; the letters are **"Spirit Message 'I' / 'N' / 'A' / 'L'"** (quoted-letter
names) — spelling order in play is **Destiny Board, I, N, A, L → "FINAL"**.

## B.4 Marik Ishtar — Immortals / God-focus (Ra), Slifer noted
*(Marik piloted two things: a **Ra + Revival Jam lock** and a pile of **sadistic "Immortal"
Fiends**. The Egyptian Gods are handled per the harness's God-card policy — see note.)*

**Monsters (17):** 1 The Winged Dragon of Ra *(ace — see God note)*, 3 Revival Jam, 1 Lava
Golem, 1 Makyura the Destructor, 1 Helpoemer, 1 Bowganian, 1 Mystic Tomato, 1 Newdoria,
1 Gil Garth, 1 Viser Des, 1 Drillago, 1 Humanoid Slime ⚠, 1 Worm Drake ⚠, 1 Granadora ⚠,
1 Sangan
**Spells (12):** 1 Jam Breeding Machine, 1 Card of Safe Return, 1 Infinite Cards, 1 Monster
Reborn, 1 Premature Burial, 1 Dark Hole, 1 Mystical Space Typhoon, 1 Graceful Charity, 1 Pot of
Greed, 1 Book of Moon ⚠, 1 Snatch Steal ⚠, 1 Change of Heart ⚠
**Traps (11):** 1 Jam Defender, 1 Metal Reflect Slime, 1 Coffin Seller, 1 Nightmare Wheel ⚠,
1 Ring of Destruction, 1 Mirror Force, 1 Call of the Haunted, 1 Torrential Tribute, 1 Vampiric
Leech ⚠ *(anime card — verify DB name/existence)*, 1 Waboku, 1 Dust Tornado
**Extra:** none.
> ⚠ **God note:** if the harness excludes the actual God cards, **drop `The Winged Dragon of Ra`
> and run the deck as the Revival-Jam lock + Immortal burn** (it functions without Ra). If Gods
> are allowed, Ra is the tribute-3 finisher. **Slifer** is *not* Marik's own card — he only ever
> wielded it briefly after stealing it; include Slifer only as an explicit variant, not the base.

**Manual.**
*Game plan:* **an unbreakable defensive lock + inevitability burn** — set up an immortal wall,
then grind the opponent to death with effect damage and, if allowed, drop **Ra** to finish.
*Key cards / engine — the signature Slifer/Ra lock:* **Revival Jam** revives itself every time it
leaves the field; **Jam Defender** **redirects all attacks to Revival Jam**; **Card of Safe
Return** draws you a card **every time a monster is Special Summoned from the GY** — so Revival
Jam dying-and-reviving under Jam Defender **loops draws**, and **Infinite Cards** removes the hand
limit so you never discard. Under a big attacker (Ra/Slifer) this is a **soft-lock that refuels
while your board can't be attacked through**. *How to pilot (the meat):* early, stall with
**Metal Reflect Slime** (a 3000-DEF trap wall) and **Waboku/Mirror Force**; deploy **Revival Jam +
Jam Defender** so **nothing can attack your other monsters**; land **Card of Safe Return +
Infinite Cards** and start looping Jam for cards. Meanwhile chip with the **Immortal package** —
**Bowganian** (600 burn each turn), **Coffin Seller** (300 whenever an opponent's monster hits the
GY), **Helpoemer** (forces a discard), **Viser Des / Nightmare Wheel** (torture-lock + burn a
pinned monster), **Lava Golem** (give the *opponent* a 3000 body that **burns them 1000 each
standby** while clearing two of their monsters as tribute). **Makyura the Destructor** lets you
**play Traps from hand** the turn it dies — explosive with the trap-heavy build. Close with
**Ring of Destruction** to their monster (or, with Gods on, Ra). *Weaknesses:* the lock is
**backrow-dependent** (Heavy Storm / MST on Jam Defender or Card of Safe Return collapses it);
slow to assemble; **Lava Golem** hands the opponent a huge body if you can't burn them out first.
*Sources:* **[ANIME]**; Yugipedia confirms the **five-card "Slifer, Revival Jam, Infinite Cards,
Jam Defender, Card of Safe Return"** combo **[YP — Marik page]**. **Renames/verify:** `Vampiric
Leech`, `Granadora`, `Nightmare Wheel` names/existence unverified this session (⚠).

## B.5 Weevil Underwood — Insect
**Monsters (18):** 1 Insect Queen *(ace)*, 1 Perfectly Ultimate Great Moth, 1 Great Moth,
1 Petit Moth, 1 Larvae Moth ⚠, 2 Basic Insect, 1 Hercules Beetle, 1 Kwagar Hercules ⚠,
1 Insect Soldiers of the Sky, 1 Pinch Hopper, 1 Parasite Paracide, 1 Leghul ⚠, 1 Prevent Rat ⚠,
1 Flying Kamakiri #1 ⚠ *(search Wind Insect)*, 1 Skull-Mark Ladybug ⚠, 1 Man-Eating Insect ⚠,
1 Petit Moth (2nd) → cap at 1
**Spells (12):** 3 Cocoon of Evolution *(anime uses 1; run 1–2)*, 1 Laser Cannon Armor ⚠
*(equip)*, 1 Insect Armor with Laser Cannon ⚠, 1 Polymerization, 1 Monster Reborn, 1 Multiplication
of Ants ⚠, 1 DNA Surgery ⚠ *(make all monsters Insect — feeds Insect Queen/Parasite)*, 1 Mystical
Space Typhoon, 1 Graceful Charity, 1 Pot of Greed
**Traps (10):** 1 Insect Barrier *(opponent's low-ATK monsters can't attack)*, 1 DNA Surgery ⚠,
2 Gokipon ⚠, 1 Waboku, 1 Mirror Force, 1 Trap Hole, 1 Just Desserts, 1 Call of the Haunted,
1 Dust Tornado
**Extra (Fusion, 2):** 1 Great Moth *(Petit Moth + Cocoon of Evolution — anime treats it as an
evolution, not a Poly-Fusion; model per harness)*, 1 Kwagar Hercules ⚠ *(Hercules Beetle +
Kuwagata α)*.
> ⚠ Trim to 40; the moth "evolution line" (Petit Moth → Cocoon of Evolution → Great Moth →
> Perfectly Ultimate Great Moth) is the flavour centrepiece even if slow.

**Manual.**
*Game plan:* **evolve into a giant Moth, then lock the board with Insect Queen / Insect Barrier**.
*Key cards / engine:* **Insect Queen** (2200, **can't be attacked while you control another
Insect**, and it **produces an Insect token each turn** for tribute-fodder and swarm — the modern
engine ace); **Perfectly Ultimate Great Moth** (3500/3000, the anime finisher hatched from
**Petit Moth + Cocoon of Evolution**); **Insect Barrier** shuts off small attackers; **Parasite
Paracide** infests the opponent's deck (a monster becomes an Insect and takes damage). *How to
pilot (the meat):* the classic line is slow — set **Petit Moth** under **Cocoon of Evolution** and
survive with **Insect Barrier / Waboku / Mirror Force** until it hatches into **Great Moth →
Perfectly Ultimate Great Moth** (3500). The *better* modern line is **Insect Queen**: keep one
cheap Insect on board so Queen is unattackable, use its **token every turn** as a tribute engine
and as **Insect Queen fuel** (+200 ATK per token consumed) or as **Pinch Hopper** fodder (Pinch
Hopper dies → Special Summon any Insect, e.g. Insect Queen). **DNA Surgery** turns *everything*
into Insects so **Insect Barrier locks the opponent completely** and Insect Queen's "control an
Insect" is trivially on. *Weaknesses:* the Cocoon line is glacially slow and dies to any
S/T removal on the Cocoon; low-ATK bodies before the payoff; Insect Barrier does nothing vs big
beaters. *Sources:* **[ANIME]**; many small Insects (⚠) are era filler — verify exact DB names.

## B.6 Rex Raptor — Dinosaur
**Monsters (18):** 1 Black Tyranno *(Battle City ace — can attack directly if opponent has only
DEF monsters)*, 2 Two-Headed King Rex, 1 Serpent Night Dragon ⚠ *(a Dragon he ran, not a Dino)*,
1 Sword Arm of Dragon, 2 Megazowler ⚠, 2 Crawling Dragon ⚠, 1 Crawling Dragon #2 ⚠, 2 Trakadon ⚠,
1 Uraby, 1 Mad Sword Beast ⚠, 1 Kabazauls ⚠, 1 Sangan, 1 Hyozanryu ⚠
**Spells (12):** 1 Jurassic World *(Field, +300 to Dinosaurs)*, 1 Big Evolution Pill ⚠
*(Battle City — tribute a Dino to summon high-level Dinos free)*, 1 Polymerization, 1 Monster
Reborn, 1 Premature Burial, 1 Dark Hole, 1 Mystical Space Typhoon, 1 Fissure, 1 Graceful Charity,
1 Pot of Greed, 1 Tribute to the Doomed ⚠, 1 Stop Defense
**Traps (10):** 1 Survival Instinct ⚠, 1 Mirror Force, 1 Waboku, 1 Trap Hole, 1 Just Desserts,
1 Call of the Haunted, 1 Dust Tornado, 1 Torrential Tribute, 1 Reinforcements, 1 Fake Trap ⚠
**Extra:** none required (unless the harness models a Dino Fusion).

**Manual.**
*Game plan:* **straightforward Dinosaur beatdown** — big, cheap bodies pumped by **Jurassic
World**, cheated out with **Big Evolution Pill**, closing with **Black Tyranno**. *Key cards /
engine:* **Two-Headed King Rex** (1600, Rex's DK signature) and **Megazowler** (1800) as the
early beaters; **Jurassic World** makes every Dino +300 (King Rex → 1900); **Big Evolution Pill**
(tribute 1 Dino, then Normal-Summon high-level Dinos with **no tribute for 3 turns**) ramps you
into **Black Tyranno** (2600) fast; **Black Tyranno can attack directly if the opponent controls
only face-up DEF monsters** — a hard punish for turtling. *How to pilot (the meat):* curve out —
King Rex / Megazowler under **Jurassic World**, clear blockers with **Fissure / Dark Hole / Stop
Defense**, then land **Black Tyranno** (via Pill or tribute) and swing for the throat, using
**Stop Defense** to flip their wall to ATK so Tyranno's direct-attack clause turns on. **Sangan**
finds a beater; **Premature / Call of the Haunted / Monster Reborn** recur Tyranno. It's a race
deck: **apply pressure every turn, use removal to keep the lane open**. *Weaknesses:* almost no
tricks — a bigger wall or **Mirror Force** blanks the alpha strike; heavy reliance on Jurassic
World for the ATK math; low-ATK vanillas if you don't draw the field spell. *Sources:*
**[ANIME]**; several Dino names (⚠) are era filler and Rex also ran a couple of Dragons
(`Serpent Night Dragon`, `Sword Arm of Dragon`) — verify exact DB spellings before JSON.

## B.7 Mako Tsunami — Water / Umi (kept Mako-flavoured; overlaps the Water deck in `goat-decks.md`)
*(The generic **Umi / Tornado-Wall / Legendary Fisherman** control deck is analysed in
`docs/goat-decks.md`; this is the **Mako-flavoured** version — same ocean core, his signature
big fish on top.)*

**Monsters (18):** 2 The Legendary Fisherman *(ace — unaffected by Spells & can't be attacked
while `Umi`/`A Legendary Ocean` is up)*, 1 Fortress Whale, 1 Kairyu-Shin ⚠, 2 7 Colored Fish,
2 Great White ⚠, 1 Giant Red Seasnake ⚠, 1 Amphibian Beast ⚠, 1 Mother Grizzly *(recruit a Water
monster on death)*, 1 Nightmare Penguin ⚠, 1 Abyss Soldier ⚠, 1 Jellyfish ⚠, 1 Flying Fish ⚠,
1 Sangan, 1 Space Mambo ⚠
**Spells (12):** 2 A Legendary Ocean *(counts as `Umi`; +200 Water, ‑1 Level)*, 1 Umi,
1 Fortress Whale's Oath ⚠ *(Ritual for Fortress Whale)*, 1 Monster Reborn, 1 Premature Burial,
1 Dark Hole, 1 Mystical Space Typhoon, 1 Salvage ⚠ *(era-check — return 2 Water from GY)*,
1 Graceful Charity, 1 Pot of Greed, 1 Big Wave Small Wave ⚠
**Traps (10):** 2 Tornado Wall *(requires `Umi` — negates all battle damage to you; the control
lock)*, 1 Gravity Bind ⚠, 1 Mirror Force, 1 Waboku, 1 Torrential Tribute, 1 Call of the Haunted,
1 Dust Tornado, 1 Xing Zhen Hu ⚠
**Extra:** none (Fortress Whale is a Ritual, foldered in Main via its Ritual Spell).

**Manual.**
*Game plan:* **ocean control** — establish `Umi`/`A Legendary Ocean`, become nearly
untouchable behind **Tornado Wall + The Legendary Fisherman**, and grind out with pumped fish.
*Key cards / engine (shared with the GD Water deck):* **A Legendary Ocean** is `Umi` **and** a
stat engine (+200 ATK/DEF to all Water, and **‑1 Level** so 7 Colored Fish etc. summon more
easily and Fortress Whale gets cheaper); **Tornado Wall** (needs Umi) **negates all battle damage
you would take** — with it up you simply cannot lose to attacks; **The Legendary Fisherman** is
**immune to Spells and can't be targeted/attacked while Umi is up**, so it attacks freely behind
the wall — the classic lock. *How to pilot (the meat):* resolve **A Legendary Ocean** turn 1, set
**Tornado Wall**; now their attacks deal you **zero damage** while your **Legendary Fisherman**
(1850, effectively unblockable under Umi) and **7 Colored Fish** (1800 → 2000) chip them down.
**Fortress Whale** (2350, or 2550 under Ocean) is the Mako-flavour top-end finisher via
**Fortress Whale's Oath**; **Mother Grizzly** chains into more Water bodies on death. Keep
**MST/Dust Tornado** to protect **Umi** (lose Umi and both Tornado Wall and Fisherman's immunity
switch off — that's the deck's single point of failure). *Weaknesses:* **entirely dependent on
keeping a face-up Umi** — Heavy Storm / MST on the field spell collapses the lock instantly; slow
clock; folds to a monster that ignores battle (burn, mill). *Sources:* **[ANIME]**, **[GD]** for
the shared Umi/Tornado-Wall/Fisherman analysis. Many fish (⚠) are filler — verify DB names.

## B.8 Espa Roba — Jinzo / Machine ("Psycho Deck")
*(Yugipedia calls it a **"Psycho Deck"**: powerful Effect Monsters + control S/T. Modern
mapping is Machine, headlined by **Jinzo**; "Psychic" as a Type didn't exist in the era, so this
is Machine-flavoured, not the later Psychic archetype.)*

**Monsters (17):** 2 Jinzo *(ace — negates all Traps)*, 1 Jinzo #7 ⚠ *(direct-attacker version)*,
2 Reflect Bounder *(1700; on your turn, before it attacks, inflicts damage equal to opponent's
face-up monster ATK)*, 1 Cyber Raider ⚠, 1 Satellite Cannon ⚠ *(gains 1000 ATK each turn, can't
attack until 3000 — anime finisher)*, 1 Copycat ⚠, 1 Fairy of the Fountain ⚠, 1 Mechanical
Chaser ⚠, 1 Blast Sphere ⚠, 1 Cyber-Tech Alligator ⚠, 1 Ground Attacker Bugroth ⚠, 1 Sangan,
1 Mystic Tomato ⚠ *(fetch DARK beaters)*, 1 Machine King ⚠
**Spells (13):** 2 Amplifier *(equip — Jinzo's own Traps still work / boosts Jinzo flavour),
1 Limiter Removal *(double Machine ATK for one turn — burst finisher)*, 1 Monster Reborn,
1 Premature Burial, 1 Dark Hole, 1 Mystical Space Typhoon, 1 Fissure, 1 Graceful Charity,
1 Pot of Greed, 1 7 Completed ⚠ *(+700 to a Machine)*, 1 Machine Duplication ⚠, 1 Stop Defense
**Traps (10):** 1 Mirror Force, 1 Waboku, 1 Trap Hole, 1 Call of the Haunted, 1 Just Desserts,
1 Torrential Tribute, 1 Dust Tornado, 1 Michizure ⚠, 1 Ring of Destruction, 1 Reinforcements
> ⚠ **Big caveat:** Espa's exact anime list is the **least documented** here. **Jinzo, Reflect
> Bounder, and Amplifier are confirmed** (Yugipedia); the rest are era-appropriate Machine
> guesses — verify heavily before JSON.

**Manual.**
*Game plan:* **Trap-negating Machine control + burn** — resolve **Jinzo** to shut off the
opponent's whole Trap game, then beat down / burn with **Reflect Bounder**. *Key cards / engine:*
**Jinzo** (2400) **negates and prevents all Trap Cards** — a wall *and* a lock that neuters
Mirror Force, Waboku, Bottomless, etc., so your beaters connect freely; **Amplifier** is Jinzo's
partner (in the modern DB, Amplifier is the equip that lets **the equipped player's** Traps work
while Jinzo is up — so *you* keep your traps and *they* don't); **Reflect Bounder** is a burn
engine — before it attacks it **deals damage equal to the opponent's monster's ATK**, then also
battles; **Limiter Removal** doubles your Machines' ATK for a lethal alpha strike (or **Satellite
Cannon** as the slow 3000+ finisher). *How to pilot (the meat):* stabilize behind a Machine wall,
land **Jinzo** to turn off their traps, then **Reflect Bounder** pings them for their own
monsters' ATK each turn while Jinzo swings for 2400; when you have a board, **Limiter Removal**
for the kill (accepting the end-of-turn self-destruct since the game should be over). **Amplifier**
means you keep **Mirror Force / Torrential** live under your own Jinzo — a real asymmetry.
*Weaknesses:* Jinzo also **turns off your own traps** unless Amplifier is equipped; **Limiter
Removal** blows up your board if it doesn't kill; the list is the most speculative here.
*Sources:* **[ANIME]** (Jinzo/Reflect Bounder/Amplifier confirmed via Yugipedia; remainder ⚠).

## B.9 Bonz — Zombie
**Monsters (18):** 2 Pumpking the King of Ghosts *(pumps all Zombies +100 each turn; anime ace)*,
2 Dragon Zombie, 2 Clown Zombie, 2 Armored Zombie, 1 Zanki ⚠, 1 Ryu Kokki ⚠, 1 Master of
Nightmare ⚠, 1 Double Coston ⚠ *(counts as 2 tributes for a DARK)*, 1 Spirit Reaper ⚠,
1 Getsu Fuhma ⚠, 1 Pyramid Turtle ⚠ *(search a Zombie on death — the engine)*, 1 Regenerating
Mummy ⚠, 1 Sangan, 1 The Snake Hair ⚠
**Spells (12):** 1 Call of the Mummy *(Special Summon a Zombie from hand while you control no
monsters — Bonz's signature swarm enabler)*, 1 Polymerization, 1 Book of Life ⚠ *(revive a
Zombie + banish from opponent's GY)*, 1 Monster Reborn, 1 Premature Burial, 1 Dark Hole,
1 Mystical Space Typhoon, 1 Fissure, 1 Graceful Charity, 1 Pot of Greed, 1 Zombie World ⚠
*(all monsters become Zombies — turns off tribute-summon for the opponent)*, 1 Stop Defense
**Traps (10):** 1 Mirror Force, 1 Waboku, 1 Trap Hole, 1 Call of the Haunted, 1 Just Desserts,
1 Torrential Tribute, 1 Dust Tornado, 1 Reinforcements, 1 Michizure ⚠, 1 Fake Trap ⚠
**Extra (Fusion, 1):** 1 Great Mammoth of Goldfine *(Dragon Zombie + Clown Zombie via
`Polymerization` — Bonz's Duelist-Kingdom fusion finisher, 2200)*.

**Manual.**
*Game plan:* **Zombie swarm + recursion** — cheat Zombies into play, pump them with **Pumpking**,
and reuse the graveyard so removal never sticks. *Key cards / engine:* **Call of the Mummy**
Special Summons a Zombie from hand for free (while you have no monsters) — the swarm enabler;
**Pyramid Turtle** searches your next Zombie when it dies, so trades **advance the plan**;
**Pumpking the King of Ghosts** buffs **every Zombie +100 each Standby** (snowballs a wide
board); **Book of Life / Premature / Call of the Haunted / Monster Reborn** recur your best
Zombie repeatedly — the deck's grindy identity; **Great Mammoth of Goldfine** is the DK-flavour
Fusion beater. *How to pilot (the meat):* open **Call of the Mummy** to flood early, chump/trade
with **Pyramid Turtle** to chain into bigger Zombies, keep **Pumpking** alive so the whole board
grows past their beaters, and abuse **the graveyard as a second hand** — every Zombie you lose
comes back via Book of Life/Premature. **Zombie World** is a soft-lock (opponent can't Tribute
Summon non-Zombies and your revival stays online). Close by ganging up a pumped board or reviving
**Great Mammoth of Goldfine**. *Weaknesses:* individually small bodies early; leans on Pumpking
(remove it and the board deflates); **DARK/GY-hate** or banish effects hurt the recursion.
*Sources:* **[ANIME]** — Bonz's DK deck (Armored/Dragon/Clown Zombie, Great Mammoth of Goldfine,
Pumpking, Call of the Mummy) is well-attested; the modern engine cards (Pyramid Turtle, Book of
Life, Zombie World) are era-legal upgrades I added for playability (⚠).

## B.10 Yugi Muto — Dark Magician-centric (with Egyptian-God note)
*(Yugi's "signature" build beyond SDY. Two flavours: the **Dark Magician spellcaster** core, and
the **Egyptian God** finish. Gods handled per harness policy.)*

**Monsters (18):** 2 Dark Magician *(ace)*, 1 Dark Magician Girl *(+300 ATK per Dark
Magician/Magician of Black Chaos in any GY)*, 1 Buster Blader *(+500 ATK per Dragon the opponent
controls/GY — Yugi's anti-Kaiba tech)*, 1 Magician of Black Chaos ⚠ *(Ritual)*, 1 Gaia The Fierce
Knight, 1 Summoned Skull, 1 Curse of Dragon, 1 Beta The Magnet Warrior, 1 Alpha The Magnet
Warrior, 1 Gamma The Magnet Warrior, 1 Valkyrion the Magna Warrior ⚠ *(the three Magnets fuse/
tribute into it)*, 1 Big Shield Gardna, 1 Kuriboh, 1 Watapon ⚠, 1 Magician of Faith, 1 Green
Gadget→no; 1 Obnoxious Celtic Guardian ⚠, 1 Queen's Knight ⚠
**Spells (13):** 1 Dark Magic Attack *(destroy all opponent S/T; needs Dark Magician)*, 1 Thousand
Knives *(with Dark Magician: destroy a monster)*, 1 Magical Hats ⚠, 1 Multiply *(Kuriboh tokens)*,
1 Polymerization, 1 Monster Reborn, 1 Premature Burial, 1 Dark Hole, 1 Mystical Space Typhoon,
1 Swords of Revealing Light, 1 Graceful Charity, 1 Pot of Greed, 1 Chaos Form ⚠ *(Ritual for
Magician of Black Chaos)*
**Traps (9):** 1 Mirror Force, 1 Magic Cylinder *(reflect an attack as burn — Yugi's iconic
trap)*, 1 Waboku, 1 Spellbinding Circle ⚠, 1 Call of the Haunted, 1 Trap Hole, 1 Just Desserts,
1 Dust Tornado, 1 Torrential Tribute
**Extra (Fusion, 2):** 1 Dark Paladin ⚠ *(Dark Magician + Buster Blader — spell-negating fusion)*,
1 Dark Flare Knight ⚠ / 1 Valkyrion note *(Magnet Warriors are a Ritual/fusion-style tribute — model
per harness; Valkyrion is summoned by tributing the 3 Magnets, not a Poly-Fusion)*.
> ⚠ **God note:** Yugi's true finisher is **Slifer the Sky Dragon** (ATK = 1000 × cards in hand).
> If the harness includes Gods, add **1 Slifer the Sky Dragon** as the Level-10 top-end (tribute
> 3 — the Magnet Warriors or Dark Magician feed it). If not, the Dark Magician package stands on
> its own.

**Manual.**
*Game plan:* **spellcaster control + burst finishers** — protect and equip **Dark Magician**,
control the board with its support spells, and finish with **Dark Paladin / Magician of Black
Chaos** or (God-on) **Slifer**. *Key cards / engine:* **Dark Magician** (2500) is the hub — it
enables **Dark Magic Attack** (**destroys all opponent Spells/Traps**, opening the way for an
alpha strike), **Thousand Knives** (destroy a monster), and fuses with **Buster Blader** into
**Dark Paladin** (2900, **negates Spells** and grows +500 per Dragon); **Dark Magician Girl**
grows off Dark Magicians in the GY; **the three Magnet Warriors** (Alpha/Beta/Gamma) assemble
**Valkyrion** (3500) then can split back apart. *How to pilot (the meat):* stall early with
**Kuriboh + Multiply** (a wall of tokens), **Big Shield Gardna**, **Swords of Revealing Light**,
and **Magical Hats** (hide Dark Magician among decoys); resolve **Dark Magician**, then when they
commit backrow, fire **Dark Magic Attack** to strip it and swing for 2500+; hold **Magic Cylinder**
to punish a big attack for its own ATK as burn (a game-ending blowout vs Blue-Eyes). Against
Dragon decks (Kaiba), **Buster Blader / Dark Paladin** balloon out of control. If Gods are on,
tribute into **Slifer** and win off a full hand. *Weaknesses:* Dark Magician needs its support
in hand to shine (raw 2500 is fair, not oppressive); Ritual/fusion finishers need multiple pieces;
without Magic Cylinder / Dark Magic Attack the deck is just midrange. *Sources:* **[ANIME]**;
Dark Magician support (Dark Magic Attack, Thousand Knives, Dark Paladin, Dark Magician Girl) is
well-attested; ⚠ cards need DB-name verification.

---

# Authoring notes for the deck-JSON pass

- **Category / format:** every deck here → `category: "structure"`, `format: "classic"`.
- **Real products (Part A):** transcribe the **exact list verbatim** (one copy of each card, in
  set order). These are the trustworthy, must-be-accurate lists. **Do not "fix" them** — the
  product ships singletons, so the JSON should too unless the harness explicitly wants a tuned
  40. SDP → pull from `goat-decks.md` §3B, don't duplicate.
- **Reconstructions (Part B):** each list is **~40 as drafted but over-listed with options and
  ⚠ flags** — the JSON pass must **cut to a legal 40 Main / ≤15 Extra**, resolve each ⚠ against
  the harness's actual card pool (`vendor/BabelCDB/cards.cdb`), and **drop any card not present
  verbatim**. Prefer the character's confirmed signature cards over the ⚠ filler.
- **Rename cheat-sheet (anime → DB):** `Ouija Board → Destiny Board`; letters
  `Spirit Message 'I'/'N'/'A'/'L'` (order spells FINAL); `Cyber Harpie → Cyber Harpie Lady`;
  original `Harpie Lady` is split into `Harpie Lady 1/2/3` + generic `Harpie Lady` (pick per
  pool); `Winged Dragon of Ra → The Winged Dragon of Ra`; fusions keep classic names
  `Meteor B. Dragon`, `Great Mammoth of Goldfine`, `Thousand Dragon`, `Flame Swordsman`.
- **God-card policy is a per-deck switch:** Marik (Ra / stolen Slifer), Yugi (Slifer) each have a
  God note — build a **base version without the God** and an optional **God variant**; Slifer is
  **not** Marik's own card.
- **Confidence ranking for accuracy:** Part A (exact, cited) ≫ Part B signatures (well-attested)
  > Part B ⚠ filler (guesses). Espa Roba (B.8) and the small-fish/small-insect/small-dino filler
  are the least certain and should be verified first.

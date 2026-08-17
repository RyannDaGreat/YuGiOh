# Classic Archetype Deck Library (2002–2008 era)

A catalogue of ~10 early-era Yu-Gi-Oh! **archetype** decks for this engine, chosen for
variety of playstyle and casual fun. Each is a legal **40-card** build with exact modern-DB
card names, an Extra Deck where relevant, and a combo-first pilot **manual**. These are meant
to be authored later as deck JSON with `category: "structure"`, `format: "classic"` (the same
flat `main`/`extra`/`side`/`manual` shape used by `duels/goat.json`).

## Sourcing & confidence (read this first)

Card **names and counts** are what the harness validates, so **every card below was checked to
exist verbatim in `vendor/BabelCDB/cards.cdb`** (the same database `duels/*.json` decks resolve
against). Only one candidate — the vanilla Zombie "Getsu Fuma" — was *not* found and was dropped.

Manual **mechanics** are grounded in the **exact printed card text pulled from that same
database** — so combo lines follow from real effects, not memory. Higher-level archetype framing
(playstyle, named combos, weaknesses) is cited to Yugipedia pages fetched this session.

**Source tags used inline:**
- **[CDB]** — exact effect text from `vendor/BabelCDB/cards.cdb`. Authoritative for *how* cards
  interact; quoted where it matters.
- **[YP:*]** — a Yugipedia page fetched via the `https://r.jina.ai/` proxy (Yugipedia blocks
  direct fetch with HTTP 403). Pages used:
  - [YP:Harpie] <https://yugipedia.com/wiki/Harpie>
  - [YP:Gravekeeper] <https://yugipedia.com/wiki/Gravekeeper's>
  - [YP:Toon] <https://yugipedia.com/wiki/Toon>
  - [YP:Gadget] <https://yugipedia.com/wiki/Gadget>
  - [YP:Archfiend] <https://yugipedia.com/wiki/Archfiend>
  - [YP:Exodia] <https://yugipedia.com/wiki/Exodia>
  - [YP:InsectQueen] <https://yugipedia.com/wiki/Card_Tips:Insect_Queen>
  - [YP:PyramidTurtle] <https://yugipedia.com/wiki/Card_Tips:Pyramid_Turtle>
  - [YP:MotherGrizzly] <https://yugipedia.com/wiki/Card_Tips:Mother_Grizzly>
  - [YP:Circle] <https://yugipedia.com/wiki/Card_Tips:Magician's_Circle>

**Honesty caveat.** This session's **WebSearch budget was exhausted (200/200 used)** before I
started, so I could not mine tournament reports or the r/goatformat / Pojo / Reddit primers.
Where a manual asserts a line that follows from **general format knowledge but is not
corroborated by a fetched source**, it is flagged **`⚠ unverified line`** — treat those as
starting points to check, per "confidently-wrong is worse than none." The *format-defining*
lines (Elegant Egotist → Sisters, Necrovalley lock, Pinch Hopper → Insect Queen, DNA Surgery +
Insect Queen, Pyramid Turtle recruit, Magician's Circle, Toon World direct attacks, Pandemonium
recruiter, Ultimate Offering + Gadgets, Mother Grizzly toolbox, Exodia draw/stall) are all
corroborated by **[CDB]** card text and, where noted, a **[YP:*]** page.

These are *representative, clean archetype builds*, not copies of one tournament sheet. Life is
**8000 LP**; 40 Main, ≤15 Extra.

## Name-mapping notes (classic → modern DB)

The DB uses modern (post-errata) names and text. Flags that matter for authoring/piloting:
- **"Harpie Lady"** the single classic card is split in modern play into **`Harpie Lady 1`**,
  **`Harpie Lady 2`**, **`Harpie Lady 3`**, and **`Cyber Harpie Lady`** — each printed with
  *"(This card's name is always treated as 'Harpie Lady'.)"* [CDB], so they all satisfy
  `Elegant Egotist`, `Cyber Shield`, `Harpie's Pet Dragon`, etc.
- **`Harpies' Hunting Ground`** — apostrophe **after** the *s* (plural); distinct from the
  singular-possessive `Harpie's Pet Dragon` / `Harpie's Feather Duster`.
- **`Levia-Dragon - Daedalus`** — spaced hyphen (` - `) in the DB name.
- **`La Jinn the Mystical Genie of the Lamp`** — full modern spelling.
- **`Vampire Lord`** carries errata text (mill-on-damage + self-revive) [CDB].
- **`Toon Summoned Skull`** is now *"always treated as an 'Archfiend' card"* [CDB] — relevant if
  you ever mix it with the Archfiend deck's `Pandemonium`.
- **`Necrovalley` interaction:** it *"Negate[s] any card effect that would move a card in the GY
  to a different place"* [CDB] — so **`Call of the Haunted`, `Premature Burial`, and `Book of
  Life` do NOT work under your own Necrovalley.** Gravekeeper's therefore revives with
  **`Rite of Spirit`** / **`Gravekeeper's Chief`**, whose text is explicitly *"unaffected by
  Necrovalley"* [CDB]. (This does not affect the Zombie deck, which runs no Necrovalley.)

---

# 1. Harpie Ladies (WIND Winged-Beast beatdown)

**Monsters (16):** 3x Harpie Lady 1, 1x Harpie Lady 2, 1x Harpie Lady 3, 2x Cyber Harpie Lady,
1x Harpie Lady Sisters, 1x Harpie Queen, 1x Harpie's Pet Dragon, 2x Birdface, 2x Flying Kamakiri #1,
2x Sonic Shooter
**Spells (14):** 3x Harpies' Hunting Ground, 2x Elegant Egotist, 1x Cyber Shield,
1x Triangle Ecstasy Spark, 1x Harpie's Feather Duster, 1x Pot of Greed, 1x Graceful Charity,
1x Heavy Storm, 1x Mystical Space Typhoon, 1x Swords of Revealing Light, 1x Book of Moon
**Traps (10):** 3x Hysteric Party, 1x Icarus Attack, 1x Mirror Force, 1x Torrential Tribute,
1x Call of the Haunted, 1x Bottomless Trap Hole, 1x Sakuretsu Armor, 1x Widespread Ruin
**Extra:** none.

**Manual.**
*Game plan:* swarm cheap WIND fliers, pump them with field/equip boosts, and use every Harpie
summon to blow up the opponent's backrow — "overwhelm through accumulated attack power and
spell/trap destruction" while controlling their S/T [YP:Harpie].
*Key cards / engine:* Harpie Lady 1 (+300 to all WIND) + Harpies' Hunting Ground; Elegant Egotist
→ Harpie Lady Sisters; Hysteric Party mass-revival.
*How to pilot / combo lines:*
- **The core swarm loop is Elegant Egotist.** With *any* "Harpie Lady" already up, Egotist
  *"Special Summon[s] 1 'Harpie Lady' or 'Harpie Lady Sisters' from your hand or Deck"* [CDB].
  Each Harpie that hits the field triggers **`Harpies' Hunting Ground`** — *"If any 'Harpie Lady'
  or 'Harpie Lady Sisters' is Normal or Special Summoned: … target 1 Spell/Trap on the field;
  destroy it"* [CDB] — so every summon is also 1-for-1 backrow removal [YP:Harpie].
- **Stat stacking is real.** `Harpie Lady 1` gives *all WIND +300* [CDB]; `Harpies' Hunting
  Ground` gives *all Winged Beasts +200/200* [CDB]; `Cyber Shield` equips a Harpie for *+500*
  [CDB]. A 1300-base Harpie under HL1 + Hunting Ground + Cyber Shield swings for ~2300.
- **`Harpie's Pet Dragon` scales with the board:** *"Gains 300 ATK/DEF for each 'Harpie Lady' on
  the field"* [CDB] — three Harpies make it a 2000 + 900 = 2900 boss (and Hunting Ground pushes it
  higher). Tribute a spent flier into it as your finisher. ⚠ unverified line (stat math is
  derived from [CDB], but the "tribute a spent flier" sequencing is general play).
- **`Harpie Lady Sisters` + `Triangle Ecstasy Spark`:** Sisters must be Special Summoned by
  Elegant Egotist [CDB]; once it's out, `Triangle Ecstasy Spark` makes *"all 'Harpie Lady
  Sisters' … 2700, your opponent cannot activate any Trap Cards, also negate all your opponent's
  Trap effects on the field"* [CDB] — a 2700 attacker under a one-turn trap-lock to punch through.
- **`Hysteric Party` is the recursion engine:** discard 1 card to *"Special Summon as many copies
  of 'Harpie Lady' as possible from your Graveyard"* [CDB]; every revived Harpie re-triggers
  Hunting Ground for more backrow destruction. Rebuild an entire board after a `Mirror Force`.
- **`Birdface`** *"add 1 'Harpie Lady' from your Deck to your hand"* on battle-death, and
  **`Flying Kamakiri #1`** SS's a *WIND ≤1500 ATK* on death [CDB] — both refuel the swarm when
  chumped. `Harpie Queen` discards to *search `Harpies' Hunting Ground`* [CDB] (your field engine).
- **`Sonic Shooter`** *"if there are no cards in your opponent's Spell & Trap Zone, this card can
  attack directly"* [CDB] — and Hunting Ground clears their S/T for you, so Shooter becomes a
  reliable 1300 direct hit. **`Icarus Attack`** tributes a spent Winged Beast to blow up 2 cards.
*Weaknesses:* individual Harpies have low ATK, so a big single beater walls the swarm
[YP:Harpie]; the deck folds hard to `Torrential Tribute`/`Mirror Force` into an over-committed
board; and negating a name-treatment shuts off Egotist [YP:Harpie].

---

# 2. Gravekeeper's (Necrovalley control)

**Monsters (16):** 3x Gravekeeper's Spy, 2x Gravekeeper's Recruiter, 2x Gravekeeper's Descendant,
2x Gravekeeper's Spear Soldier, 2x Gravekeeper's Assailant, 1x Gravekeeper's Chief,
1x Gravekeeper's Guard, 1x Gravekeeper's Priestess, 1x Gravekeeper's Commandant,
1x Gravekeeper's Headman
**Spells (14):** 3x Necrovalley, 2x Royal Tribute, 2x Rite of Spirit, 1x Gravekeeper's Stele,
1x Nobleman of Crossout, 1x Pot of Greed, 1x Graceful Charity, 1x Heavy Storm,
1x Mystical Space Typhoon, 1x Book of Moon
**Traps (10):** 1x Mirror Force, 1x Torrential Tribute, 2x Sakuretsu Armor, 1x Bottomless Trap Hole,
1x Solemn Judgment, 1x Dust Tornado, 1x Divine Wrath, 1x Widespread Ruin, 1x Trap Hole
**Extra:** none.

**Manual.**
*Game plan:* a **stun/control deck built around the Field Spell `Necrovalley`, a floodgate that
stops both players from moving cards out of either Graveyard** and buffs your team, while your
searchers and spells grind out the win [YP:Gravekeeper].
*Key cards / engine:* Necrovalley (+500/500 to all Gravekeeper's, GY lock); Spy → free body;
Descendant → removal; Recruiter/Commandant/Stele/Rite recursion.
*How to pilot / combo lines:*
- **Open Necrovalley ASAP.** *"All 'Gravekeeper's' monsters gain 500 ATK/DEF. Cards in the GY
  cannot be banished. Negate any card effect that would move a card in the GY to a different
  place …"* [CDB] — this simultaneously turns your 1500-DEF Spy into a 2000-DEF wall and shuts
  off the whole format's GY toolbox (revival, banish-fuel, GY floats). Find it with
  **`Gravekeeper's Commandant`** (discard to *search Necrovalley*) [CDB] or `Gravekeeper's Stele`.
- **`Gravekeeper's Spy` is your best starter:** FLIP → *"Special Summon 1 'Gravekeeper's' monster
  with 1500 or less ATK from your Deck"* [CDB] — pull `Descendant` (removal), another Spy, or
  `Recruiter`. Under Necrovalley the summoned body is +500/500.
- **`Gravekeeper's Descendant` is repeatable removal:** *"Tribute 1 other face-up 'Gravekeeper's'
  monster to target 1 card your opponent controls; destroy it"* [CDB] — feed it the Spy you just
  used, or a Recruiter (which *searches on its way to the GY*, so the tribute isn't a real loss).
- **The recursion web ignores your own floodgate.** `Rite of Spirit` and `Gravekeeper's Chief`
  are *explicitly "unaffected by Necrovalley"* [CDB], so **use them, not Call of the Haunted /
  Premature Burial**, to revive tributed Gravekeeper's. `Gravekeeper's Recruiter` *"add 1
  Gravekeeper's with 1500 or less DEF from your Deck to your hand"* when sent to GY [CDB]; `Stele`
  returns *2* Gravekeeper's from GY to hand and is *"cannot be negated by Necrovalley"* [CDB].
- **`Royal Tribute` is the signature disruption:** *"If you control 'Necrovalley': Both players
  discard any monsters in their hands"* [CDB]. You build a monster-light grip (search into spells)
  and strip their whole hand of monsters — devastating vs combo/tribute decks. ⚠ unverified line
  (the "hold few monsters so Royal Tribute is one-sided" plan is general knowledge, not a fetched
  primer).
- **Damage:** `Gravekeeper's Spear Soldier` deals *piercing* [CDB]; `Gravekeeper's Assailant`,
  while Necrovalley is up, *changes an opponent monster's position on attack* [CDB] → force their
  wall to Attack, then run it over. `Gravekeeper's Guard` FLIP bounces a threat to hand [CDB].
- `Gravekeeper's Priestess` *treats the field as Necrovalley while no Field Spell is face-up*
  [CDB] — a backup floodgate if they blow up your real one.
*Weaknesses:* "removing Necrovalley instantly collapses the strategy" and the monster boards are
individually weak [YP:Gravekeeper]; also soft to being out-sized by a bigger single threat before
your grind takes over.

---

# 3. Zombie (Pyramid Turtle / Book of Life / Vampire Lord)

**Monsters (18):** 3x Pyramid Turtle, 2x Vampire Lord, 2x Zombie Master, 2x Goblin Zombie,
1x Ryu Kokki, 1x Despair from the Dark, 1x Il Blud, 1x Mezuki, 1x Double Coston,
1x Patrician of Darkness, 1x Regenerating Mummy, 1x Master Kyonshee, 1x Spirit Reaper
**Spells (12):** 2x Book of Life, 1x Zombie World, 1x Creature Swap, 1x Smashing Ground,
1x Premature Burial, 1x Snatch Steal, 1x Book of Moon, 1x Pot of Greed, 1x Graceful Charity,
1x Heavy Storm, 1x Mystical Space Typhoon
**Traps (10):** 1x Mirror Force, 1x Torrential Tribute, 1x Call of the Haunted, 2x Sakuretsu Armor,
1x Bottomless Trap Hole, 1x Ring of Destruction, 1x Widespread Ruin, 1x Dust Tornado,
1x Solemn Judgment
**Extra:** none.

**Manual.**
*Game plan:* a resilient grave-value beatdown — chump and crash your recruiters into their
monsters to cheat out big Zombies, then loop them back with revival spells.
*Key cards / engine:* Pyramid Turtle toolbox; Book of Life / Mezuki / Call revival; Vampire Lord
self-revive.
*How to pilot / combo lines:*
- **`Pyramid Turtle` is the toolbox.** On battle-destruction it *"Special Summon[s] 1 Zombie with
  2000 or less DEF from your Deck"* [CDB] — it is *"one of the few battle recruiters that can
  Special Summon in Defense Position"* and is **DEF-gated, so you crash it to fetch offensive
  threats** [YP:PyramidTurtle]. Prime targets: **`Ryu Kokki`** (2400 ATK; also *destroys any
  Warrior/Spellcaster it battles at end of Damage Step* [CDB]), **`Vampire Lord`**, **`Il Blud`**,
  or another Pyramid Turtle to chain [YP:PyramidTurtle].
- **`Book of Life` is a two-for-one swing:** *"Target 1 Zombie in your GY and 1 monster in your
  opponent's GY; Special Summon the first, also banish the second"* [CDB] — you revive Ryu
  Kokki/Vampire Lord **and** strip a piece of the opponent's Chaos/graveyard fuel at the same
  time. (`Mezuki` banishes itself from GY to revive any GY Zombie [CDB] as a second engine.)
- **`Vampire Lord` grinds forever:** on damage it *"declare 1 card type; your opponent sends 1 of
  that type from their Deck to the GY,"* and *"once per turn … after this card … was destroyed by
  an opponent's card effect: Special Summon this card from your GY"* [CDB] — it *comes back on its
  own* if they use targeted/effect removal, so force them to answer it with battle.
- **`Creature Swap` + `Pyramid Turtle`:** Swap gives them the Turtle and takes their monster; then
  run your borrowed beater into the Turtle to trigger its recruit — *"give a card to the opponent,
  then destroy it for value"* [YP:PyramidTurtle]. It's also a clean way to hand off a used
  `Goblin Zombie` (which *searches a ≤1200-DEF Zombie when it leaves the field* [CDB]).
- **`Zombie Master`** *"send 1 monster from hand to GY, then Special Summon 1 Level-4-or-lower
  Zombie from either GY"* [CDB] — fuels the GY *and* re-summons a body every turn (revive
  `Pyramid Turtle` to re-arm the recruit, or a `Goblin Zombie`).
- **`Despair from the Dark`** *"if sent from hand or Deck to GY by an opponent's card effect:
  Special Summon this"* [CDB] — a free 2800 beater whenever they mill you (e.g. into their own
  Vampire Lord / a discard). ⚠ unverified line (situational trigger; not from a fetched primer).
- **`Double Coston`** *counts as 2 Tributes for a DARK Tribute Summon* [CDB] — hard-cast Vampire
  Lord off one card. **`Zombie World`** turns everything (incl. GYs) Zombie and locks non-Zombie
  Tribute Summons [CDB]: it powers your `Pyramid Turtle`/`Book of Life` targeting off the
  *opponent's* monsters and taxes their tribute plays. ⚠ unverified line (Zombie World as anti-
  tribute tech is general knowledge).
*Weaknesses:* leans on the GY, so `Necrovalley`/banish effects and D.D. removal hurt; `Ryu Kokki`
does nothing special into non-Warrior/Spellcaster boards; over-extending walks into `Torrential`.

---

# 4. Gadgets / Machine beatdown

**Monsters (17):** 3x Green Gadget, 3x Red Gadget, 3x Yellow Gadget, 1x Cyber Dragon,
1x Ancient Gear Golem, 1x Ancient Gear Beast, 1x Machine King, 2x Roboyarou,
1x Thestalos the Firestorm Monarch, 1x Mobius the Frost Monarch
**Spells (13):** 2x Smashing Ground, 1x Fissure, 1x Limiter Removal, 1x Brain Control,
1x Pot of Greed, 1x Graceful Charity, 1x Heavy Storm, 1x Mystical Space Typhoon,
1x Premature Burial, 1x Snatch Steal, 2x Book of Moon
**Traps (10):** 3x Ultimate Offering, 1x Mirror Force, 1x Torrential Tribute, 1x Call of the Haunted,
1x Bottomless Trap Hole, 2x Sakuretsu Armor, 1x Dust Tornado
**Extra:** none.

**Manual.**
*Game plan:* grind pure card advantage with the self-replacing Gadget trio, run a pile of 1-for-1
removal to clear the way, and close with a Machine haymaker — the classic Gadget philosophy of
"swarming the field … [and] run[ning] lots of one-for-one removal" [YP:Gadget].
*Key cards / engine:* Green→Red→Yellow→Green search loop; Ultimate Offering; Ancient Gear
Golem / Monarch payoffs.
*How to pilot / combo lines:*
- **The Gadgets never cost you a card.** Each, *on Normal or Special Summon*, adds the next in the
  cycle: Green→`Red Gadget`, Red→`Yellow Gadget`, Yellow→`Green Gadget` [CDB]. So every turn you
  Normal-Summon a Gadget you replace it — a 1600 body **and** a fresh card, indefinitely.
- **`Ultimate Offering` doubles your Gadget output.** *"Pay 500 LP; … Normal Summon/Set 1
  monster"* during your Main Phase or the opponent's Battle Phase [CDB]. Pay 500 to Normal-Summon
  a second Gadget → it searches again → +1 card and +1 body per activation. During the opponent's
  attack you can flash in a Gadget (searching) as a surprise blocker. ⚠ unverified line (the
  "Ultimate Offering + Gadget for repeated +1s" package is well known but not from a fetched
  primer this session).
- **Gadgets are Tribute fuel that replace themselves**, so Tribute-Summoning a **Monarch** is
  card-neutral: sac a Gadget (which already drew you its replacement) for **`Mobius the Frost
  Monarch`** (pop 2 backrow) or **`Thestalos the Firestorm Monarch`** (random discard + burn).
  With `Ultimate Offering` you can Normal-Summon a Gadget *and then* Tribute-Summon a Monarch the
  same turn. ⚠ unverified line (general Monarch synergy).
- **`Ancient Gear Golem` is the finisher:** *"If this card attacks, your opponent cannot activate
  any Spell/Trap until end of Damage Step,"* with *piercing* into Defense [CDB] — it swings for
  3000 through set monsters and through their traps. (`Ancient Gear Beast` is the smaller,
  effect-negating version [CDB].) Note both *"Cannot be Special Summoned"* [CDB], so hard-tribute
  them off Gadgets.
- **`Limiter Removal` is the surprise kill:** *"Double the ATK of all Machine monsters you control
  … destroy them in the End Phase"* [CDB] — three 1600 Gadgets become 3200 each for one lethal
  alpha strike (their self-replacement already banked the cards, so the End-Phase blow-up costs
  little). `Machine King` also *gains 100 ATK per Machine on the field* [CDB].
- **Removal suite:** `Smashing Ground`/`Fissure`/`Bottomless`/`Sakuretsu`/`Mirror Force` keep the
  board clear so your fair Machines always trade up. `Cyber Dragon` is a free 2100 body when they
  have a monster and you don't.
*Weaknesses:* Machine-specific hate (`System Down`, mass banish) and anti-search floodgates shut
the engine off [YP:Gadget]; individual Gadgets are small, so a resolved big body stalls you until
you draw a Monarch/Golem.

---

# 5. Insect (Insect Queen / Pinch Hopper / DNA Surgery)

**Monsters (18):** 2x Insect Queen, 3x Pinch Hopper, 3x Gokipon, 2x Howling Insect,
2x Chainsaw Insect, 2x Insect Knight, 1x Doom Dozer, 1x Flying Kamakiri #1,
1x Ultimate Insect LV3, 1x Anteatereatingant
**Spells (12):** 2x Insect Barrier, 2x Insect Imitation, 1x Verdant Sanctuary, 1x Pot of Greed,
1x Graceful Charity, 1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature Burial,
1x Snatch Steal, 1x Book of Moon
**Traps (10):** 2x DNA Surgery, 1x Mirror Force, 1x Torrential Tribute, 1x Call of the Haunted,
1x Bottomless Trap Hole, 2x Sakuretsu Armor, 1x Dust Tornado, 1x Solemn Judgment
**Extra:** none.

**Manual.**
*Game plan:* cheat the boss `Insect Queen` onto the board fast, make it enormous, and lock the
opponent out of attacking while your recruiters keep the swarm topped up.
*Key cards / engine:* Pinch Hopper → Insect Queen; DNA Surgery (type-flip) → Queen ATK + Insect
Barrier lock + Doom Dozer fuel.
*How to pilot / combo lines:*
- **`Pinch Hopper` cheats out the Queen.** *"When this card you control is sent to your GY:
  Special Summon 1 Insect monster from your hand"* [CDB] — chump `Pinch Hopper` (or feed it to a
  trap), then drop **`Insect Queen`** from hand, skipping the two-tribute cost. Yugipedia lists
  this exact line: *"You can also Special Summon this card with 'Pinch Hopper'"* [YP:InsectQueen].
- **`DNA Surgery` is the payoff multiplier.** Declare *Insect*, and *"all face-up monsters on the
  field become that Type"* [CDB]. Now:
  1. **`Insect Queen` balloons** — it *"Gains 200 ATK for each Insect monster on the field"* [CDB]
     — every monster on **both** sides now counts, so a full board can push Queen past 3000+.
  2. **`Insect Barrier` becomes a hard lock** — *"Insect monsters your opponent controls cannot
     declare an attack"* [CDB]; with DNA Surgery active, *all* their monsters are Insects, so
     **they cannot attack at all.** Yugipedia flags the *DNA Surgery / Parasite Paracide* type-
     conversion as the enabler for exactly this [YP:InsectQueen].
- **Feed the Queen its attack tax for free.** Insect Queen *"cannot declare an attack unless you
  Tribute 1 monster"* [CDB], and it makes its own fodder: *"during the End Phase, if this card
  destroyed a monster by battle: Special Summon 1 'Insect Monster Token'"* [CDB]. Yugipedia's tips
  confirm using **token generators as tribute fodder** so the Queen's tax is painless
  [YP:InsectQueen]. Tribute a Token each turn and the swarm never shrinks.
- **`Doom Dozer` off the recruiters:** *"Special Summon by banishing 2 Insect monsters from your
  GY"* for a 2800 trampler that mills on damage [CDB]. Your recruiters stock the GY:
  **`Gokipon`** *searches a ≤1500-ATK Insect on battle-death* [CDB]; **`Howling Insect`** *SS's a
  ≤1500-ATK Insect from Deck on battle-death* [CDB]; **`Flying Kamakiri #1`** (an Insect) SS's a
  WIND ≤1500. So chumping into their attacks *builds* your board and Doom Dozer fuel.
- **`Insect Imitation`** *"Tribute 1 monster; Special Summon 1 Insect from your Deck 1 Level
  higher"* [CDB] — turn a Level-5 into `Insect Queen` (Lv7) directly, or ladder up your recruiters.
  **`Verdant Sanctuary`** replaces any Insect destroyed with a same-Level Insect from Deck [CDB],
  so the deck floods the GY/hand relentlessly.
- **`Chainsaw Insect`** is a 2400 beater whose *"opponent draws 1"* drawback [CDB] barely matters
  in an aggressive shell; use it to trade up early. `Anteatereatingant` / `Insect Knight` are
  clean beaters to fill curve.
*Weaknesses:* `DNA Surgery` is a floodgate you *want* face-up but it can be MST'd off, undoing the
Barrier lock; the deck is monster-heavy so a resolved `Mirror Force`/`Torrential` sets you back;
Insect Queen dies to targeted removal like any single boss.

---

# 6. Toon (Toon World + Toon monsters)

> A **pure Toon build** (Pegasus's deck theme, but constructed as its own archetype, not the
> printed Pegasus Starter — see the GOAT library for that product list).

**Monsters (14):** 1x Toon Dark Magician, 1x Blue-Eyes Toon Dragon, 1x Manga Ryu-Ran,
2x Toon Summoned Skull, 2x Toon Goblin Attack Force, 2x Toon Gemini Elf, 2x Toon Masked Sorcerer,
2x Toon Cannon Soldier, 1x Toon Mermaid
**Spells (18):** 3x Toon World, 3x Toon Table of Contents, 1x Comic Hand, 1x Shadow Toon,
1x Swords of Revealing Light, 1x Smashing Ground, 1x Pot of Greed, 1x Graceful Charity,
1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch Steal, 2x Book of Moon
**Traps (8):** 1x Mirror Force, 1x Torrential Tribute, 1x Call of the Haunted, 2x Sakuretsu Armor,
1x Bottomless Trap Hole, 1x Dust Tornado, 1x Widespread Ruin
**Extra:** none.

**Manual.**
*Game plan:* land `Toon World`, then beat down with Toon monsters that *"make direct attacks"
whenever the opponent controls no Toons* [YP:Toon] — a fast, evasive clock the opponent can't
block by summoning bigger monsters.
*Key cards / engine:* Toon World (the linchpin); Toon Table of Contents (search consistency);
direct-attack Toons; Comic Hand theft.
*How to pilot / combo lines:*
- **Find Toon World first, every game.** `Toon World` *"Activate by paying 1000 LP"* [CDB] is the
  single enabler — every Toon *"If 'Toon World' is destroyed, destroy this card"* [CDB]. **`Toon
  Table of Contents`** *"Add 1 'Toon' card from your Deck to your hand"* [CDB] and can *fetch
  itself or Toon World* — Yugipedia notes it *"can search itself," enabling consistency*
  [YP:Toon]. Run 3 of each so you almost never brick on the linchpin.
- **The direct-attack clock.** With Toon World up and the opponent controlling no Toons, your
  Toons *"can attack your opponent directly"* [CDB]: `Toon Gemini Elf` (1900, also *discards a
  random card from their hand on damage* [CDB]), `Toon Goblin Attack Force` (2300), `Toon Masked
  Sorcerer` (900 but *draws you a card on damage* [CDB]). They swing straight to face — the
  opponent can't chump-block a direct attacker by putting up a wall.
- **Big Toons via Toon World.** `Toon Summoned Skull` (2500) SS by tributing 1; `Blue-Eyes Toon
  Dragon` (3000) / `Manga Ryu-Ran` by tributing 2; `Toon Mermaid` SS's with no tribute — all
  *"while you control 'Toon World'"* and all *pay 500 LP to attack* and *can hit directly* [CDB].
  `Toon Dark Magician` also *discards a Toon to SS a Toon from Deck (ignoring conditions) or search
  a Toon S/T* [CDB] — a strong engine/recovery piece.
- **`Comic Hand` steals a blocker:** *"If you control 'Toon World', equip to an opponent's monster.
  Take control of it. It is treated as a Toon monster … can attack directly"* [CDB] — you remove
  their best defender *and* turn it into another face-hitter. `Shadow Toon` throws burn equal to a
  target's ATK. ⚠ unverified line (Comic Hand as removal-plus-clock is general Toon play).
- **`Toon Cannon Soldier` closes stalled games:** *"Tribute 1 monster; inflict 500 damage"* [CDB]
  — sac spent/summoning-sick Toons for reach when they wall the board. ⚠ unverified line.
- **Protect the linchpin.** Hold `Swords of Revealing Light` / trap suite to survive the turn
  Toon World eats an MST; keep a `Toon Table of Contents` in hand to immediately re-fetch a second
  Toon World.
*Weaknesses:* "dependence on Toon World creates an obvious weak spot that can be targeted"
[YP:Toon] — one `Mystical Space Typhoon` blows up your board (every Toon dies with it); most
Toons also *can't attack the turn summoned* [YP:Toon], giving the opponent a turn to answer.

---

# 7. Archfiend (Fiend beatdown — Pandemonium / Terrorking)

> The era-appropriate Fiend build. (A pure `Dark World` discard deck is thin in the 2005 pool
> without the later `Gates of Dark World`, so this uses the 2003–04 **Archfiend** engine instead.)

**Monsters (18):** 2x Terrorking Archfiend, 1x Skull Archfiend of Lightning, 2x Desrook Archfiend,
1x Shadowknight Archfiend, 1x Infernalqueen Archfiend, 1x Vilepawn Archfiend, 1x Darkbishop Archfiend,
2x Summoned Skull, 2x Archfiend Soldier, 1x Beast of Talwar, 2x La Jinn the Mystical Genie of the Lamp,
2x Mystic Tomato
**Spells (13):** 3x Pandemonium, 2x Falling Down, 1x Archfiend's Oath, 1x Pot of Greed,
1x Graceful Charity, 1x Heavy Storm, 1x Mystical Space Typhoon, 1x Premature Burial, 1x Snatch Steal,
1x Book of Moon
**Traps (9):** 1x Mirror Force, 1x Torrential Tribute, 1x Call of the Haunted, 1x Bottomless Trap Hole,
2x Sakuretsu Armor, 1x Dust Tornado, 1x Solemn Judgment, 1x Widespread Ruin
**Extra:** none.

**Manual.**
*Game plan:* a DARK Fiend midrange deck with a **Pandemonium** engine — big Archfiends with
dice-roll protection, a field spell that both waives their upkeep cost *and* searches on their
destruction, and equip-steal to take the opponent's board.
*Key cards / engine:* Pandemonium (cost-waiver + recruiter); Terrorking + Desrook loop; Falling
Down theft; Mystic Tomato recruiter.
*How to pilot / combo lines:*
- **`Pandemonium` fixes the whole archetype's tax.** Every Archfiend *"must pay LP in your Standby
  Phase or be destroyed"* [CDB]; Pandemonium *"Neither player has to pay LP … for 'Archfiend'
  monsters"* [CDB], so your board stops bleeding life. Its second half is a **free recruiter**:
  *"When an 'Archfiend' is destroyed and sent to the GY, except by battle: add 1 lower-Level
  Archfiend from your Deck to hand"* [CDB] — so when your own Archfiend is popped by removal, you
  replace it for free [YP:Archfiend].
- **`Terrorking Archfiend` is the boss, and it needs a pawn.** *"Cannot be Normal/Flip Summoned
  unless you control an 'Archfiend' monster"* [CDB] — so lead with a small Archfiend
  (`Vilepawn`/`Desrook`, or one fetched by `Mystic Tomato`, which *SS's a DARK ≤1500 ATK on
  battle-death* [CDB]), then Normal-Summon Terrorking. It *negates the effects of monsters it
  destroys by battle* and *rolls a die to negate targeted effects (2 or 5)* [CDB].
- **`Desrook Archfiend` protects the king:** *"When 'Terrorking Archfiend' you control is
  destroyed …: send this from your hand to the GY, then Special Summon that Terrorking from your
  GY"* [CDB] — a hand-trap that brings the boss right back after a `Mirror Force`/battle. Run two
  so Terrorking keeps standing up. ⚠ unverified line (the "hold Desrook to rebuy Terrorking" loop
  follows from [CDB] but isn't from a fetched primer).
- **Dice-roll wall.** `Infernalqueen`/`Vilepawn`/`Darkbishop` each roll to negate targeting
  effects, and `Vilepawn` *stops your opponent's monsters from attacking your other Archfiends*
  [CDB]; `Infernalqueen` *pumps an Archfiend +1000 in the Standby Phase* [CDB]. Yugipedia is blunt
  that the dice protection is *low-reliability (~17–50%)* [YP:Archfiend] — treat it as upside, not
  a plan.
- **`Falling Down` steals their best monster:** *"target an opponent's monster; equip; take control
  of it … Destroy this card unless you control an 'Archfiend'"* [CDB] — since your board is
  Archfiends, the theft sticks; the *"you take 800 each Standby Phase"* clock [CDB] is fine in a
  deck that ends games fast. **`Archfiend's Oath`** *pays 500 to name a card and draw it off the
  top* [CDB] for card selection.
- **Beaters:** `Summoned Skull` (2500), `Beast of Talwar` (2400), `Archfiend Soldier` /
  `La Jinn` (1800/1800) give a clean, consistent DARK curve while the Archfiend engine sets up.
*Weaknesses:* `Skill Drain` / `Shadow-Imprisoning Mirror` turn off the whole engine and the dice
protection [YP:Archfiend]; losing `Pandemonium` re-exposes every Archfiend to its upkeep tax; the
dice negation is unreliable [YP:Archfiend].

---

# 8. Spellcaster (Dark Magician / Magician's Circle)

**Monsters (17):** 3x Dark Magician, 2x Skilled Dark Magician, 1x Dark Magician Girl,
2x Magician's Valkyria, 2x Apprentice Magician, 2x Old Vindictive Magician, 2x Magician of Faith,
1x Breaker the Magical Warrior, 1x Chaos Command Magician, 1x Defender, the Magical Knight
**Spells (13):** 3x Magical Dimension, 1x Sage's Stone, 1x Dark Magic Attack, 1x Thousand Knives,
1x Pot of Greed, 1x Graceful Charity, 1x Heavy Storm, 1x Mystical Space Typhoon,
1x Premature Burial, 1x Snatch Steal, 1x Book of Moon
**Traps (10):** 3x Magician's Circle, 1x Mirror Force, 1x Torrential Tribute, 1x Call of the Haunted,
1x Bottomless Trap Hole, 2x Sakuretsu Armor, 1x Solemn Judgment
**Extra:** none.

**Manual.**
*Game plan:* get `Dark Magician` (2500) onto the board cheaply through a web of Spellcaster
tutors and swing with a protected wizard, using `Magician's Circle` and `Magical Dimension` for
free bodies and removal.
*Key cards / engine:* Skilled Dark Magician / Sage's Stone → Dark Magician; Magician's Circle;
Magical Dimension; Spell-Counter cheaters.
*How to pilot / combo lines:*
- **Three ways to cheat out `Dark Magician`:**
  1. **`Skilled Dark Magician`** banks a Spell Counter per spell resolved, then *"Tribute this
     card with 3 counters; Special Summon 1 'Dark Magician' from hand, Deck, or GY"* [CDB] — this
     deck plays many spells, so it charges fast.
  2. **`Sage's Stone`**: *"If you control a face-up 'Dark Magician Girl': Special Summon 1 'Dark
     Magician' from your hand or Deck"* [CDB] — resolve DMG first, then a free 2500.
  3. **`Magical Dimension`**: *"Tribute 1 monster you control; Special Summon 1 Spellcaster from
     your hand, then you can destroy 1 monster on the field"* [CDB] — tribute a spent
     `Apprentice`/`Magician of Faith` into Dark Magician **and** blow up a threat, all at instant
     speed.
- **`Magician's Circle` is a two-way ambush.** *"When a Spellcaster declares an attack: each
  player Special Summons 1 Spellcaster with 2000 or less ATK from their Deck"* [CDB]. Attack with
  any wizard to pull a free `Chaos Command Magician`/`Valkyria`; Yugipedia notes it works best in
  a *dedicated Spellcaster shell where all your targets qualify* [YP:Circle]. (They also get one —
  chain `Bottomless`/`Sakuretsu` to their summon if it's a real threat [YP:Circle].)
- **`Apprentice Magician` chains bodies:** on summon it *places a Spell Counter* (feeding Skilled
  Dark Magician), and on battle-death it *SS's a Level-2-or-lower Spellcaster from Deck face-down*
  [CDB] — fetch `Old Vindictive Magician`, whose FLIP *destroys an opponent's monster* [CDB], or
  `Magician of Faith` to rebuy a key spell. So one Apprentice loops into removal + value.
- **Protect the ace.** `Magician's Valkyria` *"Monsters your opponent controls cannot target
  face-up Spellcasters for attacks, except this one"* [CDB] — it bodyguards Dark Magician. `Chaos
  Command Magician` *"Negate any monster effects that target this card"* [CDB]. `Book of Moon`
  flips DM face-down to dodge targeted removal.
- **Reach:** `Dark Magic Attack` *"If you control 'Dark Magician': destroy all your opponent's
  Spells/Traps"* clears the way for lethal; `Thousand Knives` with DM up *destroys 1 monster*;
  `Breaker the Magical Warrior` pops a backrow on summon.
*Weaknesses:* somewhat reliant on drawing an enabler for Dark Magician; `Magician's Circle` gives
the opponent a body too [YP:Circle]; wizards outside DM are individually mid-sized, so a resolved
big beater stalls you until you assemble removal.

---

# 9. Water (Mother Grizzly toolbox + A Legendary Ocean)

> Kept distinct from any generic `Umi` deck by leaning on **Mother Grizzly recruiting** and the
> **A Legendary Ocean** level-reduction engine rather than raw Fish beatdown.

**Monsters (17):** 3x Mother Grizzly, 2x Warrior of Atlantis, 2x Amphibious Bugroth MK-3,
2x 7 Colored Fish, 2x Abyss Soldier, 1x Star Boy, 1x Fenrir, 1x Levia-Dragon - Daedalus,
1x The Legendary Fisherman, 1x Nightmare Penguin, 1x Penguin Soldier
**Spells (13):** 3x A Legendary Ocean, 1x Salvage, 1x Big Wave Small Wave, 1x Creature Swap,
1x Pot of Greed, 1x Graceful Charity, 1x Heavy Storm, 1x Mystical Space Typhoon,
1x Premature Burial, 1x Snatch Steal, 1x Book of Moon
**Traps (10):** 2x Tornado Wall, 1x Gravity Bind, 1x Mirror Force, 1x Torrential Tribute,
1x Call of the Haunted, 1x Bottomless Trap Hole, 2x Sakuretsu Armor, 1x Solemn Judgment
**Extra:** none.

**Manual.**
*Game plan:* set up `A Legendary Ocean` (a better "Umi"), which pumps your WATER team, shrinks
your monsters' Levels so they summon a rank cheaper, and turns on a lock package; grind with the
`Mother Grizzly` toolbox and direct attacks.
*Key cards / engine:* A Legendary Ocean (buff + level-reduction + "Umi" for the lock pieces);
Mother Grizzly toolbox; Tornado Wall / Gravity Bind stall; Daedalus nuke.
*How to pilot / combo lines:*
- **`A Legendary Ocean` is the hub.** *"(Always treated as 'Umi'.) All WATER monsters gain
  200 ATK/DEF. Reduce the Level of all WATER monsters in both players' hands and on the field by
  1"* [CDB]. The level cut is the trick: **`Amphibious Bugroth MK-3`** and **`7 Colored Fish`**
  drop a rank (easier tributes / better under level floodgates), and it counts as "Umi" for every
  lock piece below.
- **`Warrior of Atlantis` guarantees the field spell:** *"discard this card; add 1 'A Legendary
  Ocean' from your Deck to your hand"* [CDB] — so you find the hub reliably, then it's WATER fuel
  in the GY for `Fenrir`/`Salvage`.
- **`Mother Grizzly` is the toolbox.** On battle-death it *"Special Summon[s] 1 WATER monster with
  1500 or less ATK from your Deck in Attack Position"* [CDB] — chump it to fetch the right answer:
  `Star Boy` (all WATER +500) [CDB], another Grizzly to chain, or a wall. Yugipedia frames it as
  *"consistent deck thinning [and] toolbox access to niche WATER answers mid-game"* [YP:MotherGrizzly].
- **`Amphibious Bugroth MK-3` is your clock:** *"As long as 'Umi' remains face-up, this card can
  attack directly"* [CDB] — with A Legendary Ocean up it's a 1500 (+200 = 1700) unblockable hit
  every turn. `Star Boy` on the field pushes it and the whole team higher.
- **The stall lock: `Tornado Wall` + `Gravity Bind`.** `Tornado Wall` *"While 'Umi' is on the
  field, you take no battle damage"* [CDB] — with A Legendary Ocean that's total battle-damage
  immunity; add `Gravity Bind` (*Level-4+ can't attack* [CDB]) and you're near-unkillable while
  your low-Level (thanks to the Ocean!) attackers still poke in. ⚠ unverified line (the Tornado
  Wall + Legendary Ocean immunity lock is well known but not from a fetched primer this session).
- **`Levia-Dragon - Daedalus` is the reset:** *"send 1 face-up 'Umi' you control to the GY;
  destroy all other cards on the field"* [CDB] — sac your A Legendary Ocean to nuke the board
  (your WATER-immune Tornado Wall board rebuilds; you keep a Warrior of Atlantis to re-fetch
  Umi). **`Fenrir`** SS by *banishing 2 WATER from GY* and *skips their next Draw Phase on kill*
  [CDB]. `Abyss Soldier` *discards a WATER to bounce any card* [CDB] for tempo.
- `The Legendary Fisherman` while "Umi" is up is *unaffected by Spells and untargetable by
  attacks* [CDB] — a sticky 1850 beater that ignores their spell removal (note it *doesn't stop
  direct attacks* [CDB], so keep another blocker back).
*Weaknesses:* the whole plan sits on A Legendary Ocean, so a well-timed `Heavy Storm`/MST peels
off the buff, the level-reduction, and the Tornado Wall lock at once; several key cards are small
without the field spell.

---

# 10. Exodia (draw / stall)

> **Fringe by design.** This is an alternate-win "assemble the 5 pieces" deck, not a fair
> beatdown — include it for flavor/variety. It wins by *"having all five 'Forbidden One' pieces
> in hand"* [YP:Exodia], surviving behind a wall until the draw engine finds them.

**Monsters (12):** 1x Exodia the Forbidden One, 1x Right Arm of the Forbidden One,
1x Left Arm of the Forbidden One, 1x Right Leg of the Forbidden One, 1x Left Leg of the Forbidden One,
1x Sangan, 1x Witch of the Black Forest, 3x Royal Magical Library, 1x Marshmallon, 1x Spirit Reaper
**Spells (18):** 3x Upstart Goblin, 2x Magical Mallet, 2x Reload, 1x Card Destruction,
1x Gold Sarcophagus, 1x Pot of Greed, 1x Graceful Charity, 1x Emergency Provisions,
1x Swords of Revealing Light, 1x Level Limit - Area B, 1x Messenger of Peace, 1x Heavy Storm,
1x Mystical Space Typhoon, 1x Book of Moon
**Traps (10):** 2x Good Goblin Housekeeping, 2x Jar of Greed, 2x Waboku, 1x Threatening Roar,
1x Legacy of Yata-Garasu, 1x Gravity Bind, 1x Mirror Force
**Extra:** none.

**Manual.**
*Game plan:* the two-part Exodia recipe — **draw** as hard as possible while **stalling** behind
defensive cards until all five pieces are in hand [YP:Exodia].
*Key cards / engine:* Royal Magical Library draw engine; cost-free/refilling draw spells; tutors
(Sangan/Witch) for the last pieces; stall walls.
*How to pilot / combo lines:*
- **`Royal Magical Library` is the free-draw engine.** *"Each time a Spell is activated, place 1
  Spell Counter (max 3). Remove 3 counters; draw 1"* [CDB] — this deck fires a wall of spells, so
  the Library turns three of them into an *extra* card each cycle. With two Libraries the deck
  digs alarmingly fast. ⚠ unverified line (Library-as-Exodia-engine is common knowledge, not from
  a fetched primer).
- **Cost-free / refilling draw.** `Pot of Greed` (+1), `Graceful Charity` (+3, discard 2 — never
  pitch a piece), `Upstart Goblin` (*draw 1, opp gains 1000 LP* — thins the deck for free) [CDB],
  `Magical Mallet` (*shuffle hand back, redraw same number* — reshuffle dead cards, and each
  activation also charges the Library) [CDB], `Reload` / `Card Destruction` refresh a bricked
  hand. **Never discard an Exodia piece** to these — pitch stall/duplicate draw spells instead.
- **Tutors for the last mile:** `Sangan` (*search a ≤1500-ATK monster on death* — grabs any piece)
  and `Witch of the Black Forest` (*search a ≤1500-DEF monster on death*) [CDB] find the final
  limb. `Gold Sarcophagus` *banishes a card from Deck face-up and adds it in 2 Standby Phases*
  [CDB] — bank a piece you'll draw into. `Legacy of Yata-Garasu` / `Jar of Greed` / `Good Goblin
  Housekeeping` (*draw = # of copies in GY +1, then bottom 1*) [CDB] are trap-speed draws that
  also feed the Library nothing but do dig on the opponent's turn.
- **The stall wall buys the turns.** `Swords of Revealing Light` (3 turns no attacks),
  `Level Limit - Area B` (*flip all Level-4+ to Defense*), `Messenger of Peace` (*1500+ ATK can't
  attack*), `Gravity Bind` (*Level-4+ can't attack*) [CDB] lock the board; `Marshmallon`
  (indestructible-by-battle) and `Spirit Reaper` are untouchable walls; `Waboku` / `Threatening
  Roar` stop a Battle Phase outright [CDB]. `Emergency Provisions` dumps now-dead stall spells for
  LP if you're racing a burn clock.
- **Sequencing:** stall turn 1, then chain draw spells through a Library to bank +1s; hold tutors
  as your safety net for the fifth piece; win at instant clarity once all five are in hand [CDB].
*Weaknesses:* it does nothing to the opponent's board except stall, so aggressive decks that
punch through the walls (or hand disruption / deck-out effects) beat it; a bad draw of all stall
and no engine (or vice-versa) bricks; genuinely **fringe** — include for variety, not for a
consistent win rate.

---

# Authoring notes (for the deck-JSON pass)

- **Shape:** author each as `{ name, category: "structure", format: "classic", main: [[name,n],…],
  extra: [], side: [], manual }` exactly like `duels/goat.json`. All ten have **40 Main** and (as
  built) **no Extra Deck** — none of these builds needs a Fusion/Synchro/Xyz, so `extra: []` is
  correct for every deck. `side: []`.
- **`manual` field:** condense each deck's *Game plan* + top 3–4 *combo lines* into the short
  multi-line string style already used in `duels/goat.json` (game plan first, then "Key combo:"
  lines). Keep the ⚠-flagged lines out of the terse in-JSON manual or mark them.
- **Names are DB-verbatim** (checked against `vendor/BabelCDB/cards.cdb`); watch the exact
  spellings called out in *Name-mapping notes* above (`Harpies' Hunting Ground` vs
  `Harpie's Pet Dragon`; `Levia-Dragon - Daedalus` spaced hyphen; `La Jinn the Mystical Genie of
  the Lamp`; `Defender, the Magical Knight` with the comma).
- **`codes` array:** if the harness wants passcodes like `duels/goat.json`, resolve each name to
  its `id` via `SELECT id FROM texts WHERE name = ?` against the same DB.
- **Spell/Trap split above is cosmetic** (for reading); the JSON `main` list is flat. Types were
  verified against `datas.type` — note the ones that surprise: `Insect Barrier`, `Verdant
  Sanctuary`, `Shadow Toon`, `Falling Down` are **Spells**; `Ultimate Offering`, `DNA Surgery`,
  `Legacy of Yata-Garasu`, `Tornado Wall`, `Gravity Bind`, `Good Goblin Housekeeping` are
  **Traps**.
- **Dropped card:** vanilla Zombie "Getsu Fuma" is **not** in this DB (replaced with
  `Master Kyonshee`). Everything else in all ten lists is confirmed present.

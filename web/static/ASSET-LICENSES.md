# Asset Licenses

Every media file under `web/static/sfx/` and `web/static/img/` is listed here with its
source, author, and license.

**All assets are CC0 (public domain) except the two `classic-*` sleeves, which are CC-BY 3.0 (credit jeffshee — see Sleeves).** No attribution is legally required for the CC0 files
below. The "courtesy credit" lines are what the authors *ask* for but do not mandate;
including them is recommended.

**None of these assets come from Konami or any official Yu-Gi-Oh! product.** The card
back is a generic ornate fantasy design, not Konami's card back.

## Sound effects (`web/static/sfx/`)

All 12 files are copied byte-for-byte from their sources — no re-encoding, no quality
loss. Eleven are **Ogg Vorbis** (`.ogg`); `turn-bell.wav` is 16-bit PCM WAV because that is
the format its CC0 source ships in. Peaks sit near -1 dBFS except `win.ogg` (-7 dBFS peak,
but comparable mean loudness since it is sustained music rather than a transient).

| File | Duration | Source file | Pack | Author | License | Source URL |
|---|---|---|---|---|---|---|
| `attack.ogg` | 0.60 s | `Audio/knifeSlice.ogg` | RPG Audio | Kenney | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `hit.ogg` | 0.49 s | `Audio/impactPlate_heavy_002.ogg` | Impact Sounds | Kenney | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `damage.ogg` | 0.50 s | `Audio/error_006.ogg` | Interface Sounds | Kenney | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `recover.ogg` | 0.29 s | `Audio/confirmation_001.ogg` | Interface Sounds | Kenney | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `summon.ogg` | 0.95 s | `Audio/forceField_004.ogg` | Sci-Fi Sounds | Kenney | CC0 1.0 | https://kenney.nl/assets/sci-fi-sounds |
| `set.ogg` | 0.46 s | `Audio/card-place-2.ogg` | Casino Audio | Kenney | CC0 1.0 | https://kenney.nl/assets/casino-audio |
| `draw.ogg` | 0.60 s | `Audio/card-slide-1.ogg` | Casino Audio | Kenney | CC0 1.0 | https://kenney.nl/assets/casino-audio |
| `activate.ogg` | 0.69 s | `Audio/glass_004.ogg` | Interface Sounds | Kenney | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `flip.ogg` | 0.77 s | `Audio/bookFlip1.ogg` | RPG Audio | Kenney | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `turn.ogg` | 0.02 s | `Audio/tick_002.ogg` | Interface Sounds | Kenney | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `win.ogg` | 3.78 s | `winfretless_0.ogg` | Win Jingle | Fupi | CC0 1.0 | https://opengameart.org/content/win-jingle |
| `turn-bell.wav` | 1.44 s | `bell_ding2.wav` | Bell dings/chimes | PWL | CC0 1.0 | https://opengameart.org/content/bell-dingschimes |

`turn-bell.wav` is not an engine cue — the duel page rings it with `new Audio()` when the
pending decision becomes yours, so a backgrounded tab still gets your attention. Of the four
dings in that pack it is the only one under 1.5 s, and it peaks at full scale.

Courtesy credit (optional, requested by the authors):

> Sound effects by Kenney (https://kenney.nl) — CC0.
> "Win Jingle" by Fupi (https://opengameart.org/content/win-jingle) — CC0.
> "Bell dings/chimes" by PWL (https://opengameart.org/content/bell-dingschimes) — CC0.

## Cue map

`web/src/lib/pretty/sound.js` names its cues after EDOPro's, one per distinct
happening in the animation digest (`src/events.js`). A cue plays
`/sfx/<cue>.(ogg|mp3|wav)` when such a file exists and a WebAudio synth
otherwise, so **the list below is a record of which cues have real audio today,
not a licensing claim** — nothing here was downloaded for the synth-only cues.

| Cue | File | Note |
|---|---|---|
| `summon` | `summon.ogg` | |
| `activate` | `activate.ogg` | |
| `set` | `set.ogg` | |
| `flip` | `flip.ogg` | |
| `attack` | `attack.ogg` | |
| `draw` | `draw.ogg` | |
| `damage` | `damage.ogg` | |
| `hit` | `hit.ogg` | ours (impact before a battle death) |
| `gainlp` | `recover.ogg` | filename kept from the old cue name `recover` |
| `nextturn` | `turn.ogg` | filename kept from the old cue name `turn` |
| `win` | `win.ogg` | |
| `turn-bell` | `turn-bell.wav` | not an engine cue — see above |

Synth fallback, no file yet: `specialsummon`, `tribute`, `poschange`, `chain`,
`resolve`, `reveal`, `equip`, `addcounter`, `removecounter`, `directattack`,
`destroyed`, `banished`, `shuffle`, `coinflip`, `diceroll`, `phase`, `lose`.

Dropping a correctly-named CC0 file into `web/static/sfx/` is all it takes to
promote one of those — add its row to the table above and its provenance to the
sound-effects table when you do.

## Images (`web/static/img/`)

| File | Dimensions | Source file | Pack | Author | License | Source URL |
|---|---|---|---|---|---|---|
| `card-back.png` | 500x667 RGBA (portrait) | `card_back_0.png` | Fantasy Card - Dark Cosmic | Cethiel | CC0 1.0 | https://opengameart.org/content/fantasy-card-dark-cosmic |

Courtesy credit (optional):

> Card back art "Fantasy Card - Dark Cosmic" by Cethiel (https://opengameart.org/users/cethiel) — CC0.

## License texts

- CC0 1.0 Universal (public domain dedication): https://creativecommons.org/publicdomain/zero/1.0/
- Kenney's pack license (verbatim from each pack's `License.txt`): "This content is free
  to use in personal, educational and commercial projects. Support us by crediting Kenney
  or www.kenney.nl (this is not mandatory)."

## Sleeves (`web/static/img/sleeves/`)

Selectable card backs ("sleeves"). Machine-readable copy of this table lives in
`web/static/img/sleeves/manifest.json`. **None of these are Konami / Yu-Gi-Oh! artwork** —
they are generic fantasy and playing-card backs from OpenGameArt.

Six are CC0 (no attribution required); the two `classic-*` backs are **CC-BY 3.0**, so
crediting jeffshee is **mandatory** if they ship.

| File | Dimensions | Source file | Pack | Author | License | Source URL |
|---|---|---|---|---|---|---|
| `dark-cosmic.png` | 500x667 | `Card_Back_1.png` | Fantasy Card - Dark Cosmic | Cethiel | CC0 1.0 | https://opengameart.org/content/fantasy-card-dark-cosmic |
| `blue-crystal.png` | 600x768 | `Card Sprites/Card Back/crystal (1).png` | Mechanized Magic: 2D Vector Cards Pack | Dumivid | CC0 1.0 | https://opengameart.org/content/mechanized-magic-2d-vector-cards-pack |
| `gold-hammer.png` | 600x775 | `Card Sprites/Card Back/contrast emblem (1).png` | Mechanized Magic: 2D Vector Cards Pack | Dumivid | CC0 1.0 | https://opengameart.org/content/mechanized-magic-2d-vector-cards-pack |
| `green-dice.png` | 600x775 | `Card Sprites/Card Back/contrast emblem (2).png` | Mechanized Magic: 2D Vector Cards Pack | Dumivid | CC0 1.0 | https://opengameart.org/content/mechanized-magic-2d-vector-cards-pack |
| `amber-prism.png` | 600x777 | `Card Sprites/Card Back/_experimental (3).png` | Mechanized Magic: 2D Vector Cards Pack | Dumivid | CC0 1.0 | https://opengameart.org/content/mechanized-magic-2d-vector-cards-pack |
| `crimson-circuit.png` | 600x823 | `Card Sprites/Card Back/_experimental (11).png` | Mechanized Magic: 2D Vector Cards Pack | Dumivid | CC0 1.0 | https://opengameart.org/content/mechanized-magic-2d-vector-cards-pack |
| `classic-blue.png` | 686x976 | `card back blue.png` | Colorful Poker Card Back | jeffshee | CC-BY 3.0 | https://opengameart.org/content/colorful-poker-card-back |
| `classic-red.png` | 686x976 | `card back red.png` | Colorful Poker Card Back | jeffshee | CC-BY 3.0 | https://opengameart.org/content/colorful-poker-card-back |

Modifications applied (all lossless-in-spirit, no re-drawing):

- Mechanized Magic backs were cropped to their alpha bounding box (the pack ships each
  card centred on a large transparent canvas) and resampled to 600 px wide.
- All PNGs except `classic-*` were palette-quantised to 256 colours to cut page weight
  (e.g. `blue-crystal.png` 874 KB -> 127 KB). Verified by eye — no visible banding.
- `classic-*` and `dark-cosmic.png` are otherwise unaltered crops of the originals.

Required credit (CC-BY 3.0, **not optional**):

> "Colorful Poker Card Back" by jeffshee (https://opengameart.org/content/colorful-poker-card-back) — CC-BY 3.0.

Courtesy credit (optional, CC0 authors):

> Card backs by Cethiel (https://opengameart.org/users/cethiel) and Dumivid
> (https://opengameart.org/users/dumivid) — CC0.

- CC-BY 3.0 license text: https://creativecommons.org/licenses/by/3.0/

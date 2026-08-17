# Dueling Nexus — visual effects catalogue

What the Dueling Nexus duel client draws, which files it draws it from, and how long each
animation takes. Collected so we can borrow the *feel* of a mature browser YGO client for our
own renderer.

Everything below is quoted from files we actually downloaded. Where something is inferred
rather than read, it says so.

- Assets live in `vendor/nexus/fx/` (gitignored). Re-create with `bin/fetch-nexus-fx.sh`.
- Screenshots: `vendor/nexus/fx/screenshots/`.
- Source bundles kept verbatim at `vendor/nexus/fx/raw/engine.min.js` (430 KB, Closure-compiled)
  and `vendor/nexus/fx/raw/engine.css` (62 KB, unminified).

---

## Contents

1. [Where the client lives](#1-where-the-client-lives)
2. [What was unreachable](#2-what-was-unreachable)
3. [The global speed knob](#3-the-global-speed-knob)
4. [Effect-by-effect catalogue](#4-effect-by-effect-catalogue)
5. [Field layout and geometry](#5-field-layout-and-geometry)
6. [Asset inventory](#6-asset-inventory)
7. [Mapping onto our event kinds](#7-mapping-onto-our-event-kinds)

---

## 1. Where the client lives

Dueling Nexus is two separate apps on one origin:

| | |
|---|---|
| **Site shell** | A Vue SPA at `/` — `/static/js/app.*.js`, `/static/css/app.*.css`. Contains the lobby, deck manager, shop. Contains **no** duel code at all (grep for "Battle Phase", "@keyframes", "PIXI" — zero hits). |
| **Duel client** | A separate jQuery app served at `/game/<REGION>-<ROOMCODE>`, loading **`/script/engine.min.js`** and **`/style/engine.css`**. Both are world-readable without a session — this is where every timing in this document comes from. |

The same engine bundle backs `/game/…` (live duel), `/replay/…` (replay viewer), `/editor/…`
(deck editor) and hand-test mode; the archived per-section paths (`/game/script/engine.min.js`,
`/replay/style/engine.css`, …) are relative resolutions of the same root files and 404 today.

Asset roots:

| Root | Serves |
|---|---|
| `https://duelingnexus.com/assets/images/` | all effect sprites, badges, end-screen art, card backs |
| `https://duelingnexus.com/assets/field/`, `…/field3d/` | zone art (SVG) for 2D and 3D modes |
| `https://duelingnexus.com/assets/sounds/` | all sound effects (`.wav`) |
| `https://duelingnexus.com/assets/background/bg.jpg` | page backdrop |
| `https://ygopro.online/assets/profile/` | playmats, sleeves, borders, avatars (shared YGOPro CDN) |
| `https://ygopro.online/assets/{card-images,holograms}/` | card artwork — **deliberately not fetched** |

From the bundle:

```js
var Engine = {
  CARD_WIDTH: 421, CARD_HEIGHT: 614,
  ASSETS_PATH: "assets/",
  IMAGE_ASSETS_PATH: "https://ygopro.online/assets/profile/",
  animatedPlaymats: [2E4],   // playmat id 20000 is a .webp, everything else .png
  ...
}
```

Card aspect ratio is therefore **421 × 614** (0.6857).

### Directory probing note

`/assets/` has autoindex off, so an existing directory answers **403** and a missing file answers
**404** — a reliable oracle. Probing this way, the only directories under `/assets/` are
`images/`, `sounds/`, `data/`, `field/`, `field3d/`, `background/` and `images/avatars/`. There is
no `videos/`, `effects/`, `animations/` or sprite-atlas directory: **every effect is a single
static PNG/SVG animated by CSS or by a jQuery tween.** No sprite sheets, no `.mp4`/`.webm`, no
JSON atlases, no canvas/PIXI/three.js (the only canvas use is the fireworks library on the
end screen).

---

## 2. What was unreachable

Stated exactly, no guessing:

- **A live duel could not be observed.** `/duel`, `/hostbotgame` and `/handtestmode` all run
  `beforeRouteEnter: k.ensureLogin(a)` and redirect to `/welcome` when logged out. Verified with
  Puppeteer: navigating to `/duel` ends at `https://duelingnexus.com/welcome` —
  `vendor/nexus/fx/screenshots/login-gate-duel-route.png`. Practice/AI duels ("Nyx", the Nexus AI)
  sit behind the same guard.
- **The lobby socket needs an account token.** `wss://duelingnexus.com/lobby/` accepts an
  anonymous connection but sends nothing; the client's first frame is
  `{type:"Authenticate", token: …}`, and the room list only arrives after `{type:"Authenticated"}`.
  Without a live room name, `/game/<room>` falls through to the Vue SPA (whose `path:"*"` route
  redirects to `/welcome`), so the duel page **HTML** could not be retrieved.
- **No account was registered.** Creating one would mean accepting their ToS on the user's behalf,
  so it was not done.
- **Wayback replay is down.** The CDX *index* (`web.archive.org/cdx/search/cdx`) works and was used
  to enumerate URLs — that is how `/script/engine.min.js` was found. The *replay* endpoint
  (`web.archive.org/web/<ts>id_/…`) returned `503 Service Unavailable` on every attempt: plain
  curl, curl with browser headers, all three timestamp modifiers (none / `id_` / `if_`), real
  headless Chrome, and the `WebFetch` tool (which reports it cannot reach the host at all).
  `timetravel.mementoweb.org` did not respond either. Archived duel-page HTML exists
  (e.g. `/game/EU-5HUYI1` @ `20251202020737`, 8143 bytes) and would be worth re-fetching when the
  archive recovers — it is the one missing piece.
- **Consequence:** a handful of images are referenced only by that HTML, never by `engine.min.js`
  or `engine.css` (`grep -c` = 0 in both): `act.svg`, `chain.png`, `target.png`, `counter.png`,
  `counters.png`, `first.png`, `second.png`, `end-screen-*.png`. The files themselves are
  downloaded and their role is confirmed by the CSS class that positions them plus their visual
  content, but the literal `<img src>` binding is **inferred**, and marked *(inferred)* below.
- **Not fetched on purpose:** card artwork, the 22 background-music `.ogg` tracks, and playmats
  25–285 (~250 MB). Names and ranges are recorded in §6 so they can be pulled on demand.

Instead of a live capture, `vendor/nexus/fx/screenshots/effects-reconstruction.png` renders the
real assets with the real keyframes and durations extracted below. It is a **reconstruction**, not
a screenshot of the running client, and is labelled as such.

---

## 3. The global speed knob

Every duration in the client is multiplied by one number:

```js
Game.animationSpeedMultiplier = 1;                              // default
// ...
else if (a === "speed") Game.animationSpeedMultiplier = 1 / (Options.getValue("speed") / 100);
```

The user's *speed* option is a percentage; the multiplier is its reciprocal, so speed 200 → 0.5×
duration. Below, `M` means `Game.animationSpeedMultiplier`, and all quoted milliseconds are the
default `M = 1` values.

Two important consequences for anyone copying this design:

1. **Animations are the message pump.** The client processes one server message at a time —
   `Game.messageQueue` / `Game.parseNextMessage` — and each handler calls `parseNextMessage` from
   its animation's `complete` callback. The animation durations *are* the pacing of the duel.
2. **jQuery `.animate()` easing is `swing`** (sinusoidal ease-in-out) unless stated otherwise.
   Where the code drives a transform through a dummy tween (`$("<div/>").animate({height:1}, {step})`),
   the `swing` curve still applies to the transform.

---

## 4. Effect-by-effect catalogue

### 4.1 Attack — sword sprite flying attacker → defender

**Looks like:** a violet/purple double-edged blade about the height of one zone, spawned on the
attacker's zone and flown to the defender's zone, rotated so the blade points along the flight
path. Direct attacks use the opponent's spell zone 2 as the target point.

**Asset:** `assets/images/attack.png` — 128 × 128 RGBA.

```js
Game.onGameAttack = function (a) {
  Game.playSound("attack");
  let b = $("<img>").attr("src", Engine.getAssetPath("images/attack.png"))
                    .addClass("game-attack-animation");
  // ... d = attacker zone, f = defender zone (or the other player's SPELL_ZONE seq 2 for a direct attack)
  f.append(b); a = b.offset(); b.detach(); d.append(b); d = b.offset();
  var g = a.left - d.left, h = a.top - d.top,
      l = 180 / Math.PI * Math.atan2(h, g) + 90;
  $("<div />").animate({ height: 1 }, {
    duration: 500 * Game.animationSpeedMultiplier,
    step: function (k, p) {
      k = p.pos;
      k = "translate(" + g * k + "px, " + h * k + "px)";
      k += " rotate(" + l + "deg)";
      b.css("transform", k);
    },
    complete: function () { b.remove(); Game.parseNextMessage(); }
  });
  return !0;
};
```

Note the offset trick: the sprite is appended to the *defender's* zone to read its screen position,
detached, then appended to the *attacker's* zone — so the translate vector is measured between real
laid-out DOM nodes rather than computed from zone indices.

```css
.game-attack-animation {
	height: 100%;
	z-index: 50;
	position: absolute;
	left: 0; right: 0;
	margin-left: auto; margin-right: auto;
}
```

**Duration:** 500 ms · **easing:** jQuery `swing` · **rotation:** `atan2(dy, dx)·180/π + 90`
(the `+90` because the sprite art points *up* at rest) · **sound:** `attack.wav`.

### 4.2 Activation / summon cut-in — big card + optional negate stamp

**Looks like:** the activated (or summoned) card's full art fades up dead-centre of the field at
30 vh tall, holds, then fades out. If the chain link is negated, a red double-slash "cancel" stamp
drops in from above onto the card first.

**Assets:** the card image itself, plus `assets/images/negated.png` (128 × 128, red crossed
double-slash) for the stamp.

```js
Game.highlightCard = function (a, b, c) {                 // b = "negated?"
  a %= 1E11;
  Engine.setCardImageElement($("#game-highlight-card-img"), a);
  $("#game-highlight-negated").hide();
  Game.highlightCardShow(() => {
    b ? Game.highlightCardNegate(() => { Game.highlightCardHide(c); })
      : Game.highlightCardHide(c);
  });
};

Game.highlightCardShow = function (a) {
  $("#game-highlight-card").show().css("opacity", 0)
    .animate({ opacity: 1 }, { duration: 150 * Game.animationSpeedMultiplier, complete: a });
};

Game.highlightCardNegate = function (a) {
  $("#game-highlight-negated").show().css("top", "-50%")
    .animate({ top: "50%" }, { duration: 500 * Game.animationSpeedMultiplier, complete: a });
};

Game.highlightCardHide = function (a) {
  $("#game-highlight-card").delay(250 * Game.animationSpeedMultiplier)
    .animate({ opacity: 0 }, { duration: 150 * Game.animationSpeedMultiplier, complete: () => {
      $("#game-highlight-card").hide();
      $("#game-highlight-card-img").attr("src", Engine.getCardPicturePath(0));
      a();
    }});
};
```

```css
#game-highlight-card {
	display: none; overflow: hidden;
	position: fixed; z-index: 250;
	top: 50%; left: 62.5%;
	transform: translateX(-50%) translateY(-50%);
}
#game-highlight-card-img { max-height: 614px; height: 30vh; }
#game-highlight-negated {
	display: none; position: absolute;
	left: 50%; top: 50%;
	transform: translate(-50%, -50%);
	max-width: 90%;
}
```

**Timeline:** fade-in 150 ms → (negate stamp drops `top:-50%` → `50%` over 500 ms) → hold 250 ms →
fade-out 150 ms. So **550 ms** for a plain cut-in, **1050 ms** when negated.
`left: 62.5%` is the centre of the 75 %-wide field column, not of the window.

The *same* function is the summon cut-in. Callers:

| Server message | Sound | Negate stamp |
|---|---|---|
| `onGameSummoning` (normal summon) | `summon` | no |
| `onGameSpSummoning` (special summon) | `summon-special` | no |
| `onGameFlipSummoning` (flip summon) | `summon-flip` | no |
| `onGameChaining` (activation) | `activate` | no |
| `onGameChainNegated` | `negate` | **yes** |

Each is wrapped in `Game.preloadImage(cardCode, …)` so the cut-in never pops in half-loaded.

### 4.3 Chain link badge — spinning ring with the link number

**Looks like:** a cyan ring made of chain links, sitting centred over the card that started the
link, rotating slowly and forever, with the chain-link number in large bold white text in the middle.

**Asset:** `assets/images/chain.png` — 128 × 128, cyan chain ring *(inferred: bound in the duel
page HTML template `#game-chain-container-template`)*.

```js
Game.createChain = function (a, b) {
  if (a) {
    var c = a.triggeringController, d = a.triggeringLocation, e = a.triggeringSequence,
        f = Game.chainContainerTemplate.clone();
    f.find(".game-chain-number").text(b);
    Game.fields[c].getZone(d, e).append(f);
    // ...
  }
};
Game.onGameChained = function (a) { Game.createChain(Game.currentChain, a.chainCount); Game.playSound("chain"); };
```

```css
.game-chain-container {
	z-index: 4;
	position: absolute;
	height: 100%;
	left: 50%; top: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
}
.game-chain-container img {
	height: 100%;
	animation: 3s game-rotate360 infinite linear;
}
.game-chain-container .game-chain-number {
	top: 50%; left: 50%;
	transform: translate(-50%, -50%);
	font-size: clamp(1em, 5vh, 6em);
}
@keyframes game-rotate360 { to { transform: rotate(360deg); } }
```

**Resolution** flashes the badge three times, then fades it away:

```js
Game.onGameChainSolving = function (a) {
  a = (Game.isManual ? Game.chains.length : a.chainCount) - 1;
  if (a >= 0 && a < Game.chains.length) {
    const b = Game.chains[a];
    for (a = 1; a <= 3; a++) {
      b.uiElement.fadeTo(100 * Game.animationSpeedMultiplier, .3);
      b.uiElement.fadeTo(100 * Game.animationSpeedMultiplier, 1);
    }
    b.uiElement.fadeTo(100 * Game.animationSpeedMultiplier, 0, () => { /* ... */ Game.parseNextMessage(); });
    return !0;
  }
};
Game.onGameChainSolved = function (a) {};                 // no visual
Game.onGameChainEnd   = function (a) { Game.clearCurrentChains(); };   // $(".game-chain-container").remove()
```

**Resolution timing:** 3 × (100 ms → 0.3 α, 100 ms → 1.0 α) then 100 ms → 0 α = **700 ms** total.

The card-selection list gets the same badge at half width in its top-right corner
(`.game-selection-chain img { animation: 3s game-rotate360 infinite linear; }`).

### 4.4 Targeting reticle

**Looks like:** four bracket corners framing the card — **cyan** when *you* targeted it,
**red/orange** when your opponent did.

**Assets:** `assets/images/manual-target-player.png` and `manual-target-opponent.png`, both
300 × 412 (card-shaped).

```js
Game.updateTargetReticle = function (a) {
  Game.targetReticles[a] && (Game.targetReticles[a].remove(), Game.targetReticles[a] = null);
  if (Game.manualTargets[a]) {
    const c = Game.manualTargets[a].zoneElement;
    if (c) {
      var b = a === 0 ? "images/manual-target-player.png" : "images/manual-target-opponent.png";
      b = $("<img>").addClass("game-manual-target-icon").attr("src", Engine.getAssetPath(b));
      c.append(b);
      Game.targetReticles[a] = b;
    }
  }
};
```

```css
.game-manual-target-icon {
	z-index: 6;
	position: absolute;
	height: 110%;                      /* deliberately overhangs the zone */
	left: 50%; top: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
}
```

Static — no animation on the field. In the selection list the *chain-target* marker instead
pulses, using `target.png` *(inferred)*:

```css
.game-selection-target { position: absolute; bottom: 15%; right: 0; width: 35%; z-index: 1; }
.game-selection-target img { animation: 2s game-zoom-in-and-out infinite ease; width: 100%; }
@keyframes game-zoom-in-and-out {
	0%   { transform: scale(1, 1); }
	50%  { transform: scale(1.2, 1.2); }
	100% { transform: scale(1, 1); }
}
.game-selection-manual-target { transition: transform .2s ease-in-out; }
.game-selection-card:hover > .game-selection-manual-target { transform: translate(-50%, 0) scale(1.07); }
```

### 4.5 Selectable highlight — pulsing zone glow and card outline

**Looks like:** legal zones breathe a purple inner+outer glow twice a second; the Extra Monster
Zones breathe **blue** instead; selectable cards get a black→white outline that pulses with
brightness.

Pure CSS, no assets. This is the client's "what can I click" language and it is used constantly.

```css
.game-field-zone.game-field-zone-selectable {
	cursor: pointer;
	border-radius: 0.2vw;
	animation-name: game-field-zone-flash;
	animation-duration: 0.5s;
	animation-iteration-count: infinite;
	animation-direction: alternate;
	animation-timing-function: ease-out;
	background-color: transparent;
}
@keyframes game-field-zone-flash {
	0%   { box-shadow: inset 0 0 0.4vw rgb(227, 191, 247, 0),   inset 0 0 0.8vw rgb(133, 24, 195, 0),   0 0 0.4vw rgb(133, 24, 195, 0); }
	100% { box-shadow: inset 0 0 0.4vw rgb(227, 191, 247, 0.7), inset 0 0 0.8vw #8518c3,               0 0 0.4vw #8518c3; }
}

/* Extra Monster Zones use the blue variant */
#game-field-extra-monster1.game-field-zone-selectable,
#game-field-extra-monster2.game-field-zone-selectable {
	animation-name: game-field-zone-flash-extra;   /* same 0.5s infinite alternate ease-out */
}
@keyframes game-field-zone-flash-extra {
	0%   { box-shadow: inset 0 0 0.4vw rgba(187, 225, 250, 0),   inset 0 0 0.8vw rgb(46, 134, 222, 0),   0 0 0.4vw rgb(46, 134, 222, 0); }
	100% { box-shadow: inset 0 0 0.4vw rgba(187, 225, 250, 0.7), inset 0 0 0.8vw #2e86de,               0 0 0.4vw #2e86de; }
}

.game-selectable-card {
	outline: 2px solid black;
	animation-name: game-selectable-border;
	animation-duration: 0.5s;
	animation-iteration-count: infinite;
	animation-direction: alternate;
	animation-timing-function: linear;
	cursor: pointer;
}
@keyframes game-selectable-border {
	from { outline-color: black; filter: brightness(80%);  opacity: 0.8; }
	to   { outline-color: white; filter: brightness(120%); opacity: 1.0; }
}
```

Hover uses the same shapes at 1 s instead of 0.5 s (`game-field-zone-hover`, purple; and
`game-field-zone-linked`, blue `#2e86de`, for the Extra Monster Zones and for zones lit by a Link
arrow).

Two accent colours run through the whole client: **purple `#8518c3`** = "yours / generic", **blue
`#2e86de`** = "link / extra".

### 4.6 LP damage and recovery numbers

**Looks like:** a huge outlined number over the losing/gaining player's half of the field —
**red `#ff5050`** for damage, **green `#30c030`** for recovery — that fades in, holds, fades out.

```js
Game.displayLifeChange = function (a, b, c) {
  b === 0 ? c() : (
    $("#game-life-change-text").text(b),
    b > 0 ? $("#game-life-change-text").removeClass("game-life-change-bad").addClass("game-life-change-good")
          : $("#game-life-change-text").removeClass("game-life-change-good").addClass("game-life-change-bad"),
    $("#game-life-change").css("top", a == 0 ? "70%" : "30%"),   // your side low, theirs high
    $("#game-life-change").css("opacity", 0),
    $("#game-life-change").show(),
    $("#game-life-change")
      .animate({ opacity: 1 }, { duration: 150 * Game.animationSpeedMultiplier })
      .delay(700 * Game.animationSpeedMultiplier)
      .animate({ opacity: 0 }, { duration: 150 * Game.animationSpeedMultiplier,
        complete: function () { $("#game-life-change").hide(); c(); } })
  );
};

Game.onGameDamage  = function (a) { Game.lifePoints[a.player] -= a.amount; Game.updateLifeDisplay();
                                    Game.playSound("life-damage");  /* ... */ Game.displayLifeChange(a.player, -a.amount, Game.parseNextMessage); return !0; };
Game.onGameRecover = function (a) { Game.lifePoints[a.player] += a.amount; Game.updateLifeDisplay();
                                    Game.playSound("life-recover"); /* ... */ Game.displayLifeChange(a.player,  a.amount, Game.parseNextMessage); return !0; };
Game.onGamePayLpCost = function (a) { return Game.onGameDamage(a); };
Game.onGameLpUpdate  = function (a) { const b = a.amount - Game.lifePoints[a.player]; /* ... */
                                      b > 0 ? Game.playSound("life-recover") : Game.playSound("life-damage");
                                      Game.displayLifeChange(a.player, b, Game.parseNextMessage); /* ... */ };
```

```css
#game-life-change {
	position: fixed; z-index: 300;
	left: 50%;
	transform: translateX(-50%) translateY(-50%);
}
#game-life-change-text {
	font-size: 4.5em; font-weight: bold;
	text-shadow: 2px 2px #fafafa;
	white-space: nowrap;
}
.game-life-change-good { color: green; -webkit-text-fill-color: #30c030; -webkit-text-stroke-width: 2px; -webkit-text-stroke-color: black; }
.game-life-change-bad  { color: red;   -webkit-text-fill-color: #ff5050; -webkit-text-stroke-width: 2px; -webkit-text-stroke-color: black; }
```

**Total 1000 ms:** 150 in / 700 hold / 150 out. Vertical placement encodes *who*: `top: 70%` for
you, `top: 30%` for the opponent. The number is always signed (`-1800`, `+1000`) because
`displayLifeChange` is handed a signed delta.

The persistent LP bar is separate and unanimated:

```css
.game-life-bar      { margin-top: 8px; background-color: gray; width: 100%; height: 10px; border: 1px solid black; }
.game-life-bar-part { background-color: #c03030; width: 50%; height: 8px; }
.game-timer-bar-part{ background-color: #4f90d1; width: 50%; height: 8px; }
```

### 4.7 Turn and phase banner — text swiping across the field

**Looks like:** enormous white text with a black stroke that slides in from the left, stops
centred, and slides out to the right. Used for both "Your turn" / "Opponent turn" and for every
phase change.

```js
Game.displayNextTurnText = function (a, b) {
  $("#game-next-turn-text").text(a);
  $("#game-next-turn").css("left", "25%");
  $("#game-next-turn").css("opacity", 0);
  $("#game-next-turn").show();
  $("#game-next-turn")
    .animate({ left: "62.5%", opacity: 1 }, { duration: 150 * Game.animationSpeedMultiplier })
    .delay(300 * Game.animationSpeedMultiplier)
    .animate({ left: "100%", opacity: 0 },  { duration: 150 * Game.animationSpeedMultiplier,
      complete: function () { $("#game-next-turn").hide(); b(); } });
};

Game.onGameNewTurn = function (a) {
  Game.updateCurrentTurn(Game.turn + 1);
  Game.onLogNewTurn(a.player);
  Game.playSound("next-turn");
  Game.displayNextTurnText(a.player == 0 ? "Your turn" : "Opponent turn", Game.parseNextMessage);
  return !0;
};

Game.onGameNewPhase = function (a) {
  if (Game.phase !== a.phase)
    return Game.updateCurrentPhase(a.phase), Game.onLogNewPhase(), Game.playSound("next-phase"),
           (a = I18n.phases[Game.phase]) && Game.displayNextTurnText(a, Game.parseNextMessage), !0;
};
```

```css
#game-next-turn {
	position: fixed; z-index: 300;
	top: 50%;
	transform: translateX(-50%) translateY(-50%);
}
#game-next-turn-text {
	font-size: 5.0em; font-weight: bold;
	text-shadow: 2px 2px #fafafa;
	color: black;
	-webkit-text-fill-color: white;
	-webkit-text-stroke-width: 2px;
	-webkit-text-stroke-color: black;
	white-space: nowrap;
}
```

**Total 600 ms:** 150 in / 300 hold / 150 out. It travels `left: 25% → 62.5% → 100%` — so it
decelerates into the field centre and then continues off the right edge, never reversing.

Phase strings (`I18n.en.phases`, keyed by `GamePhase = {DRAW:1, STANDBY:2, MAIN1:4, BATTLE_START:8,
BATTLE_STEP:16, DAMAGE:32, DAMAGE_CAL:64, BATTLE:128, MAIN2:256, END:512}`):

```js
I18n.en.phases = { DRAW: "Draw Phase", STANDBY: "Standby Phase", MAIN1: "Main Phase 1",
                   BATTLE_START: "Battle Phase", MAIN2: "Main Phase 2", END: "End Phase" };
```

Only six of the ten phase bits have a name; `BATTLE_STEP`, `DAMAGE`, `DAMAGE_CAL` and `BATTLE` are
deliberately silent (`(a = I18n.phases[…]) && …` skips the banner when the lookup is undefined), so
the sub-steps of the battle phase never interrupt the player. **Worth copying.**

### 4.8 Card movement — the workhorse

Every card that moves anywhere uses one function. It tweens position *and* rotation, and if the
card's visible face changes it flips it edge-on at the halfway point.

```js
Game.Card.prototype.prepareMovement = function () {
  this.previousPictureOffset   = this.imgElement.offset();
  this.previousPictureRotation = this.currentPictureRotation;
  this.previousPictureCode     = this.currentPictureCode;
};

Game.Card.prototype.applyMovement = function (a, b, c, d) {      // a=code b=position c=duration d=done
  let e = this.imgElement.offset(),
      f = Game.Card.calculateRotation(this.owner, this.controller, this.location, this.sequence, b),
      g = Game.Card.calculateVisibleCode(this.location, b, a),
      h = f - this.previousPictureRotation,
      l = this.previousPictureCode !== g;              // does the face change?
  // ...
  this.imgElement.css("z-index", 99);
  var p = this;
  $("<div />").animate({ height: 1 }, {
    duration: c,
    step: function (n, t) {
      n = t.pos;
      t  = "translate(" + (p.previousPictureOffset.left - e.left) * (1 - n) + "px, "
                        + (p.previousPictureOffset.top  - e.top)  * (1 - n) + "px)";
      t += " rotate(" + (p.previousPictureRotation + h * n) + "deg)";
      l && (n > .5 && p.setPicture(g), t += " scalex(" + Math.abs(1 - n * 2) + ")");
      p.imgElement.css("transform", t);
    },
    complete: function () { /* restore z-index, updatePosition/Sequence, showHologram, counters */ d(); }
  });
};
```

The card is moved in the DOM *first* and then animated **backwards** from its old screen offset
(`(previous - current) * (1 - n)`), which is the classic FLIP technique. The flip is
`scaleX(|1 - 2n|)` — squash to zero width at n = 0.5, swap the picture, expand again.

Durations by caller:

| Action | Duration |
|---|---|
| draw a card (per card) | **200 ms** |
| move / summon / send to grave / banish (`onGameMove`) | **300 ms** |
| position change, incl. flip (`onGamePosChangeInternal`) | **250 ms** |
| reveal a card then put it back | 200 ms out, **800 ms** hold, 200 ms back |
| reveal deck top | 200 ms out, **600 ms** hold, 200 ms back |
| swap graveyard ↔ deck | **800 ms** |
| staggered multi-card reveal | one card every **1200 ms** |

Rotation is where mirroring happens:

```js
Game.Card.calculateRotation = function (a, b, c, d, e) {   // a=owner b=controller c=location d=sequence e=position
  b = b === 1 ? 180 : 0;
  Game.isManual && c & CardLocation.MONSTER_ZONE && d >= 5 && (b = a === 1 ? 180 : 0);
  c & CardLocation.MONSTER_ZONE && !(c & CardLocation.OVERLAY) && e & CardPosition.DEFENCE && (b -= 90);
  Game.threeDimensional && c & CardLocation.HAND && (b = 0);
  return b;
};
Game.Card.calculateVisibleCode = function (a, b, c) {
  return a & CardLocation.HAND || a & CardLocation.OVERLAY || b & CardPosition.FACEUP ? c : 0;
};
```

**The opponent's board is rotated 180°, not flipped.** Their cards are literally upside-down, which
is what a real tabletop looks like from across the table. Defence position subtracts a further 90°,
so an opponent's defence monster sits at 90° and yours at −90°.

`calculateVisibleCode` returning `0` is what makes a card render as the card back
(`Engine.getCardPicturePathRarity(0)` → `assets/images/cover.png`).

Relevant enums:

```js
CardLocation = { DECK:1, HAND:2, MONSTER_ZONE:4, SPELL_ZONE:8, GRAVEYARD:16, BANISHED:32,
                 EXTRA:64, OVERLAY:128, ON_FIELD:12, FZONE:256, PZONE:512 };
CardPosition = { FACEUP_ATTACK:1, FACEDOWN_ATTACK:2, FACEUP_DEFENCE:4, FACEDOWN_DEFENCE:8,
                 FACEUP:5, FACEDOWN:10, ATTACK:3, DEFENCE:12 };
```

### 4.9 Set — sound only

```js
Game.onGameSet = function (a) { Game.playSound("set"); };
```

No visual and, notably, **no `parseNextMessage`** — the actual face-down placement arrives as a
separate move message and animates through `applyMovement` at 300 ms.

### 4.10 Selection pulse — "this card is doing something"

Used when counters change, and generally to draw the eye to a card without a full cut-in.

```js
Game.Card.prototype.animateSelection = function (a) {
  let b = this.imgElement.css("z-index") || "2";
  this.imgElement.css("z-index", 99)
      .css("animation", "fullScale " + 600 * Game.animationSpeedMultiplier + "ms");
  this.imgElement
    .animate({ opacity: .5 }, { duration: 100 * Game.animationSpeedMultiplier })
    .animate({ opacity: 1  }, { duration: 100 * Game.animationSpeedMultiplier })
    .animate({ opacity: .5 }, { duration: 100 * Game.animationSpeedMultiplier })
    .animate({ opacity: 1  }, { duration: 100 * Game.animationSpeedMultiplier })
    .animate({ opacity: .5 }, { duration: 100 * Game.animationSpeedMultiplier })
    .animate({ opacity: 1  }, { duration: 100 * Game.animationSpeedMultiplier, complete: () => {
      this.imgElement.css("animation", "").css("z-index", b); a && a();
    }});
};
@keyframes fullScale { from { transform: scale(1); } to { transform: scale(2); } }
```

Three 200 ms blinks (**600 ms** total) while the card simultaneously scales 1× → 2× over the same
600 ms, lifted to `z-index: 99`.

### 4.11 Equip icon blink

```js
Game.Card.prototype.blinkEquipIcon = function (a) {
  if (this.zoneElement) {
    var b = $("<img>").addClass("game-equip-icon");
    b.attr("src", Engine.getAssetPath("images/equip.png"));
    this.zoneElement.append(b);
    b.hide().fadeIn(100 * Game.animationSpeedMultiplier)
            .fadeOut(200 * Game.animationSpeedMultiplier)
            .fadeIn(200 * Game.animationSpeedMultiplier)
            .fadeOut(200 * Game.animationSpeedMultiplier)
            .fadeIn(200 * Game.animationSpeedMultiplier)
            .fadeOut(200 * Game.animationSpeedMultiplier, () => { b.remove(); a && a(); });
  }
};
```

**Looks like:** a cyan circle-with-crosshairs badge at 80 % zone height blinking three times over
the equipped card. **1100 ms** total. `Game.onGameEquip` also plays `equip.wav`.

```css
.game-equip-icon {
	z-index: 4; position: absolute; height: 80%;
	left: 50%; top: 50%; transform: translate(-50%, -50%);
	pointer-events: none;
}
```

### 4.12 Negated (persistent) — distinct from the cut-in stamp

A card whose effect is *currently* negated on the field carries a permanent badge, added and
removed by state, not animation:

```js
Game.Card.prototype.updateNegated = function () {
  this.isDisabled && this.location & CardLocation.ON_FIELD
    ? this.negatedElement === null && (
        this.negatedElement = $("<img>").addClass("game-card-negated")
                                        .attr("src", Engine.getAssetPath("images/negated.png")),
        this.zoneElement.append(this.negatedElement))
    : this.negatedElement !== null && (this.negatedElement.remove(), this.negatedElement = null);
};
```

```css
.game-card-negated {
	position: absolute;
	width: 50%; height: 50%;
	left: 0; right: 0; top: 0; bottom: 0; margin: auto;
	z-index: 8;
}
```

Same `negated.png`, but 50 % × 50 % and centred, versus the 90 %-wide cut-in stamp.

### 4.13 Counters

**Looks like:** a small dark hexagon badge in the bottom-right of the zone with the count on it.
`counter.png` for a single counter type, `counters.png` (the one with a `+`) when a card carries
more than one type *(inferred from the class names)*.

```css
.game-single-counter-container {
	z-index: 3; position: absolute;
	height: 30%; right: 5%; bottom: 15%;
	pointer-events: none;
}
.game-single-counter-container img { height: 100%; }
.game-single-counter-container .game-counter-value {
	top: 50%; left: 50%; transform: translate(-50%, -50%);
	font-size: clamp(0.5em, 2vh, 6em);
}
```

Counter changes run `card.animateSelection(() => card.updateCountersIcon())`, play `counter.wav`,
and post a message window (`"Placed 2 × Spell Counter on …"`) for **1500 ms**.

### 4.14 Shuffle

Two different animations.

**Deck / Extra deck** — cards scatter, snap to new order, settle back:

```js
Game.Field.prototype.playShuffleDeckAnimation = function (a, b) {
  for (let c = 0; c < this.cards[a].length; ++c)
    a === CardLocation.EXTRA && this.cards[a][c].position & CardPosition.FACEUP || (
      this.cards[a][c].imgElement[0].style.setProperty("transition", `all ${.3 * Game.animationSpeedMultiplier}s ease-in-out`),
      this.cards[a][c].imgElement.css("left", `${Math.random() * 220 - 110}%`),
      this.cards[a][c].imgElement.css("top",  `${Math.random() *  20 -  10}%`));
  setTimeout(() => {
    /* updateSequence() */ Game.playSound("shuffle");
    setTimeout(() => { /* remove transition, setCode(0), updateCode() */ b(); },
               300 * Game.animationSpeedMultiplier);
  }, 300 * Game.animationSpeedMultiplier);
};
```

Each card flies to a random offset of ±110 % horizontally and ±10 % vertically over 300 ms
`ease-in-out`, the sound fires at the 300 ms mark, and it settles over another 300 ms.
**600 ms** total.

**Hand** — cards squeeze into a stack with negative margins, faces are swapped, then they fan back
out; also 300 ms in / 300 ms out, sound at the midpoint.

**Field location shuffle** fades each card out over 300 ms first (`f.fadeOut(300 * M, …)`).

### 4.15 Draw

```js
Game.onGameDraw = function (a) { Game.preloadImages(a.cards, function () { Game.onGameDrawInternal(a); }); return !0; };
// per card, recursively:
Game.playSound("draw");
f = Game.getCard(b, CardLocation.DECK, -1);
f.prepareMovement();
// ... removeCard from DECK, addCard to HAND ...
f.applyMovement(g, f.position, 200 * Game.animationSpeedMultiplier, function () { d(e + 1); });
```

Cards are drawn **one at a time, sequentially** — each 200 ms move calls the next. Drawing 5 cards
takes 1 s and plays `draw.wav` five times. `draw` is preloaded with a pool of 5 (`loadSound("draw", 5)`)
precisely so five overlapping plays are possible.

### 4.16 Duel end

```js
Game.onGameWin = function (a) {
  var b = "No winner.";
  a.player === 0 ? b = "You win!" : a.player === 1 && (b = "You lose!");
  Game.hasGameEnded = !1;
  Game.displayEndWindow(b, "Reason: " + I18n.victory[a.reason]);
};
// displayEndWindow shows exactly one of:
//   #game-end-victory-picture / #game-end-defeat-picture / #game-end-draw-picture
// then clears chains, target reticles and counter badges.
```

**Assets** *(inferred)*: `end-screen-victory.png` (gold "VICTORY"), `end-screen-defeat.png` (red
"DEFEAT"), `end-screen-draw.png` (magenta "DRAW") — chunky metallic wordmarks.

```css
#game-end-window, #duel-completed-message {
	width: 100%; text-align: center; padding: 10px;
	background: linear-gradient(rgba(18,23,36,0.7) 0%, rgba(1,1,17,0.7) 100%);
	z-index: 500;
}
```

**Fireworks** fire only on a battle-pass *level-up*, not on every win:

```js
$("#fireworks-container").show();
a = document.getElementById("fireworks-container");
Game.fireworks = new Fireworks.default(a);
Game.fireworks.start();
```

```css
#fireworks-container { position: fixed; height: 100%; width: 100%; z-index: 2; pointer-events: none; }
```

The library is `fireworks-js` v2 (`vendor/nexus/fx/raw/fireworks.js`, canvas particles, MIT).

### 4.17 Duel start — rock-paper-scissors and turn choice

Hexagonal badges: `rock.png` / `paper.png` / `scissors.png` (fist / flat hand / V-sign in coloured
hexes), `hidden.png` (plain purple hex) for the opponent's undisclosed pick, then
`first.png` ("GO FIRST", gold) / `second.png` ("GO SECOND", teal) *(both inferred)*.

### 4.18 Message and hint windows

```js
Game.displayMessageWindow = function (a, b, c) {
  $("#game-message-content").html(a);
  $("#game-message-window").stop(!0, !0);
  setTimeout(() => { $("#game-message-window").show("fast").delay(b).hide("fast", c); }, 1);
};
```

jQuery `"fast"` = 200 ms in and out; the hold `b` is 1500 ms for coin tosses, dice rolls and
counter changes.

```css
#game-message-window, #game-hint-window {
	display: none; width: 300px; text-align: center;
	border: 1px solid #d0d0d0; padding: 3px; left: 25%;
}
```

### 4.19 Holograms (3D mode only)

An optional mode renders a floating hologram above each face-up monster, bobbing 9 px:

```css
.game-field-hologram {
	position: relative;
	width: 70%; margin-left: 15%; margin-right: 15%; margin-bottom: 10%;
	z-index: 7;
	animation-name: hologram;
	animation-duration: 3s;
	animation-iteration-count: infinite;
}
@keyframes hologram { 0% { top: -1px; } 50% { top: -10px; } 100% { top: -1px; } }
```

Art comes from `https://ygopro.online/assets/holograms/<cardId>.png` (per-card, ~90 KB each — not
mirrored here). Gated behind both `Game.threeDimensional` and `Game.showHolograms`.

---

## 5. Field layout and geometry

### 5.1 The zone grid

The field is a square-cell grid sized to fit the window; **one cell (`Game.zoneWidth`) is the unit
for everything else.**

```js
// column counts depend on the master rule / format
c = (Game.masterRule === 1 || (Game.masterRule === 2 && Game.format !== 3) || Game.masterRule >= 4) ? 7 : 6;  // rows
a = 9;  e = 5;  f = .556;                                     // default: 9 cols wide, 5-wide middle
Game.masterRule === 2 && Game.format === 3 ? (a = 7, e = 3, f = .429)     // Rush Duel: 7 cols, 3-wide middle
  : Game.masterRule === 3 && (a = 11, e = 7, f = .636);                   // Master Rule 3: 11 cols, 7-wide middle

$(".game-field-zone").css("width", d + "px").css("height", d + "px");     // d = Game.zoneWidth
Game.zoneWidth  = d;
Game.cardHeight = Math.floor(d * .95);
Game.cardWidth  = Game.cardHeight * Engine.CARD_WIDTH / Engine.CARD_HEIGHT;   // * 421/614
$(".game-field-hand").css("width", d * 5 + "px").css("height", d + "px");
```

So: **cells are square**, a card is **95 % of a cell tall** and `0.6857 × that` wide, and the hand
strip is exactly **5 cells wide**. The default layout is **9 columns × 7 rows**, with a 5-column
"middle" region (`#game-field-middle`) holding the two players' main zone rows.

Pendulum zones are half-offset rather than given their own row:

```js
$("#game-field-player-spell7").css("bottom", d / 2 + "px");
$("#game-field-player-spell8").css("bottom", d / 2 + "px");
$("#game-field-opponent-spell7").css("top", d / 2 + "px");
$("#game-field-opponent-spell8").css("top", d / 2 + "px");
```

Zone element ids follow `#game-field-{player|opponent}-{monster1..5|spell1..8|graveyard|deck|extra}`
plus the two shared `#game-field-extra-monster1/2`. The `player` row is at the bottom, `opponent` at
the top; **the mirroring is done by rotating the cards 180°, not by transforming the container** (§4.8).

Overall the field column is 75 % of the window:

```css
#game-column   { float: left; width: 75%; margin-top: 24px; padding-left: 15px; box-sizing: border-box; }
#game-field    { margin: auto; table-layout: fixed; user-select: none; background-color: rgba(0,0,0,0); }
```

which is why the cut-in and the turn banner centre on `left: 62.5%` (= 75 % / 2 + a nudge) rather
than 50 %.

### 5.2 The hand is *not* fanned

There is no arc and no rotation — the hand is a flat row that overlaps itself when it gets long:

```js
Game.Field.prototype.resizeHand = function () {
  var a = 1;
  Game.threeDimensional && this.player === 0 && (a = 1.5);           // your hand is 1.5x in 3D mode
  var b = 5;
  Game.masterRule == 2 && Game.format == 3 && (b = 3);               // Rush Duel: 3 cells
  b = Math.floor(Game.zoneWidth * b * a / (this.cards[CardLocation.HAND].length + 1)) - Game.cardWidth * a - 1;
  if (b > 3) b = 3;                                                  // never more than 3px apart
  for (var c = 0; c < this.cards[CardLocation.HAND].length; ++c)
    this.cards[CardLocation.HAND][c].imgElement
      .css("margin-left", (c == (this.player == 0 ? 0 : this.cards[CardLocation.HAND].length - 1) ? 0 : b) + "px")
      .css("height", Math.floor(Game.cardHeight * a) + "px")
      .css("image-rendering", "-webkit-optimize-contrast");
};
```

`b` is a margin that goes **negative** as the hand grows, so cards slide under each other; it is
clamped to a maximum of 3 px so a small hand never spreads out. The zero-margin card is the
**first** for the player and the **last** for the opponent — i.e. the overlap stacks toward the
centre of the table on both sides. `image-rendering: -webkit-optimize-contrast` is set on every hand
card because they are downscaled a lot.

### 5.3 Zone art

`assets/field/*.svg` (2D) and `assets/field3d/*.svg` (3D). Same names in both directories; the 2D
set is a card-shaped rounded rectangle with a coloured neon border and a soft inner gradient, the 3D
set is a borderless radial glow.

| File | Zone | Look |
|---|---|---|
| `mobsterzone.svg` | monster zone | dark blue, blue border |
| `spelltrapbacknew.svg` | spell/trap zone | dark magenta, pink border |
| `linkzone.svg` | extra monster zone | bright blue radial glow |
| `spellzonenew.svg` | field spell zone | teal, with a compass rose |
| `gy.svg` | graveyard | orange border |
| `banished.svg` | banished | neutral grey |
| `bns.svg` | (deck/extra backing) | white/grey |
| `pend1new.svg`, `pend2new.svg` | pendulum scales, your side | pink / blue diamond |
| `pend1opnew.svg`, `pend2opnew.svg` | pendulum scales, opponent | opponent-tinted variants |
| `MZdisabled.svg`, `STBdisabled.svg` | locked zones | red border with a big red ✕ |

Applied as `background: url(../assets/field/<x>.svg) no-repeat center center`, with

```css
.game-field-zone-2d { background-size: cover !important; }
.game-field-zone-3d { background-size: 100% 100% !important; }
```

The `3d-mode` option picks the directory by name, e.g. in the locked-zone refresh:

```js
Game.refreshDisabledZones = function (a) {
  $(".game-field-zone-disabled").removeClass("game-field-zone-disabled");
  Game.resetCardZones();
  if (a !== null) {
    var b = Game.threeDimensional ? "field3d" : "field";
    for (let e = 0; e < 2; ++e) {
      let f = a[e];
      for (var c = 0; c < 5; ++c) if (f & 1 << c) {          // monster zones: bits 0..4
        var d = $(Game.fields[e].namespace + "monster" + (c + 1));
        d.addClass("game-field-zone-disabled");
        d.css("background", `url(../assets/${b}/MZdisabled.svg) no-repeat center center`);
      }
      for (c = 0; c < 8; ++c) if (f & 256 << c) {            // spell/trap zones: bits 8..15
        d = $(Game.fields[e].namespace + "spell" + (c + 1));
        d.addClass("game-field-zone-disabled");
        d.css("background", `url(../assets/${b}/STBdisabled.svg) no-repeat center center`);
      }
    }
  }
};
```

Locked zones therefore arrive as a per-player bitmask (`1 << n` for monster zone *n*, `256 << n`
for spell/trap zone *n*) and are drawn by swapping the zone's background to the red-✕ art.

### 5.4 Playmat, background, avatars

- Playmat: `#game-playmat-player-image` / `#game-playmat-opponent-image` ←
  `https://ygopro.online/assets/profile/Playmats/<id>.png` (or `.webp` for the animated id 20000),
  or `uploads/playmats/<path>` for custom uploads. Full-art illustrations, ~900 KB each.
- Page backdrop: `html { background: url(../assets/background/bg.jpg) … }` — a dark purple
  low-poly/geometric field, the same art as the marketing site.
- **Card backs are composited from two layers, not one image.** A card with code `0` (face-down /
  unknown) is drawn as the owner's *sleeve* texture behind the owner's *border* frame:

  ```js
  Game.Card.prototype.setPicture = function (a) {
    this.currentPictureCode = a;
    if (a === 0)
      Engine.setCardImageElementToSleeve(this.imgElement,
                                         Game.getSleevePath(this.owner),
                                         Game.getCardBorderPath(this.owner));
    else { /* ... normal card art, with rarity foil ... */ }
  };

  Engine.setCardImageElementToSleeve = function (a, b, c) {
    a.off("error");
    a.one("error", function () { $(this).attr("src", Engine.getCardPicturePath(0)); });
    a.attr("src", c);                                   // c = Borders/<id>.png  (transparent frame)
    a.css("background-image", "url(" + b + ")");        // b = Sleeves/<id>.jpg  (texture behind it)
  };

  getSleevePath: function (a) {
    if (Game.isTag) return Engine.getImageAssetPath("Sleeves/0.jpg");
    a = Game.isSpectator ? a : a == 0 ? Game.position : 1 - Game.position;
    return Game.players[a].customSleevePath
      ? "uploads/sleeves/" + Game.players[a].customSleevePath
      : Engine.getImageAssetPath("Sleeves/" + Game.players[a].sleeve + ".jpg");
  }
  ```

  So one border PNG + one sleeve JPG give every player a distinct card back without shipping a
  full card-back image per combination — worth noting given our own per-player sleeve work.
  Tag duels force sleeve 0 / border 0 for both sides.
- `assets/images/cover.png` (421 × 614, dark purple swirl) is what `Engine.getCardPicturePathRarity(0)`
  returns, and is used as the **fallback** when the composited back fails to load, and to reset
  `#game-highlight-card-img` after a cut-in. `assets/images/unknown.png` is code `-1`, the
  card-art load-failure placeholder.
- Avatars: `Avatars/<id>.jpg`, or `uploads/avatars/<path>`.

---

## 6. Asset inventory

Everything below is present in `vendor/nexus/fx/` after running `bin/fetch-nexus-fx.sh`
(129 files; ~28 MB of assets, of which the 25 default playmats are ~22 MB). Contact sheet:
`vendor/nexus/fx/screenshots/asset-contact-sheet.png`.

### 6.1 Effect sprites — `assets/images/`

| File | px | What it looks like |
|---|---|---|
| `attack.png` | 128×128 | violet double-edged blade, points up at rest |
| `chain.png` | 128×128 | cyan ring of chain links |
| `negated.png` | 128×128 | red crossed double-slash "cancel" |
| `equip.png` | 300×300 | cyan hexagon with crosshairs |
| `target.png` | 64×88 | small cyan dashed corner reticle |
| `manual-target-player.png` | 300×412 | cyan corner brackets, card-shaped |
| `manual-target-opponent.png` | 300×412 | red/orange corner brackets |
| `counter.png` | 200×200 | dark hexagon badge, silver rim |
| `counters.png` | 200×200 | same hexagon with a `+` |
| `act.svg` | vector | glowing blue circular ring/portal — role unconfirmed (see §2) |
| `first.png` / `second.png` | — | "GO FIRST" gold hex / "GO SECOND" teal hex |
| `rock.png` / `paper.png` / `scissors.png` | — | fist / flat hand / V-sign hex badges |
| `hidden.png` | — | plain purple hexagon (opponent's hidden RPS pick) |
| `end-screen-victory/defeat/draw.png` | — | gold / red / magenta metallic wordmarks |
| `cover.png` | 421×614 | default card back, dark purple swirl |
| `unknown.png` | — | placeholder card, load-failure fallback |
| `set-card.png` | — | brown/gold face-down card graphic |
| `normal/effect/spell/trap/ritual/fusion/synchro/xyz/link.png` | — | card-frame colour swatches |
| `beta/errata/legend/ocg/tcg/rush.png`, `banlist-*.png` | — | status and banlist badges |
| `eye/lock/close/select_arrow/logo-*/avatar_upload/sleeve_upload.png` | — | UI chrome |

### 6.2 Zone art — `assets/field/`, `assets/field3d/`

13 SVGs each: `mobsterzone`, `spelltrapbacknew`, `linkzone`, `spellzonenew`, `gy`, `banished`,
`bns`, `pend1new`, `pend2new`, `pend1opnew`, `pend2opnew`, `MZdisabled`, `STBdisabled`. See §5.3.

### 6.3 Sounds — `assets/sounds/`, all `.wav`

Exactly the list from `Engine.Audio.prototype.loadGame` / `.loadRoom`. The trailing integer is the
preloaded pool size (how many copies may overlap), not part of the filename:

```js
Engine.Audio.prototype.loadGame = function () {
  this.loadSound("activate", 2); this.loadSound("attack");        this.loadSound("draw", 5);
  this.loadSound("life-damage", 2); this.loadSound("life-recover", 2); this.loadSound("negate");
  this.loadSound("next-phase"); this.loadSound("next-turn");      this.loadSound("set", 2);
  this.loadSound("shuffle");    this.loadSound("summon");         this.loadSound("summon-flip");
  this.loadSound("summon-special", 2); this.loadSound("equip", 2); this.loadSound("dice-roll");
  this.loadSound("coin-flip");  this.loadSound("counter", 2);     this.loadSound("chain", 2);
};
Engine.Audio.prototype.loadRoom = function () {
  this.loadSound("chat-message", 2); this.loadSound("player-ready", 2);
  this.loadSound("player-enter-lobby", 2); this.loadSound("player-leave-lobby", 2);
};
Engine.Audio.prototype.loadSound = function (a, b) {
  b = b !== void 0 ? b : 1;
  this.sounds[a] = [];
  for (var c = 0; c < b; ++c) this.sounds[a].push(new Audio(Engine.getAssetPath("sounds/" + a + ".wav")));
};
Engine.Audio.prototype.play = function (a, b = 1) {
  if (!(this.volume < .001) && a in this.sounds)
    for (var c = 0; c < this.sounds[a].length; ++c)
      if (this.sounds[a][c].paused) { this.sounds[a][c].volume = this.volume * b; this.sounds[a][c].play(); break; }
};
```

A round-robin pool of `<audio>` elements, playing whichever copy is currently paused. That is the
whole audio engine — no Web Audio, no mixing.

| File | Size | File | Size |
|---|---|---|---|
| `activate.wav` | 492 KB | `next-phase.wav` | 74 KB |
| `attack.wav` | 115 KB | `next-turn.wav` | 94 KB |
| `chain.wav` | 129 KB | `set.wav` | 257 KB |
| `counter.wav` | 99 KB | `shuffle.wav` | 127 KB |
| `draw.wav` | 36 KB | `summon.wav` | 234 KB |
| `equip.wav` | 144 KB | `summon-flip.wav` | 29 KB |
| `life-damage.wav` | 78 KB | `summon-special.wav` | 386 KB |
| `life-recover.wav` | 99 KB | `coin-flip.wav` | 13 KB |
| `negate.wav` | 162 KB | `dice-roll.wav` | 249 KB |
| `chat-message.wav` | 201 KB | `player-ready.wav` | 64 KB |
| `player-enter-lobby.wav` | 64 KB | `player-leave-lobby.wav` | 65 KB |

There is **no** `damage`, `flip`, `destroy`, `banish`, `victory` or `defeat` sound — those events
reuse the sounds above or are silent. (Verified by probing: those filenames 404.)

### 6.4 Profile CDN — `profile/`

- `Playmats/0.png … 285.png` (~900 KB each; id 20000 is a 17 MB animated `.webp`).
  **25 mirrored by default**; `PLAYMAT_COUNT=286 bin/fetch-nexus-fx.sh` gets them all (~250 MB).
- `Sleeves/0.jpg … 295.jpg` — 3 mirrored. 0 is the default purple swirl, 1 gold, 2 orange leather.
- `Borders/0.png … 271.png` — 2 mirrored. Card frame overlays, DNX-branded.
- `Avatars/0.jpg … 332.jpg` — 1 mirrored.

### 6.5 Not mirrored

- **Card artwork** — `https://ygopro.online/assets/card-images/{common,rare,super-rare,ultra-rare,
  secret-rare,prismatic-rare,ultimate-rare,gold-rare,ghost-rare,nexus-rare,shatterfoil-rare,
  starfoil-rare,anniversary-rare,platinum-rare,collectors-rare,grand-master-rare}/<id>.jpg`,
  plus rarity foil overlays at `assets/rarity/<rarity>.webp`. We already have card art.
- **Holograms** — `https://ygopro.online/assets/holograms/<id>.png`.
- **Music** — `assets/musics/<name>.ogg`, 22 tracks, picked at random per duel:
  `adrift, anthem_01, arachnophobia_final, awakening_mastered, born, drop_off, goa_trance_mantra,
  infected_mushroom_vibes, infected_vibes, nervous_tick, no_turning_back, odyssey_1, party_robot,
  rip_it_unmastered, sharkbait_final, summer_dream, techno_fest_feel, this_is_seeb_haus,
  trance_party, turn_and_burn, urban_chaos, wyungamesh`.

---

## 7. Mapping onto our event kinds

Our kinds come from `src/events.js`. `M` = `Game.animationSpeedMultiplier` (1 by default).

| Our kind | Nexus handler | Visual | Sound | Duration |
|---|---|---|---|---|
| `attack` | `onGameAttack` | `attack.png` translated + rotated attacker → defender, `z-index: 50` | `attack.wav` | **500 ms** |
| `battle` | — | no dedicated visual; the battle sub-phases (`BATTLE_STEP`, `DAMAGE`, `DAMAGE_CAL`) deliberately show **no** banner | — | — |
| `damage` | `onGameDamage`, `onGamePayLpCost` | red `-N` at `top: 70%` (you) / `30%` (them) | `life-damage.wav` | **1000 ms** (150/700/150) |
| `recover` | `onGameRecover` | green `+N`, same slot | `life-recover.wav` | **1000 ms** |
| `summon` | `onGameSummoning` / `onGameSpSummoning` | full-card cut-in at 30 vh, centre | `summon.wav` / `summon-special.wav` | **550 ms** cut-in, then a 300 ms move |
| `flip` | `onGameFlipSummoning`; `onGamePosChangeInternal` | cut-in; plus `scaleX(\|1-2n\|)` edge-on flip during the move | `summon-flip.wav` | **550 ms** + **250 ms** |
| `activate` | `onGameChaining` → `highlightCard` | cut-in; then a spinning `chain.png` badge with the link number lands on the card | `activate.wav`, then `chain.wav` on `onGameChained` | **550 ms**; badge persists |
| — (negation) | `onGameChainNegated` | `negated.png` drops from `top:-50%` onto the cut-in | `negate.wav` | **1050 ms** |
| — (chain resolve) | `onGameChainSolving` | badge blinks 3× then fades out | — | **700 ms** |
| `set` | `onGameSet` (+ a following move) | sound only, then a normal 300 ms move to a face-down slot | `set.wav` | **300 ms** |
| `tograve` | `onGameMove` → `applyMovement` | FLIP translate + rotate, face swap at the midpoint | — | **300 ms** |
| `banish` | `onGameMove` | same | — | **300 ms** |
| `draw` | `onGameDraw` | one card at a time, deck → hand | `draw.wav` per card (pool of 5) | **200 ms** each |
| `turn` | `onGameNewTurn` | "Your turn" / "Opponent turn" swipes `25% → 62.5% → 100%` | `next-turn.wav` | **600 ms** (150/300/150) |
| `phase` | `onGameNewPhase` | same banner with the phase name; only 6 of 10 phases are named | `next-phase.wav` | **600 ms** |
| `win` | `onGameWin` → `displayEndWindow` | VICTORY / DEFEAT / DRAW wordmark over a dark gradient panel; clears chains, reticles, counters | — | instant; fireworks only on level-up |
| `equip` | `onGameEquip` → `blinkEquipIcon` | cyan badge blinks 3× over the equipped card | `equip.wav` | **1100 ms** |
| `counter` | `onCounterChanged` | `animateSelection` pulse + hexagon badge + message window | `counter.wav` | **600 ms** pulse, **1500 ms** message |
| `shuffle` | `shuffleDeck` / `shuffleHand` | scatter ±110 % / ±10 %, resettle | `shuffle.wav` at the midpoint | **600 ms** |
| `pos` | `onGamePosChangeInternal` | rotate ∓90° with the edge-on flip | — | **250 ms** |
| `reveal` | `onGameConfirmCards` | card lifts to the top layer, flips face-up, holds, returns | — | 200 / **800** / 200 ms |
| `coin` / `dice` | `onGameTossCoin` / `onGameTossDice` | message window with the results | `coin-flip.wav` / `dice-roll.wav` | **1500 ms** |
| `resolve` / `list` / `slot` / `deck` / `none` | — | no Nexus equivalent (our own bookkeeping kinds) | — | — |

### What is worth stealing

1. **Animation duration = message pacing.** One message at a time, next one starts from the previous
   animation's completion callback. No queue-jumping, no overlap, and the duel reads cleanly.
2. **A single global speed multiplier** on every duration, exposed as a percentage. Cheap to
   implement, and impatient players will use it.
3. **Silent battle sub-phases.** Banner only on `DRAW/STANDBY/MAIN1/BATTLE_START/MAIN2/END`.
4. **Position encodes actor.** LP numbers at 70 % vs 30 % height; reticles cyan vs red; opponent
   cards rotated 180°. No text needed to say whose thing it is.
5. **Two accent colours, used consistently:** purple `#8518c3` generic, blue `#2e86de` link/extra.
6. **Cheap tech throughout.** One PNG per effect, CSS keyframes for anything looping, jQuery tweens
   for anything one-shot, a pool of `<audio>` tags. No sprite sheets, no WebGL, no particle system
   except the one canvas fireworks library on the end screen.
7. **Preload before you animate.** Every cut-in is wrapped in `Game.preloadImage(code, …)`.

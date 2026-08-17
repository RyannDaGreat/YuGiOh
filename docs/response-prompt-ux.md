# Response prompts — how other clients decide when to ask, and what we should do

Research + design memo, 2026-08-16. Subject: the "respond?" prompt our web client raises for
every `MSG_SELECT_CHAIN` (engine message 16). Today it is rendered exactly like a main-phase
action menu — same amber panel, same right column — and every one must be answered, so a duel
is mostly clicking "0". Nothing in this memo changes the engine or the duel-record format;
see §C for the exact split.

## Glossary

- **Timing window** — a point where the core stops and offers both players the chance to start
  a chain (each phase boundary, each summon/set/position change, attack declaration, damage
  step, after every chain link, after a draw/damage/LP gain, …). The core asks *every* window
  where the player has at least one legally activatable card, however irrelevant.
- **`MSG_SELECT_CHAIN`** — the message that carries a timing window to the client. Payload
  (ocgcore `processor.cpp:477-492`): `player, spe_count:u8, forced:u8, hint_timing:u32,
  hint_timing_other:u32, count:u32`, then per option `code, loc_info, description:u64,
  client_mode:u8`. Response is an index, or `-1` ("do not activate anything").
- **`forced`** — at least one *mandatory* effect must be chained. There is no "decline" answer;
  the prompt cannot be suppressed, only auto-answered.
- **`hint_timing` / `hint_timing_other`** — bitmask of what just happened, for the asked player
  and for the opponent (`OcgHintTiming`: DRAW_PHASE, STANDBY_PHASE, MAIN_END, BATTLE_START,
  BATTLE_END, END_PHASE, SUMMON, SPSUMMON, FLIPSUMMON, MSET, SSET, POS_CHANGE, ATTACK,
  DAMAGE_STEP, DAMAGE_CAL, CHAIN_END, DRAW, DAMAGE, RECOVER, DESTROY). We already render these
  as English in `src/menu.js:timingWords`.
- **`spe_count`** — *the single most important field in this memo.* See §A.1: it is the core's
  own count of how many of the offered options are at a timing they actually care about.
  Sentinel `0x7f` means "this is a mandatory-trigger **ordering** prompt", not a response window.
- **Response prompt / response window** — our name for a `MSG_SELECT_CHAIN` (and the trigger
  flavour of `MSG_SELECT_EFFECTYN`) where declining is legal. The noisy case.
- **Action menu** — `MSG_SELECT_IDLECMD` / `MSG_SELECT_BATTLECMD`: you hold initiative and the
  engine wants your move. Never suppressible, and nobody wants it suppressed.
- **Smart mode** — our middle setting. Defined exactly in §B.4.

---

# A. What every other client does

## A.1 ocgcore itself already answers the question (`spe_count`)

This is the finding that makes a good "smart" mode a ten-line predicate instead of a heuristic.
Before the core emits `MSG_SELECT_CHAIN` it counts, into `core.spe_effect[p]`, how many of the
listed options are *relevant at this window*. The source says so in a comment
(ProjectIgnis `ygopro-core/processor.cpp:296`):

```cpp
// core.spe_effect[p]: # of optional trigger effects, activate/quick effect with hints
```

The counting rules (`processor.cpp:359-408` for phase windows, `:1093-1134` for point
windows) are:

- an **optional trigger effect** that actually triggered at this window → always counted;
- an **activate effect** or **quick effect** offered on `EVENT_FREE_CHAIN` (a set Quick-Play,
  a set Trap that is merely *usable*, a Spell you could play in your own Main) → counted **only
  if `check_hint_timing(peffect)`**, i.e. the card script's own declared `hint_timing` mask
  intersects the window's `core.hint_timing`;
- continuous effects (`EFFECT_CLIENT_MODE_RESOLVE`) are never counted.

`check_hint_timing` (`processor.cpp:289-295`), quoted verbatim:

```cpp
int32_t field::check_hint_timing(effect* peffect) {
	int32_t p = peffect->get_handler_player();
	if(p == 0)
		return (peffect->hint_timing[0] & core.hint_timing[0]) || (peffect->hint_timing[1] & core.hint_timing[1]);
	else
		return (peffect->hint_timing[0] & core.hint_timing[1]) || (peffect->hint_timing[1] & core.hint_timing[0]);
}
```

So `spe_count > 0` means, precisely: **"at least one card you could activate here declares this
kind of moment as one it wants to be offered at."** That is the exact predicate the brief asks
"smart" to implement — traps at the opponent's summon/attack/activation, quick-plays broadly,
continuous never — except it is per-card, authored by the card script, and always right.

Two overrides the core applies afterwards (`processor.cpp:1133-1134`) matter a lot:

```cpp
if(core.current_chain.size() || (core.hint_timing[0] & TIMING_ATTACK) || (core.hint_timing[1] & TIMING_ATTACK))
    core.spe_effect[priority] = static_cast<int32_t>(core.select_chains.size());
```

**If a chain is already in progress, or an attack was declared, `spe_count` is forced to the
full option count** — every option becomes "relevant". A smart mode built on `spe_count` therefore
never silently passes on a chain you are already in, and never silently passes an attack
declaration. Those are the two windows where a silent pass loses duels, and the engine already
protects them.

The core also refuses to bother the client at all in two cases (`processor.cpp:420-424`):

```cpp
if(core.select_chains.size() == 0) {            // nothing activatable: answer -1 internally
    returns.set<int32_t>(0, -1); arg.step = 1; return FALSE;
} else if(tf_count == 0 && cn_count == 1 && to_count == 0 && fc_count == 0) {
    returns.set<int32_t>(0, 0); arg.step = 1; return FALSE;   // lone mandatory effect: auto-chain it
}
```

…and it *downgrades* a lone optional trigger to a yes/no question rather than a chain menu
(`processor.cpp:443`):

```cpp
if(tf_count == 0 && to_count == 1 && fc_count == 0 && cn_count == 0) {
    emplace_process<Processors::SelectEffectYesNo>(check_player, 0, core.select_chains.front().triggering_effect->get_handler());
```

Counter names: `tf` = mandatory triggers, `to` = optional triggers, `cn` = mandatory continuous,
`fc` = free-chain (quick-play / set trap / playable spell). Precedent worth copying: **a
one-option response window should be a yes/no card, not a list.**

Immediately before asking, the core emits `MSG_HINT / HINT_EVENT` with the window's description
(`processor.cpp:429-441` writes 20 Draw Phase / 21 Standby Phase / 28 Start Step of Battle Phase
/ 25 End of the Battle Phase / 26 End Phase). That hint is the header string every ygopro-lineage
client shows above the response prompt — we already capture it as `ctx.eventHint`
(`src/menu.js:hintsBefore`).

## A.2 EDOPro (ProjectIgnis) — `gframe/duelclient.cpp`, `case MSG_SELECT_CHAIN` (line 2115)

Three mutually-exclusive push-buttons live on the duel field (created in `game.cpp:857-868`,
made visible at `MSG_NEW_TURN` for players only, hidden by the setting *"Hide Chain buttons"*,
sysstring 1355). English labels from `config/strings.conf`:

| Widget | sysstring | English label | Variable |
|---|---|---|---|
| `btnChainIgnore` | 1292 | **`Chain: OFF`** | `ignore_chain` |
| `btnChainAlways` | 1293 | **`Always pause`** | `always_chain` |
| `btnChainWhenAvail` | 1294 | **`Chain: ON`** | `chain_when_avail` |

They behave as a 4-state radio (none / OFF / Always / ON): `ClientField::UpdateChainButtons`
(`event_handler.cpp:2703-2724`) un-presses every button that is not the caller.

The decision, verbatim (`duelclient.cpp:2183-2199`):

```cpp
const auto ignore_chain = mainGame->btnChainIgnore->isPressed();
const auto always_chain = mainGame->btnChainAlways->isPressed();
const auto chain_when_avail = mainGame->btnChainWhenAvail->isPressed();
if(!select_trigger && !mainGame->dField.chain_forced && (ignore_chain || ((count == 0 || specount == 0) && !always_chain)) && (count == 0 || !chain_when_avail)) {
    SetResponseI(-1);
    mainGame->dField.ClearChainSelect();
    if(mainGame->tabSettings.chkNoChainDelay->isChecked() && !ignore_chain) {
        std::unique_lock<epro::mutex> tmp(mainGame->gMutex);
        mainGame->WaitFrameSignal(20, tmp);
    }
    DuelClient::SendResponse();
    return true;
}
if(mainGame->tabSettings.chkAutoChainOrder->isChecked() && mainGame->dField.chain_forced && !(always_chain || chain_when_avail)) {
    SetResponseI(0);
    mainGame->dField.ClearChainSelect();
    DuelClient::SendResponse();
    return true;
}
```

with `bool select_trigger = (specount == 0x7f);` (line 2133).

Decoded truth table for a non-forced, non-ordering window:

| Button state | Client asks the player when… |
|---|---|
| **none pressed (default)** | `count > 0 && spe_count > 0` — i.e. something is activatable **and** the core says at least one option is at its natural timing |
| **`Chain: OFF`** (`ignore_chain`) | never |
| **`Always pause`** (`always_chain`) | *every* window, including `count == 0` (shows "No card or effect can be activated right now. / Check the field?") |
| **`Chain: ON`** (`chain_when_avail`) | whenever `count > 0`, ignoring `spe_count`; still silent on empty windows |

Two escapes always ask, in every mode: `chain_forced` (a mandatory effect must be chained) and
`select_trigger` (`spe_count == 0x7f`, ordering simultaneous mandatory triggers).

**EDOPro's out-of-the-box default is therefore already "smart"** — it is `spe_count > 0`.

Two related settings (checkboxes, `game.cpp:1549` and `:1589`):

- sysstring **1276 `Automatic Chain Link order`** (`chkAutoChainOrder`) — when the prompt is
  *forced* and no chain button is pressed, answer index 0 without asking. YGOPro's variant picks
  the first entry whose `forced` flag byte is set rather than blindly index 0.
- sysstring **1277 `Add a delay even when no response`** (`chkNoChainDelay`) — insert 20 frames
  (~333 ms) before sending an auto-decline. Purpose is **information hiding**: an instant pass
  tells the opponent you had nothing chainable. Deliberately skipped when `ignore_chain` is on,
  because then every pass is instant and the tell disappears again.

UX when it *does* ask — this is the model to copy:

- Hint line: sysstring **550 `Select the effect you want to activate`** (or **556 `Select the
  effect to apply/resolve`** when a continuous effect is in the list).
- The activatable cards themselves become selectable in place (`is_selectable = true`,
  `cmdFlag |= COMMAND_ACTIVATE`) and their pile buttons light up (`deck_act`, `grave_act`,
  `remove_act`, `extra_act`). Only Xyz-material options force a list panel (`panelmode`).
  **There is no modal list for the normal case** — you click the glowing card, or the "no" button.
- If not forced, a query popup with a two/three-line body (`duelclient.cpp:2215-2225`):

```cpp
if(count == 0)
    stQMessage->setText(format(L"{}\n{}", GetSysString(201), GetSysString(202)));
else if(select_trigger)
    stQMessage->setText(format(L"{}\n{}\n{}", event_string, GetSysString(222), GetSysString(223)));
else
    stQMessage->setText(format(L"{}\n{}", event_string, GetSysString(203)));
```

  - 201 `No card or effect can be activated right now.` / 202 `Check the field?`
  - 203 `Activate a card or effect?`
  - 222 `Activate a Trigger Effect?`

  `event_string` is **the header the brief is asking for**. It is set from `MSG_HINT/HINT_EVENT`
  (`duelclient.cpp:1402`) and otherwise from the most recent presentational message, drawn from
  this vocabulary (`strings.conf`):

  | id | string |
  |---|---|
  | 20/21/22/24/26 | `Draw Phase` / `Standby Phase` / `Main Phase` / `Battle Phase` / `End Phase` |
  | 23/25/28/29 | `Attempting to end the Main Phase` / `End of the Battle Phase` / `Start Step of Battle Phase` / `Attempting to end the Battle Phase` |
  | 1600–1602 | `Activate a card` / `A card(s) was Set` / `A card(s) changed control` |
  | 1603–1608 | `Attempting to Normal Summon "%ls"` / `A monster(s) was Normal Summoned successfully` / …Special Summon… / …Flip Summon… |
  | 1609 | `An effect of "%ls" was activated` |
  | 1611–1616 | `You drew %d card(s)` / `Your opponent drew %d card(s)` / `You took %d damage` / … / `You gained %d LP` / … |
  | 1619–1621 | `"{}" is attacking "{}"` / `"{}" is attacking directly` / `An attack was negated` |

## A.3 YGOPro (Fluorohydride) — same file, line 1776

Structurally identical; the differences are worth knowing because they are the older design:

- `ignore_chain` / `always_chain` / `chain_when_avail` are plain `mainGame->` bools rather than
  button state, and the label semantics are the untranslated Chinese originals: 1292 `忽略时点`
  ("ignore timing"), 1293 `显示时点` ("show timing"), 1294 `可用时点` ("when available"). EDOPro's
  English "Chain: OFF / Always pause / Chain: ON" is a later, clearer relabelling of the same
  three flags.
- The auto-decline delay is **randomised**: `WaitFrameSignal(std::uniform_int_distribution<>(20, 40)(rnd))`
  — 333–667 ms — a stronger version of the same anti-tell measure (`chkWaitChain`, sysstring 1277
  `没有可连锁的卡时延迟回应`, "delay the response when there are no chainable cards").
- `chkAutoChain` (1276 `自动发动并排序必发效果`, "automatically activate and order mandatory
  effects") scans `activatable_descs` for the first entry with the forced flag (`it.second >> 8`)
  instead of answering 0.
- `chain_forced` is derived per option from a `forced` byte in the (older) message layout; EDOPro
  reads a single `chain_forced` field and only ORs per-entry in `compat_mode`.

## A.4 Dueling Nexus — the closest analogue to us, and it agrees with EDOPro

Dueling Nexus runs ocgcore **server-side** and pushes high-level JSON over a WebSocket; the
browser never sees `MSG_*`. `MSG_SELECT_CHAIN` arrives as
`{type:"GameSelectChain", cards:[{code, controller, location, sequence, subSequence, effect, isForced}], specialCount, …}`
and the answer goes back as `{type:"GameSendResponse", response:N}`. **The suppression decision is
made entirely in the browser**, in `Game.onGameSelectChain` — architecturally identical to what
§C proposes for us. Evidence is their shipped, un-mangled duel bundle
`https://duelingnexus.com/script/engine.min.js?v=3508` (the SPA at the root domain is only the
lobby; the duel client is a separate static page at `/duel/<REGION>-<id>`).

The control is **one cycling button**, bottom-right of the duel screen next to `Resolve`:

```html
<button id="game-force-chain-button" class="game-force-chain-button engine-button engine-button-game engine-button-default">Chaining: Auto</button>
```

```js
$("#game-force-chain-button").click(function(){
  Game.chainingMode = (Game.chainingMode + 1) % 4;
  Options.setValue("chaining-mode", Game.chainingMode);
  Game.chainingModeUpdated()
});
const CHAINING_AUTO=0, CHAINING_MANUAL=1, CHAINING_BLUFF=2, CHAINING_OFF=3;
```

| Value | Label | Colour | Asks when… |
|---|---|---|---|
| 0 | **`Chaining: Auto`** (default) | grey | `cards.length > 0 && specialCount > 0`, or something is forced |
| 1 | **`Chaining: Manual`** | green | anything is activatable, ignoring `specialCount` |
| 2 | **`Chaining: Bluff`** | blue | **every** window, including empty ones and lone mandatory effects |
| 3 | **`Chaining: Off`** | red | never, unless something is forced |

De-minified decision (`Game.onGameSelectChain`):

```js
var forced = a.cards.some(e => e.isForced);
if (forced || Game.chainingMode !== CHAINING_OFF) {
  if (Game.chainingMode !== CHAINING_AUTO || forced || (a.cards.length !== 0 && a.specialCount !== 0)) {
    if (forced && a.cards.length === 1 && Game.chainingMode !== CHAINING_BLUFF)
      Game.sendResponse(0);                        // auto-activate the lone mandatory effect
    else { /* …show the Yes/No modal, or go straight to picking when forced… */ }
  } else Game.sendResponse(-1);                    // Auto + nothing relevant -> silent pass
} else Game.sendResponse(-1);                      // Off -> silent pass
```

Four things to take from this:

1. **Their default is the same predicate as EDOPro's default and as our proposed smart mode**
   (`cards > 0 && specialCount > 0`, where `specialCount` is the server's rendering of ocgcore's
   `spe_count`). Three independent clients converged on it. Their own changelog entry
   ("Chaining and Graveyards", 2016-12-12, `api/news.php` id 7) describes it as: *"Auto is the
   default mode where you are asked to chain when a card is activated, Manual will always ask you
   to chain and Off will never ask you chain anything. You can switch between these modes during
   each duel as many times as you wish."*
2. **A four-mode cycle beats a settings page.** One button, in the duel, cycling
   Auto → Manual → Bluff → Off, colour-coded, persisted in `localStorage["engine-storage"]` under
   the key `chaining-mode`. Note `chaining-mode` is the *only* persisted option with no widget in
   their in-duel Options panel — it lives on the field where you need it.
3. **"Bluff" is their answer to the information-leak problem** that EDOPro solves with a random
   stall (§A.2/§A.3): rather than pad the auto-pass, offer a mode that stops at *every* window so
   your response latency carries no information. The modal in that case reads
   *"Nothing can be activated. Check the field?"*. Bluff mode is undocumented — it appears in no
   changelog entry in 131 posts back to 2016, only in the bundle.
4. **Modal first, glow second.** Unlike EDOPro, DN opens a Yes/No window
   (`#game-yesno-window`, buttons literally `Yes` / `No`) whose title is
   `` `Activate a card? ${n} ${Engine.pluralize("effect", n)} can be chained.` ``; only after
   *Yes* does it add `game-selectable-card` to the cards on the field, or open a list modal if any
   option lives in Deck/Extra/GY/Banished/Overlay. Right-click cancels a cancellable selection.

Also relevant to our design: chain-link **ordering** follows the same split —
`Game.onGameSortCards = function(a){ a.isChain && Game.chainingMode !== CHAINING_MANUAL && Game.chainingMode !== CHAINING_BLUFF ? Game.sendResponse(-1) : (…prompt…) }`.
There are **no keyboard shortcuts** for chaining (the only document-level key handlers focus the
chat box), and **no per-prompt countdown**: the clock is a server-authoritative chess clock
(`Game.timeLimit: 240`, `{type:"TimeLimit", player, time, multiplier}`) and the client contains no
code that auto-answers on timeout. DN ships **no** equivalent of EDOPro's `chain_when_avail`
distinction from "Manual", and no equivalent of the anti-tell stall.

None of the setting names guessed in the brief exist in their client: no "Auto Chain",
"Ignore Chain", "Always Chain", "Chain When Available", "Auto Pass", "Smart", or
"Activation Confirmation" strings anywhere in the bundle.

## A.5 Master Duel / Duel Links

Konami publishes **no** online manual or settings documentation for either game
(`konami.com/yugioh/masterduel/en/` has only "Contact Us"), so everything below is from in-client
screenshots (high confidence) or from consistent community writeups (flagged). Where the brief's
guessed names were wrong, that is called out — do not copy them into our UI.

### The three prompt states: `Off` / `Auto` / `On`

These are the real modes; `Activation Confirmation` (below) only decides *how you switch between
them*. Semantics, from the most detailed community guide (outof.games, 2022) and corroborated on
r/masterduel:

| State | You are asked… |
|---|---|
| **`Off`** | never for quick effects. Mandatory effects still fire, and **optional trigger effects still prompt**. |
| **`Auto`** (default) | at a fixed list of windows: **a monster is Summoned; an attack is declared; a Spell/Trap is activated; a Spell/Trap/Monster effect is activated; before the opponent ends their turn.** |
| **`On`** | at *every* window: every phase change (including the intent to leave a phase and each Battle Phase step), the moment **after** an effect resolves, and minor actions such as Setting a card or drawing for turn. |

Master Duel's `Auto` is therefore a **hand-written, hard-coded five-entry timing list**, where
EDOPro/DN/ocgcore use the per-card `spe_count` computation (§A.1). Same intent, coarser mechanism —
and it has a famous blind spot: `Auto` gives no window *after an effect resolves*, so you cannot
respond between Accesscode Talker's summon and its pop without switching to `On`. That is a
strong argument for our using `spe_count` rather than inventing our own timing list.

Windows where you hold nothing legal are skipped silently in both games — there is no
"you have no response" dialog, i.e. no equivalent of EDOPro's `Always pause` / DN's `Bluff`.

### `Activation Confirmation` — the *switching* setting

`Submenu → Game Settings → Duel`, changeable from the menu **or mid-duel**. The options use
circled numerals in the client, not the words "Hold 1":
**`Auto` / `Hold①` / `Hold②` / `Hold③` / `Switch` / `Switch + Hold` / `Custom`.**

| Option | Meaning |
|---|---|
| `Auto` | permanently `Auto`, no way to switch |
| `Hold①` | default `Auto`; hold LMB → `On`, hold RMB → `Off` |
| `Hold②` | default `Auto`; hold either button → `Off` |
| `Hold③` | default `Off`; hold LMB → `On` |
| `Switch` | no hold behaviour; a button on the duel screen cycles `Auto → Off → On` |
| `Switch + Hold` | both. In-client description, verbatim: *"A button to switch the activation confirmation settings will be displayed on the Duel screen. Furthermore, while holding left-click on the mouse you will be asked to confirm activations, and while holding right-click you will not be asked to confirm activations."* |
| `Custom` | choose whether the button shows and what each mouse button does |

The **in-duel button** is bottom-right, a disc reading `Auto` / `On` / `Off`, and it **only exists
in `Switch`, `Switch + Hold`, or `Custom`** — the Hold modes have no button at all. `RB`/`R1`/`R`
cycles it on a controller. (Cycle order UNVERIFIED: the 2022 guide says `Auto → Off → On`, a 2024
comment says `On → Auto → Off`.)

Corrections to the brief: **"Hold Priority" is not an option name** (it is an unrelated physical-TCG
concept), and there is no `Auto-Select Effects`, `Effect Activation Confirmation`, or
`Chain Confirmation` setting. The real neighbours are `Self Chain`, `Activation Order Settings`,
and `Reset Activation Confirmation settings`.

### Three neighbouring settings, all worth stealing

- **`Self Chain`** — gates prompts for chaining to *your own* actions, separately from the
  opponent's. Verbatim in-client descriptions: set to `Auto`, *"You will receive a prompt when
  there are cards that can be activated based on your opponent's actions."*; set to `On`,
  *"You will receive a prompt when there are cards that can be activated based on **your or**
  your opponent's actions."* Duel Links has the same setting.
- **`Reset Activation Confirmation settings`** — what happens to the mode at end of turn.
  In-client text for the `No change` value: *"Leaves the setting for Activation Confirmation at
  the end of the turn unchanged."* Other values named by users: `Change to Auto`,
  `Change to Confirm Activation`. It exists because a mid-duel `Off` is easy to forget about.
- **`Activation Order Settings`** (On/Off) — not about interrupting: it controls whether *you*
  sequence simultaneous optional triggers into chain links or the game does it for you. This is
  the same knob as EDOPro's *Automatic Chain Link order* (§A.2) and it is what enables chain-blocking.

### Prompt shape, mandatory effects, timer

- The prompt is **a confirmation with a card picker, never a bare Yes/No**, and it does **not**
  auto-fire even with a single candidate. Screenshot text:
  `"Rebirth of Nephthys" is activated. Chain another card or effect?` with the eligible cards as
  selectable thumbnails and two buttons, **`Cancel`** and **`Activate Effect`**. Note the header
  names the *event*, exactly like EDOPro's `event_string` (§A.2) and exactly what we want (§B.2).
- **Mandatory effects auto-activate; you are never asked whether.** You may still be interrupted
  to *order* them or to choose targets. Optional triggers from field/GY prompt even on `Off`;
  optional triggers **from the hand** are treated as quick effects (OCG ruling) and so *are*
  suppressed by `Off`. Quick effects (Maxx "C", Ash, Veiler, Imperm) prompt only on `Auto`/`On`.
- **There is no per-prompt countdown that auto-passes.** One shared time bank per player; hitting
  zero **loses the duel**. Konami's Sept-2022 values: 300 s at duel start, +60 s at the start of
  your turn and +30 s at the start of the opponent's, capped at 300 s. The bank ticks while a
  prompt is open, which is what makes an open prompt costly rather than merely annoying.
- The prompt-pause itself is a well-known information leak in both games — the delay tells the
  opponent you hold a response. `Off` is used deliberately as a bluffing tool, the same problem
  EDOPro solves with a random stall and DN with `Bluff` (§B.4).

### Duel Links

Same feature, same name, different option set. In-duel hamburger → **Settings** → scroll to
**`Activation Confirmation`**, values **`Auto` / `Tap` / `Toggle Button`**:

- `Auto` — the game asks when it judges it relevant, not at every possible timing.
- `Tap` — defaults to `Auto`; left-click asks at **every** activation, right-click asks at none.
  (Duel Links' analogue of `Hold①`.)
- `Toggle Button` — puts a circular `Auto` / `On` / `Off` button on the duel screen, **bottom-left**
  (opposite corner from Master Duel), tappable at any time. Analogue of `Switch`.

`Off` fully disables responding on the opponent's turn. `Auto` skips Standby/Draw Phase windows;
`On` includes them and every minor action. Duel Links also ships `Self Chain`. Its prompt is a
Yes/No-style "Activate?" dialog rather than Master Duel's picker (exact button labels UNVERIFIED),
and its response-timer numbers are UNVERIFIED. "Auto-Duel" is an unrelated PvE AI feature, not a
prompt setting.

---

# B. Design for us

## B.1 Prompt kinds

Every question the engine can ask falls into one of four kinds. `src/menu.js:buildMenu` should
stamp a `kind` on the `Menu` it returns; the front end styles and automates by kind.

| kind | messages | meaning | automatable? |
|---|---|---|---|
| **`action`** | `SELECT_IDLECMD`, `SELECT_BATTLECMD` | you hold initiative, the engine wants your move | never |
| **`respond`** | `SELECT_CHAIN` (not forced), and `SELECT_EFFECTYN` with the trigger sentinel (`description == 221n`, already handled in `menu.js`) | a timing window: may I interrupt? | **yes — this is the whole problem** |
| **`select`** | `SELECT_CARD`, `SELECT_UNSELECT_CARD`, `SELECT_TRIBUTE`, `SELECT_SUM`, `SELECT_PLACE`, `SELECT_DISFIELD`, `SELECT_POSITION`, `SELECT_COUNTER`, `SORT_CARD`, `SORT_CHAIN`, `ANNOUNCE_*` | a sub-question inside a move you already committed to | never (you asked for it) |
| **`confirm`** | `SELECT_YESNO`, `SELECT_OPTION`, plain `SELECT_EFFECTYN` | a binary or short choice, usually a cost or an "apply this?" | never by default |

Two `SELECT_CHAIN` sub-kinds are **not** `respond` and must always be shown:

- `msg.forced` → kind `action`, title "you must chain one of these". There is no `zero` item, so
  the existing UI already handles it; it just must never be auto-*declined*. One safe automation
  everyone ships: when a forced prompt has **exactly one** option there is no decision, so answer
  index 0 silently — DN does exactly this (`forced && a.cards.length === 1 → Game.sendResponse(0)`,
  §A.4) and ocgcore does it itself for the lone-mandatory-trigger phase case
  (`processor.cpp:421`). EDOPro's *Automatic Chain Link order* (sysstring 1276) goes further and
  answers index 0 for *any* forced prompt; with two mandatory triggers the order is a real
  decision, so offer that separately and default it off. Both automations must live in the front
  end (POST `"1"`), for the same record-compatibility reason as everything else in §C.
- `msg.spe_count === 0x7f` → kind `order`: you are being asked to *sequence* simultaneous
  mandatory triggers. Title should say so, because "respond?" is actively misleading here.

Each option also carries `client_mode` (`OcgEffectClientMode`, EDOPro's `flag`): `RESOLVE` marks a
continuous effect being *applied* rather than chained — EDOPro swaps its hint line to sysstring
556 "Select the effect to apply/resolve" when any option has it, and the core never counts those
in `spe_count`. Label them "apply" rather than "activate" in the panel; that alone removes a
recurring confusion.

Also copy the core's own downgrade: when a `respond` prompt has exactly one option, render it as
a yes/no card ("Activate *Mirror Force*? — Yes / No") rather than a numbered list. The core does
this itself for lone optional triggers (`processor.cpp:443`); doing it for the free-chain case
costs nothing and removes most of the visual weight.

## B.2 Visual treatment

Today `+page.svelte` renders every menu into the same amber panel with `view.menu.title` as an
`<h3>`. Give `kind === "respond"` its own panel, in the same right column, distinct in three
ways at once (colour alone is not enough — the panel is small and the change is fast):

**Colour.** Amber stays the "you are acting" palette. Response windows get a violet/indigo one,
so a glance at the column answers "am I doing something, or being asked to interrupt?". Per the
house CSS rule, tokens in `:root` (`web/src/app.css`), no bare values in the component:

```css
:root {
  --respond-bg: rgb(30 27 75 / 0.55);      /* indigo-950 @55% */
  --respond-border: rgb(129 140 248 / 0.5); /* indigo-400 @50% */
  --respond-accent: rgb(165 180 252);       /* indigo-300 — headers, index numbers */
  --respond-rule-w: 3px;                    /* left rule that marks the whole panel */
  --respond-grace-ms: 2500ms;               /* smart-mode auto-decline countdown */
}
```

**Header block**, three lines, replacing the current single title. All of it is data we already
have, and it is exactly EDOPro's popup body reflowed:

```
RESPOND · P1's turn — Battle Phase (battle step)        <- kind + phase, small caps, --respond-accent
"Blue-Eyes White Dragon" is attacking "Dark Magician"   <- the event: ctx.eventHint, else the last event
you may respond · attack declared · 2 options, 1 at its natural timing
```

- Line 1: literal word `RESPOND`, then `P{turnPlayer}'s turn — {PHASE_WORDS[phase]}`. Both are
  already computed in `menu.js:buildMenu` case `T.SELECT_CHAIN`.
- Line 2 is the header the brief asks for ("Respond to: `<event>`"). `ctx.eventHint` gives it
  when the core sent `HINT_EVENT`; when it is `0n`, **fall back to the last entry of
  `src/events.js`** — precisely what EDOPro does with `event_string`. This fallback is the one
  real content addition; without it the header is often empty. Our event kinds already cover
  EDOPro's whole `event_string` vocabulary, so the mapping is mechanical:

  | our event kind | rendered header | EDOPro equivalent |
  |---|---|---|
  | `activate {name, chainLink}` | `An effect of "<name>" was activated` | 1609 |
  | `summon {name, special}` | `"<name>" was Normal / Special Summoned` | 1603–1606 |
  | `flip {name}` | `"<name>" was Flip Summoned` | 1607–1608 |
  | `attack {name, direct, to}` | `"<a>" is attacking "<b>"` / `…attacking directly` | 1619–1620 |
  | `set {monster}` | `A card was Set` | 1601 |
  | `draw {player, count}` | `You drew N card(s)` / `Your opponent drew …` | 1611–1612 |
  | `damage` / `recover` | `You took N damage` / `You gained N LP` | 1613–1616 |
  | `phase` / `turn` | `Draw Phase`, `End Phase`, … | 20–29 |

- Line 3: `timingWords(hint_timing | hint_timing_other)` (already implemented), plus the option
  count and `spe_count` — spelling out *why* you are being asked is what turns the prompt from
  noise into information.

**Field, not just panel.** Follow EDOPro: mark the offered cards on the board. We already have
`fx-flash` in `app.css`; a persistent `--respond-accent` ring on the zones named by the options
lets the player answer by looking at the field. This needs `menuSummary` to carry each item's
`{code, place}` instead of only a rendered label (see §C).

**Sound.** `sound.js` currently plays a `turn` bell for your move. Add a distinct, quieter
`respond` cue, and **do not play any cue for a prompt that is about to be auto-declined**. That
single rule removes most of the felt noise even before the settings ship.

**Countdown — yes, and it is the key safety feature.** In `smart` and `never` modes, do not
submit instantly. Render the panel, dim it, and show `Auto-passing in 2.5 s — [Stop, let me look]`.
On expiry, submit `"0"`. `--respond-grace-ms: 0` gives the instant behaviour for people who want
it. EDOPro and Master Duel cannot offer this (they are real-time); we are turn-based over HTTP,
so we can automate *and* keep the undo. A visible skip is a very different product from a silent one.

**Recap line.** Above the next real prompt, show what was skipped:
`auto-passed 7 windows (last: end phase — Mirror Force was available)`. Client-side only, derived
from the auto-declines this tab performed. This is the cure for "why did I never get to use my trap".

## B.3 Settings model

One object, one localStorage key, per browser (a seat is a tab):

```js
// localStorage["ygo.respond.v1"]
{
  mode: "always",           // "always" | "smart" | "never"
  graceMs: 2500,            // countdown before an automatic decline; 0 = instant
  mutedTimings: [],         // OcgHintTiming bit names the user never wants to be woken at
  cards: {},                // { "<card code>": "always" | "never" }  — omitted card = follow mode
  selfChain: false,         // also stop at windows opened by my own actions (Master Duel's Self Chain)
  resetEachTurn: false,     // snap `mode` back to its default at end of turn
  recap: true               // show the "auto-passed N windows" line
}
```

The three required modes:

- **`always`** (the brief's default) — every response window is shown. Present behaviour, minus
  the visual confusion. Worth stating plainly in the UI copy that EDOPro's default is `smart`;
  recommend `smart` as *our* default once the countdown exists, because `always` with a
  well-designed panel is still one click per timing window.
- **`never`** — auto-decline every optional response window. Equivalent to EDOPro's `Chain: OFF`
  and to our CLI's `--auto-pass` with no `--ask-for`. Forced and ordering prompts still appear
  (they have no legal decline).
- **`smart`** — §B.4.

**A fourth mode — EDOPro's `Always pause` / DN's `Bluff` — is *not* available to us, and this is
worth knowing before someone tries to add it.** Those modes stop at windows where *nothing* is
activatable ("Nothing can be activated. Check the field?"). Our `src/duel.js:autoResponse` already
answers those below the record, so they never reach the UI at all: our `always` mode is exactly
EDOPro's `Chain: ON` / DN's `Manual` (ask whenever `count > 0`), which is why it is noisy — and
it is strictly weaker than `Always pause` / `Bluff`. Surfacing them would mean deleting that branch of
`autoResponse`, which changes the set of recorded decision points and desyncs every existing
`duels/*.json` (§C). If we ever want it, it costs a duel-record version bump, not a setting.

**Put the mode on the field, not in a settings page.** DN's single cycling button
(`Chaining: Auto → Manual → Bluff → Off`, colour-coded, persisted, switchable mid-duel) is a
better fit than a preferences dialog, and it is switchable at the moment you realise you need it.
Ours: a small button in the response panel's header row cycling
`Respond: Always → Smart → Never`, background `--respond-accent` at three tints, with the
per-card and per-timing detail behind a `<details>` popover for the people who want it.

Four refinements, all only meaningful in `smart` — the two the brief asks for, then two
borrowed from Master Duel (§A.5):

- **Per-card "wake me for this card"** — a small toggle on each option in the panel and on the
  card preview, writing `cards[code] = "always" | "never"`. Keyed by **card code**, so it is a
  standing preference across duels: you teach it once that *Mirror Force* is worth waking for.
- **Per-timing checklist** — checkboxes for `summon`, `special summon`, `set`, `attack`,
  `activation` (chain in progress), `draw / standby`, `end phase`, `damage step`, `damage / LP`,
  each mapping to `OcgHintTiming` bits we already have names for in `menu.js:TIMING_LABELS`.
  Make it **subtractive** (a mute list, everything on by default): muting a timing where you hold
  a relevant trap loses duels, so muting must be a deliberate act, never a default.
- **`selfChain` (borrowed from Master Duel's `Self Chain`, §A.5)** — a separate gate for windows
  opened by **your own** actions. The core asks the turn player at their own summons and sets too,
  and that is a large share of the noise for the player who is doing things. Default it the way
  Master Duel does: prompt on the opponent's actions, stay quiet on your own. The wire tells us
  which is which — ocgcore writes the *asked* player's bits into `hint_timing` and the opponent's
  into `hint_timing_other` (`processor.cpp:481-482`), so "this window is my own doing" is exactly
  `hint_timing !== 0 && hint_timing_other === 0`. One checkbox, big win.
- **`resetEachTurn` (Master Duel's `Reset Activation Confirmation settings`, §A.5)** — optionally
  snap `mode` back to its default at end of turn. It exists because a mid-duel `never` is very
  easy to forget about, and forgetting costs you the duel. Default off, but offer it.

## B.4 "Smart", defined exactly

A pure predicate, shared by the web UI and the CLI (§C). `true` = show the prompt.

```
askRespondPrompt(msg, settings) :=
  if msg.forced                      -> true    // no decline exists
  if msg.spe_count === 0x7f          -> true    // ordering mandatory triggers
  if settings.mode === "always"      -> true
  if settings.mode === "never"       -> false
  // settings.mode === "smart":
  let codes  = msg.selects.map(resolveCode)   // s.code, or cardAt(field, s).code when masked to 0
  if codes.some(c => settings.cards[c] === "always")            -> true
  if codes.every(c => settings.cards[c] === "never")            -> false
  let bits = msg.hint_timing | msg.hint_timing_other
  if bits !== 0 && every set bit is in settings.mutedTimings    -> false
  if !settings.selfChain
     && msg.hint_timing !== 0 && msg.hint_timing_other === 0    -> false   // my own action opened this
  return msg.spe_count > 0
```

The last line is the whole of it, and it is not a heuristic: per §A.1, `spe_count` is the core's
own count of options whose card script declares this timing as one it wants to be offered at.
That gives us the brief's rules for free and per-card-correct — a set Trap counts at the
opponent's summon/attack/activation but not in your own Draw Phase; a Quick-Play counts nearly
everywhere; a continuous effect is never counted — plus the two safety overrides baked into the
core at `processor.cpp:1133`: **a chain in progress or a declared attack forces `spe_count` to
the full count, so smart mode always stops there.** Any hand-written timing heuristic we invented
would be a worse approximation of a table the card scripts already publish.

`resolveCode` matters: `msg.selects[i].code` is `0` for a card the viewer may not see, so it must
fall back through the field model exactly as `menu.js:entryLabel` already does (line 132). The
menu is built from the *asked* player's masked stream (`session.js:83-88`), so your own set cards
resolve fine; if a code still resolves to 0, that option simply has no per-card rule.

One Master Duel behaviour we **cannot** reproduce: its `Off` still prompts for optional trigger
effects on the field/GY while suppressing quick effects (§A.5). `MSG_SELECT_CHAIN` does not tell
us which options came from `trigger_o_effect` and which from the free-chain pools — the only
per-option discriminator on the wire is `client_mode` (normal / reset / resolve). So our `never`
means never, for all optional options. Worth stating in the UI copy, because a missed optional
trigger is a real loss and the user should know `never` can cause one.

Evaluation order is deliberate: per-card `always` beats a muted timing and the `selfChain` gate
(an explicit "wake me" should not be defeated by a checkbox the user forgot about); an
all-`never` option set beats `spe_count` (an explicit mute is explicit); and both gates are
checked before `spe_count`, so a window can be muted even when the core thinks it is relevant.

Note on information leakage: EDOPro/YGOPro pad auto-declines with 20 / 20–40 frames so the
opponent cannot read "instant pass = nothing chainable" off the clock (§A.2/§A.3); Dueling Nexus
instead offers the `Bluff` mode that stops at every window (§A.4). Our client is HTTP-polled at
`POLL_MS = 1500`, so an auto-decline is already smeared across a poll interval and the tell is
weak. If we ever show live per-decision timings, add a randomised 300–700 ms delay before the
automatic POST (we cannot offer `Bluff`/`Always pause` — see §B.3). Not needed now; recorded here
so it is not rediscovered.

---

# C. What changes, and where

**Nothing in this design changes the engine, and no duel record becomes unreadable.** The precise
statement, because there is one nuance worth being exact about:

- An automatic decline is **an ordinary recorded response**. The page POSTs
  `{as, choice: "0"}` to `/api/duel/[id]` — byte-identical to a human clicking *"Do not activate
  anything"* — and `session.js:playChoice` appends `{type: SELECT_CHAIN, index: null}` to
  `duel.responses` exactly as before. Replays, forks and the scrubber are unaffected because the
  set of recorded decision points is unchanged.
- The **only** auto-answer that is *not* recorded is `src/duel.js:autoResponse`, which silently
  answers `SELECT_CHAIN` when `selects.length === 0 && spe_count === 0`. That one lives below the
  record and is replayed deterministically. **The smart filter must not be moved there.** Relaxing
  that condition to `spe_count === 0` alone (dropping the `selects.length === 0` half — i.e.
  exactly EDOPro's default) would remove decision points that existing `duels/*.json` files
  already carry responses for, and every stored duel would desync on replay. Front end only — the
  brief's instinct is right, and this is the reason.

Everything the predicate needs is already on the message — no binding work, no engine work
(`node_modules/ocgcore-wasm/dist/index.d.ts:1154-1163`):

```ts
/** Select to chain in response (if possible). */
export declare interface OcgMessageSelectChain {
    type: OcgMessageType.SELECT_CHAIN;
    player: number;
    spe_count: number;
    forced: boolean;
    hint_timing: OcgHintTiming;
    hint_timing_other: OcgHintTiming;
    selects: OcgCardLocPosActive[];
}
```

(there is no `count` field — EDOPro's `count` is our `selects.length`). The binding also ships
`ocgHintTimingParse(mask): OcgHintTiming[]`, which is what the per-timing checklist UI should use
to turn a window's bits into rows, rather than re-deriving them from `timingWords`.

Files, smallest diff first:

| File | Change | Purity |
|---|---|---|
| `web/src/app.css` | `--respond-*` tokens (§B.2) | — |
| `src/menu.js` | stamp `kind` (`action`/`respond`/`select`/`confirm`/`order`) on the returned `Menu`; keep `code` + `place` per item; export the header parts (`event`, `phase`, `timing`) as a `respond: {...}` block instead of concatenating them into `title` | pure, additive |
| `src/menu.js` | new pure `askRespondPrompt(msg, settings)` (§B.4) + its doctests | pure |
| `src/session.js` | `menuSummary` currently drops everything but labels — forward `kind`, `respond`, and per-item `{code, place}`; re-express `shouldAutoPass` on top of `askRespondPrompt` so CLI and web cannot disagree | pure |
| `bin/ygo.js` | map the existing flags onto the shared settings object: `--auto-pass` → `mode:"never"`, `--ask-for` → `cards[code]="always"`, `--ask-at` → inverse of `mutedTimings`; add `--smart` → `mode:"smart"` | CLI glue |
| `web/src/routes/duel/[id]/+page.svelte` | respond panel + header + settings popover + countdown + recap + auto-POST effect | front end |
| `web/src/lib/pretty/sound.js` | add a `respond` cue | front end |
| `test/menu.test.js` | already covers `shouldAutoPass` (lines 63-71); extend the same table to `askRespondPrompt`, including the `forced` and `spe_count === 0x7f` escapes | test |

Front-end auto-decline mechanics (the only genuinely new control flow):

- Fire only when `myDecision && playbackAt === null && !busy && menu.kind === "respond" &&
  menu.zero !== null && !askRespondPrompt(...)`.
- Start the `graceMs` timer in an effect keyed on `view.moves` so a re-render cannot double-fire;
  cancel it on any user interaction, on a poll that changes `pendingPlayer`, and on unmount.
- Both seats may be automating; that is fine — each POST advances the duel one response and the
  next poll re-evaluates.
- Never automate when `view.viewer === 2` (spectator) or during playback.

Settings live in `localStorage` and are read by the page only. The server, `src/`, the duel JSON
and the CLI's recorded behaviour are untouched by the *web* setting; the CLI keeps its own flags,
and both call the same predicate.

## Open questions

1. Default mode: the brief says `always`; EDOPro's shipping default is `smart` (§A.2) and our own
   CLI already offers `--auto-pass`. Recommend shipping `always` as asked, then flipping the
   default to `smart` once the countdown and recap exist.
2. Should `smart` also cover the trigger flavour of `SELECT_EFFECTYN`? Declining one is a real
   game decision (a missed trigger), and no ygopro-lineage client automates it. Recommend: kind
   `respond` for styling, but always ask.
3. Per-seat vs per-browser settings. One key per browser is simplest and matches how a tab maps
   to a seat; revisit only if someone plays both seats in one tab.

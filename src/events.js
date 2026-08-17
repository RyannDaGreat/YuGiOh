/**
 * Animation events: a compact, structured digest of what just happened, for a
 * visual client. Derived from the viewer's MASKED stream, so a client cannot
 * learn more from events than from the log.
 *
 * Every event carries `i`, the index of the source message in the viewer's
 * masked stream, so a polling client can ask "what is new since index N?".
 *
 * The digest also answers WHY where the raw stream only says WHAT, because a
 * client wants a distinct sound/animation per happening the way EDOPro does
 * (docs/ux-survey-open-source.md, section C): a summon says whether monsters
 * were released for it, a card leaving the field says what killed it, and a
 * flip says whether it was a flip summon or a monster turned face-up by an
 * attack. The core never states any of that, so it is read off the message
 * WINDOW each event lands in — see `moveReason` and `extractEvents`.
 */

import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";
import { cardName } from "./cards.js";
import { applyMessage, cardAt, createField } from "./field.js";

const T = OcgMessageType;

/** A card must come from one of these for its departure to be a field event. */
const FIELD = OcgLocation.MZONE | OcgLocation.SZONE;

/**
 * Pure function. Compact coordinate for a client: {p, zone, seq}.
 *
 * Args:
 *     loc ({controller, location, sequence}): Core coordinate.
 *
 * Returns:
 *     {p: number, zone: "m"|"s"|"hand"|"grave"|"removed"|"deck"|"extra"|"other", seq: number}
 *
 * Examples:
 *     >>> coord({controller: 1, location: 4, sequence: 3}) // {p: 1, zone: "m", seq: 3}
 *     >>> coord({controller: 0, location: 16, sequence: 0}) // {p: 0, zone: "grave", seq: 0}
 */
export function coord(loc) {
  const zones = { [OcgLocation.MZONE]: "m", [OcgLocation.SZONE]: "s", [OcgLocation.HAND]: "hand", [OcgLocation.GRAVE]: "grave", [OcgLocation.REMOVED]: "removed", [OcgLocation.DECK]: "deck", [OcgLocation.EXTRA]: "extra", [OcgLocation.FZONE]: "s", [OcgLocation.PZONE]: "s" };
  const seq = loc.location === OcgLocation.FZONE ? 5 : loc.location === OcgLocation.PZONE ? 6 + loc.sequence : loc.sequence;
  return { p: loc.controller, zone: zones[loc.location & ~OcgLocation.OVERLAY] ?? "other", seq };
}

/**
 * Pure function. Why a card left where it was, from the windows open at the MOVE.
 *
 * The core never says why. What it does say is which window the MOVE fell in:
 * between CHAIN_SOLVING and CHAIN_SOLVED an effect is resolving, and after a
 * BATTLE announcement (until the damage step ends) the battle is killing
 * things. Tribute releases are indistinguishable from anything else at the
 * moment they happen — they look like "other" here and are relabelled
 * "tribute" by `extractEvents` when the SUMMONING that ate them arrives.
 *
 * Args:
 *     windows ({chain: boolean, battle: boolean}): Open windows at the MOVE.
 *
 * Returns:
 *     "effect"|"battle"|"other"
 *
 * Examples:
 *     >>> moveReason({chain: true, battle: false})   // "effect"
 *     >>> moveReason({chain: false, battle: true})   // "battle"
 *     >>> moveReason({chain: false, battle: false})  // "other"
 *     >>> moveReason({chain: true, battle: true})    // "effect"  (a chain resolving mid-battle)
 */
export function moveReason(windows) {
  if (windows.chain) return "effect";
  if (windows.battle) return "battle";
  return "other";
}

/**
 * Command. Relabels the releases belonging to `controller` as tributes and
 * returns how many there were. Mutates the `tograve` events it claims — they
 * were emitted before anything knew a summon was coming.
 *
 * Args:
 *     released (Array<{controller: 0|1, event: object}>): Monsters that left a
 *         monster zone since the last summon / activation / phase.
 *     controller (0|1): The player summoning or setting.
 *
 * Returns:
 *     number: How many of those releases were that player's.
 *
 * Examples:
 *     >>> const event = {kind: "tograve", reason: "other"};
 *     >>> claimTributes([{controller: 0, event}], 0)  // 1, and event.reason is now "tribute"
 *     >>> claimTributes([{controller: 1, event}], 0)  // 0 — the opponent's monster, left alone
 */
function claimTributes(released, controller) {
  const mine = released.filter((r) => r.controller === controller);
  for (const r of mine) r.event.reason = "tribute";
  return mine.length;
}

/**
 * Pure function. Extracts animation events from a masked message stream.
 *
 * Args:
 *     messages (OcgMessage[]): Masked for the viewer.
 *     viewer (0|1|2): Whose stream (for the field model that names cards).
 *     startingLP (number), deckSizes ([number, number]): For the field model.
 *
 * Returns:
 *     Array<{i: number, kind: string, ...}>, one per happening, in stream order:
 *       turn     {player}
 *       phase    {phase}
 *       draw     {player, count}
 *       summon   {at, name, special, tribute, tributes}   tributes = monsters released
 *       set      {at, monster, tribute, tributes}          monster=false is a set spell/trap
 *       flip     {at, name, battle}                       battle=true: flipped by an attack
 *       activate {at, name, chainLink}
 *       resolve  {chainLink}                              that link now resolving
 *       attack   {from, to|null, name, direct}
 *       battle   {attacker, target, attackerDestroyed, targetDestroyed}
 *       damage   {player, amount, cost}                   cost=true: paid, not dealt
 *       recover  {player, amount}
 *       tograve  {from, name, reason}                     reason: see moveReason + "tribute"
 *       banish   {from, name, reason}
 *       move     {from, to, name, faceFrom, faceTo, reason}  any zone→zone trip; drives the visual flyer
 *       pos      {at, name, position, prev}               position change that is not a flip
 *       shuffle  {player, what}                           what: deck|hand|extra|set
 *       equip    {at, target, name, targetName}
 *       counter  {at, name, add, count, counterType}
 *       reveal   {player, names}
 *       coin     {player, results}                        results: boolean[] (true = heads)
 *       dice     {player, results}                        results: number[]
 *       win      {player}                                 2 = draw
 *
 * Examples:
 *     >>> extractEvents([{type: 40, player: 0}], 2, 8000, [40, 40])
 *     [{i: 0, kind: "turn", player: 0}]
 *     >>> // Release one monster, then summon: the summon is a tribute summon and
 *     >>> // the released monster's trip to the graveyard is labelled "tribute".
 *     >>> const release = {type: 50, card: 89631139, from: {controller: 0, location: 4, sequence: 0, position: 1}, to: {controller: 0, location: 16, sequence: 0, position: 1}};
 *     >>> const summon = {type: 60, code: 26378150, controller: 0, location: 4, sequence: 1, position: 1};
 *     >>> extractEvents([release, summon], 2, 8000, [40, 40]).map((e) => [e.kind, e.reason ?? e.tributes])
 *     [["tograve", "tribute"], ["summon", 1]]
 */
export function extractEvents(messages, viewer, startingLP, deckSizes) {
  const field = createField(startingLP, deckSizes);
  const events = [];
  const name = (loc) => cardName(cardAt(field, loc)?.code ?? 0);
  // Windows open at the current message. `chain`/`battle` explain MOVEs (see
  // moveReason); `damageStep` separates a flip summon from an attacked
  // monster being turned face-up.
  const windows = { chain: false, battle: false, damageStep: false };
  // tograve events for monsters that left a monster zone since the last
  // summon / activation / phase, so a SUMMONING can claim them as its tributes.
  let released = [];

  messages.forEach((m, i) => {
    switch (m.type) {
      case T.NEW_TURN:
        released = [];
        Object.assign(windows, { battle: false, damageStep: false });
        events.push({ i, kind: "turn", player: m.player });
        break;
      case T.NEW_PHASE:
        released = [];
        Object.assign(windows, { battle: false, damageStep: false });
        events.push({ i, kind: "phase", phase: m.phase });
        break;
      case T.DRAW:
        events.push({ i, kind: "draw", player: m.player, count: m.drawn.length });
        break;
      case T.SUMMONING: {
        const tributes = claimTributes(released, m.controller);
        released = [];
        events.push({ i, kind: "summon", at: coord(m), name: cardName(m.code), special: false, tribute: tributes > 0, tributes });
        break;
      }
      case T.SPSUMMONING:
        // Materials sent to the graveyard for a special summon are the cost of
        // an effect, not tributes, so they keep the reason they already had.
        released = [];
        events.push({ i, kind: "summon", at: coord(m), name: m.code ? cardName(m.code) : null, special: true, tribute: false, tributes: 0 });
        break;
      case T.FLIPSUMMONING:
        released = [];
        events.push({ i, kind: "flip", at: coord(m), name: cardName(m.code), battle: false });
        break;
      case T.SET: {
        // Setting a high-level monster costs tributes exactly as summoning it
        // does; a set spell/trap never costs any.
        const monster = m.location === OcgLocation.MZONE;
        const tributes = monster ? claimTributes(released, m.controller) : 0;
        released = [];
        events.push({ i, kind: "set", at: coord(m), monster, tribute: tributes > 0, tributes });
        break;
      }
      case T.CHAINING:
        released = [];
        events.push({ i, kind: "activate", at: coord(m), name: cardName(m.code), chainLink: m.chain_size });
        break;
      case T.CHAIN_SOLVING:
        windows.chain = true;
        events.push({ i, kind: "resolve", chainLink: m.chain_size });
        break;
      case T.CHAIN_SOLVED: case T.CHAIN_NEGATED: case T.CHAIN_END:
        windows.chain = false;
        break;
      case T.ATTACK:
        windows.battle = false;
        events.push({ i, kind: "attack", from: coord(m.card), to: m.target ? coord(m.target) : null, name: name(m.card), direct: !m.target });
        break;
      case T.DAMAGE_STEP_START:
        windows.damageStep = true;
        break;
      case T.DAMAGE_STEP_END:
        Object.assign(windows, { battle: false, damageStep: false });
        break;
      case T.BATTLE:
        windows.battle = true;
        if (m.target && m.target.location !== 0) {
          events.push({ i, kind: "battle", attacker: coord(m.card), target: coord(m.target), attackerDestroyed: m.card.destroyed, targetDestroyed: m.target.destroyed });
        }
        break;
      case T.DAMAGE: events.push({ i, kind: "damage", player: m.player, amount: m.amount, cost: false }); break;
      case T.PAY_LPCOST: events.push({ i, kind: "damage", player: m.player, amount: m.amount, cost: true }); break;
      case T.RECOVER: events.push({ i, kind: "recover", player: m.player, amount: m.amount }); break;
      case T.MOVE: {
        const label = m.card ? cardName(m.card) : name(m.from);
        // Generic relocation, the ONE primitive the visual flyer rides (any zone
        // → any zone). Fired for a real trip only: a zone/side change, or a shift
        // between field slots ("one side of the field to the other"); internal
        // hand/deck/GY re-ordering is left to the client's reflow, not a flyer.
        // faceFrom/faceTo let the flyer flip mid-air when a card reveals or hides.
        const cf = coord(m.from), ct = coord(m.to);
        const fieldShift = cf.p === ct.p && cf.zone === ct.zone && (ct.zone === "m" || ct.zone === "s") && cf.seq !== ct.seq;
        if (cf.p !== ct.p || cf.zone !== ct.zone || fieldShift) {
          events.push({
            i, kind: "move", from: cf, to: ct, name: label, code: m.card ?? 0,
            faceFrom: !!(m.from.position & OcgPosition.FACEUP),
            faceTo: !!(m.to.position & OcgPosition.FACEUP),
            reason: moveReason(windows),
          });
        }
        if (m.to.location === OcgLocation.REMOVED) {
          events.push({ i, kind: "banish", from: coord(m.from), name: label, reason: moveReason(windows) });
        } else if (m.to.location === OcgLocation.GRAVE && (m.from.location & FIELD)) {
          const event = { i, kind: "tograve", from: coord(m.from), name: label, reason: moveReason(windows) };
          events.push(event);
          // A monster that dies while an effect resolves was killed by it, not
          // released for a summon: a normal summon or set is never part of a chain.
          if ((m.from.location & OcgLocation.MZONE) && !windows.chain) released.push({ controller: m.from.controller, event });
        }
        break;
      }
      case T.POS_CHANGE: {
        // Turning a set spell/trap face-up to activate it is part of the
        // activation, not a flip of its own — the same rule log.js applies.
        const next = messages[i + 1];
        const activating = next?.type === T.CHAINING && next.controller === m.controller && next.location === m.location && next.sequence === m.sequence;
        if (activating) break;
        if ((m.prev_position & OcgPosition.FACEDOWN) && (m.position & OcgPosition.FACEUP)) {
          events.push({ i, kind: "flip", at: coord(m), name: cardName(m.code), battle: windows.damageStep });
        } else {
          events.push({ i, kind: "pos", at: coord(m), name: cardName(m.code), position: m.position, prev: m.prev_position });
        }
        break;
      }
      case T.SHUFFLE_DECK: events.push({ i, kind: "shuffle", player: m.player, what: "deck" }); break;
      case T.SHUFFLE_HAND: events.push({ i, kind: "shuffle", player: m.player, what: "hand" }); break;
      case T.SHUFFLE_EXTRA: events.push({ i, kind: "shuffle", player: m.player, what: "extra" }); break;
      case T.SHUFFLE_SET_CARD: events.push({ i, kind: "shuffle", player: m.cards[0]?.from.controller ?? 0, what: "set" }); break;
      case T.EQUIP: events.push({ i, kind: "equip", at: coord(m.card), target: coord(m.target), name: name(m.card), targetName: name(m.target) }); break;
      case T.ADD_COUNTER: events.push({ i, kind: "counter", at: coord(m), name: name(m), add: true, count: m.count, counterType: m.counter_type }); break;
      case T.REMOVE_COUNTER: events.push({ i, kind: "counter", at: coord(m), name: name(m), add: false, count: m.count, counterType: m.counter_type }); break;
      case T.CONFIRM_CARDS: events.push({ i, kind: "reveal", player: m.player, names: m.cards.map((c) => cardName(c.code)) }); break;
      case T.TOSS_COIN: events.push({ i, kind: "coin", player: m.player, results: [...m.results] }); break;
      case T.TOSS_DICE: events.push({ i, kind: "dice", player: m.player, results: [...m.results] }); break;
      case T.WIN: events.push({ i, kind: "win", player: m.player }); break;
      default: break;
    }
    applyMessage(field, m, viewer);
  });
  return events;
}

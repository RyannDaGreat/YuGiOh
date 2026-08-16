/**
 * Animation events: a compact, structured digest of what just happened, for a
 * visual client. Derived from the viewer's MASKED stream, so a client cannot
 * learn more from events than from the log.
 *
 * Every event carries `i`, the index of the source message in the viewer's
 * masked stream, so a polling client can ask "what is new since index N?".
 */

import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";
import { cardName } from "./cards.js";
import { applyMessage, cardAt, createField } from "./field.js";

const T = OcgMessageType;

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
 * Pure function. Extracts animation events from a masked message stream.
 *
 * Args:
 *     messages (OcgMessage[]): Masked for the viewer.
 *     viewer (0|1|2): Whose stream (for the field model that names cards).
 *     startingLP (number), deckSizes ([number, number]): For the field model.
 *
 * Returns:
 *     Array<{i: number, kind: string, ...}> where kind is one of:
 *       turn {player}, phase {phase}, draw {player, count},
 *       summon {at, name, special}, set {at, monster}, flip {at, name},
 *       activate {at, name}, attack {from, to|null}, battle {attacker, target, attackerDestroyed, targetDestroyed},
 *       damage {player, amount}, recover {player, amount}, tograve {from, name},
 *       win {player}
 *
 * Examples:
 *     >>> extractEvents([{type: 40, player: 0}], 2, 8000, [40, 40])
 *     [{i: 0, kind: "turn", player: 0}]
 */
export function extractEvents(messages, viewer, startingLP, deckSizes) {
  const field = createField(startingLP, deckSizes);
  const events = [];
  const name = (loc) => cardName(cardAt(field, loc)?.code ?? 0);
  messages.forEach((m, i) => {
    switch (m.type) {
      case T.NEW_TURN: events.push({ i, kind: "turn", player: m.player }); break;
      case T.NEW_PHASE: events.push({ i, kind: "phase", phase: m.phase }); break;
      case T.DRAW: events.push({ i, kind: "draw", player: m.player, count: m.drawn.length }); break;
      case T.SUMMONING: events.push({ i, kind: "summon", at: coord(m), name: cardName(m.code), special: false }); break;
      case T.SPSUMMONING: events.push({ i, kind: "summon", at: coord(m), name: m.code ? cardName(m.code) : null, special: true }); break;
      case T.FLIPSUMMONING: events.push({ i, kind: "flip", at: coord(m), name: cardName(m.code) }); break;
      case T.SET: events.push({ i, kind: "set", at: coord(m), monster: m.location === OcgLocation.MZONE }); break;
      case T.CHAINING: events.push({ i, kind: "activate", at: coord(m), name: cardName(m.code) }); break;
      case T.ATTACK: events.push({ i, kind: "attack", from: coord(m.card), to: m.target ? coord(m.target) : null, name: name(m.card) }); break;
      case T.BATTLE:
        if (m.target && m.target.location !== 0) {
          events.push({ i, kind: "battle", attacker: coord(m.card), target: coord(m.target), attackerDestroyed: m.card.destroyed, targetDestroyed: m.target.destroyed });
        }
        break;
      case T.DAMAGE: case T.PAY_LPCOST: events.push({ i, kind: "damage", player: m.player, amount: m.amount }); break;
      case T.RECOVER: events.push({ i, kind: "recover", player: m.player, amount: m.amount }); break;
      case T.MOVE:
        if (m.to.location === OcgLocation.GRAVE && (m.from.location & (OcgLocation.MZONE | OcgLocation.SZONE))) {
          events.push({ i, kind: "tograve", from: coord(m.from), name: m.card ? cardName(m.card) : name(m.from) });
        }
        break;
      case T.POS_CHANGE:
        if ((m.prev_position & OcgPosition.FACEDOWN) && (m.position & OcgPosition.FACEUP)) events.push({ i, kind: "flip", at: coord(m), name: cardName(m.code) });
        break;
      case T.WIN: events.push({ i, kind: "win", player: m.player }); break;
      default: break;
    }
    applyMessage(field, m, viewer);
  });
  return events;
}

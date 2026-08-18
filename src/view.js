/**
 * Per-player information masking.
 *
 * The core emits ONE omniscient message stream. A player must only ever see
 * their own share of it: not the opponent's hand, not face-down cards, not deck
 * order. This module is a port of the fan-out logic in YGOPro's server
 * (`gframe/single_duel.cpp` `SingleDuel::Analyze`, cross-checked against
 * EDOPro's `generic_duel.cpp`) — the same rules every online duel uses, rather
 * than rules invented here. Where a rule below deviates from the server it says
 * so and why.
 *
 * Viewers: 0 and 1 are the players. SPECTATOR sees the unmasked stream — that
 * is what a judge or post-game analyst gets, and what the duel record stores.
 *
 * Masking convention (also the server's): a card code the viewer may not know
 * is replaced by 0. Renderers print 0 as an unknown card.
 */

import { OcgHintType, OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";

export const SPECTATOR = 2;

/** Hint types delivered only to the player they name. */
const PRIVATE_HINTS = new Set([OcgHintType.EVENT, OcgHintType.MESSAGE, OcgHintType.SELECTMSG, OcgHintType.EFFECT]);
/** Hint types delivered only to the OTHER player ("your opponent chose X"). */
const OPPONENT_HINTS = new Set([OcgHintType.OPSELECTED, OcgHintType.RACE, OcgHintType.ATTRIB, OcgHintType.CODE, OcgHintType.NUMBER, OcgHintType.ZONE]);

/** Messages that are questions: only the asked player receives them. */
const QUESTION_TYPES = new Set([
  OcgMessageType.SELECT_BATTLECMD, OcgMessageType.SELECT_IDLECMD, OcgMessageType.SELECT_EFFECTYN,
  OcgMessageType.SELECT_YESNO, OcgMessageType.SELECT_OPTION, OcgMessageType.SELECT_CARD,
  OcgMessageType.SELECT_CHAIN, OcgMessageType.SELECT_PLACE, OcgMessageType.SELECT_POSITION,
  OcgMessageType.SELECT_TRIBUTE, OcgMessageType.SORT_CHAIN, OcgMessageType.SELECT_COUNTER,
  OcgMessageType.SELECT_SUM, OcgMessageType.SELECT_DISFIELD, OcgMessageType.SORT_CARD,
  OcgMessageType.SELECT_UNSELECT_CARD, OcgMessageType.ROCK_PAPER_SCISSORS,
  OcgMessageType.ANNOUNCE_RACE, OcgMessageType.ANNOUNCE_ATTRIB, OcgMessageType.ANNOUNCE_CARD,
  OcgMessageType.ANNOUNCE_NUMBER,
]);

/**
 * Pure function. Server rule for MSG_MOVE: may the non-controller learn the
 * card's identity from where it went?
 *
 * Verbatim from single_duel.cpp:
 *   if(!(cl & (LOCATION_GRAVE + LOCATION_OVERLAY))
 *       && ((cl & (LOCATION_DECK + LOCATION_HAND)) || (cp & POS_FACEDOWN)))
 *     code = 0;
 * Going to the graveyard is always public even if the card was face-down;
 * going to deck/hand or arriving face-down is private.
 *
 * Args:
 *     to (OcgLocPos): Destination of the move.
 *
 * Returns:
 *     boolean: true if the code must be hidden from the non-controller.
 *
 * Examples:
 *     >>> moveHidesCode({location: 16, position: 8})  // false  (to grave, even face-down)
 *     >>> moveHidesCode({location: 2, position: 10})  // true   (to hand)
 *     >>> moveHidesCode({location: 4, position: 8})   // true   (set face-down on field)
 *     >>> moveHidesCode({location: 4, position: 1})   // false  (face-up on field)
 */
export function moveHidesCode(to) {
  if (to.location & (OcgLocation.GRAVE | OcgLocation.OVERLAY)) return false;
  return Boolean(to.location & (OcgLocation.DECK | OcgLocation.HAND)) || Boolean(to.position & OcgPosition.FACEDOWN);
}

/**
 * Pure function. Returns the message as `viewer` is allowed to see it, or null
 * if the viewer receives nothing.
 *
 * Never mutates the input; returns a fresh copy whenever a field is masked.
 *
 * Args:
 *     msg (OcgMessage): One core message.
 *     viewer (0|1|2): Player index, or SPECTATOR for the unmasked stream.
 *
 * Returns:
 *     OcgMessage|null
 *
 * Examples:
 *     >>> maskMessage({type: 90, player: 0, drawn: [{code: 5, position: 10}]}, 1)
 *     {type: 90, player: 0, drawn: [{code: 0, position: 10}]}
 *     >>> maskMessage({type: 90, player: 0, drawn: [{code: 5, position: 10}]}, 0).drawn[0].code
 *     5
 *     >>> maskMessage({type: 11, player: 0, summons: []}, 1)   // null (not your question)
 *     >>> maskMessage({type: 54, code: 7, controller: 0}, 1)   // {type: 54, code: 0, controller: 0}
 *     >>> maskMessage({type: 15, player: 1, selects: [{code: 9, controller: 0}]}, 1).selects[0].code // 0
 */
export function maskMessage(msg, viewer) {
  if (viewer === SPECTATOR) return msg;
  const other = 1 - viewer;
  switch (msg.type) {
    case OcgMessageType.RETRY:
      return null;

    case OcgMessageType.HINT:
      if (PRIVATE_HINTS.has(msg.hint_type)) return msg.player === viewer ? msg : null;
      if (OPPONENT_HINTS.has(msg.hint_type)) return msg.player === other ? msg : null;
      if (msg.hint_type === OcgHintType.CARD) return msg;
      return null;

    case OcgMessageType.CONFIRM_CARDS: {
      // A reveal out of a DECK or EXTRA DECK is private to whoever OWNS those cards.
      // Key it on the revealed cards' controller, NEVER on msg.player: the core
      // addresses this message to the player being shown the search, and for a
      // "both players banish every copy" effect (Nobleman of Crossout) that player
      // is the OPPONENT of the deck being searched. Keying on msg.player therefore
      // handed a seat its opponent's entire deck list — and with it their exact
      // hand by elimination, which is precisely what the "unseen" pool exists to
      // prevent. Found 2026-08-17 by an agent that used it to read a hand.
      // Reveals from the hand or graveyard stay public: those happen at the table.
      const first = msg.cards[0];
      if (!first) return msg;
      const fromHiddenPile = first.location === OcgLocation.DECK || first.location === OcgLocation.EXTRA;
      if (!fromHiddenPile) return msg;
      return msg.cards.every((c) => c.controller === viewer) ? msg : null;
    }

    case OcgMessageType.SHUFFLE_HAND:
    case OcgMessageType.SHUFFLE_EXTRA:
      return msg.player === viewer ? msg : { ...msg, cards: msg.cards.map(() => 0) };

    case OcgMessageType.MOVE:
      if (msg.to.controller === viewer || !moveHidesCode(msg.to)) return msg;
      return { ...msg, card: 0 };

    case OcgMessageType.SET:
      // The server zeroes this for both players and lets the controller learn
      // the identity from the MSG_MOVE just before it. We keep the code for the
      // controller: identical information, one message instead of two.
      return msg.controller === viewer ? msg : { ...msg, code: 0 };

    case OcgMessageType.SPSUMMONING:
      if (msg.controller === viewer || !(msg.position & OcgPosition.FACEDOWN)) return msg;
      return { ...msg, code: 0 };

    case OcgMessageType.DRAW:
      if (msg.player === viewer) return msg;
      return { ...msg, drawn: msg.drawn.map((d) => (d.position & OcgPosition.FACEUP ? d : { ...d, code: 0 })) };

    case OcgMessageType.MISSED_EFFECT:
      return msg.controller === viewer ? msg : null;

    // Selection lists may include the opponent's cards (attack targets, Soul
    // Exchange tributes...). The server zeroes every entry the selecting player
    // does not control — even face-up ones — and the client re-derives names it
    // legitimately knows from its own field model. menu.js does the same.
    case OcgMessageType.SELECT_CARD:
    case OcgMessageType.SELECT_TRIBUTE:
      if (msg.player !== viewer) return null;
      return { ...msg, selects: msg.selects.map((c) => (c.controller === viewer ? c : { ...c, code: 0 })) };
    case OcgMessageType.SELECT_UNSELECT_CARD:
      if (msg.player !== viewer) return null;
      return {
        ...msg,
        select_cards: msg.select_cards.map((c) => (c.controller === viewer ? c : { ...c, code: 0 })),
        unselect_cards: msg.unselect_cards.map((c) => (c.controller === viewer ? c : { ...c, code: 0 })),
      };

    default:
      if (QUESTION_TYPES.has(msg.type)) return msg.player === viewer ? msg : null;
      return msg;
  }
}

/**
 * Pure function. Filters and masks a whole message stream for one viewer.
 *
 * Args:
 *     messages (OcgMessage[]): The omniscient stream.
 *     viewer (0|1|2): See maskMessage.
 *
 * Returns:
 *     OcgMessage[]: Only what the viewer receives, in order.
 *
 * Examples:
 *     >>> maskStream([{type: 11, player: 0}, {type: 40, player: 0}], 1)  // [{type: 40, player: 0}]
 *     >>> maskStream([{type: 11, player: 0}], 2).length                  // 1
 */
export function maskStream(messages, viewer) {
  return messages.map((m) => maskMessage(m, viewer)).filter((m) => m !== null);
}

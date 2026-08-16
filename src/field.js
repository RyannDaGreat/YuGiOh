/**
 * Client-side field model: what one viewer knows about the table, rebuilt
 * purely from the (already masked) message stream.
 *
 * This is the same job EDOPro's `client_field.cpp` does: keep a slot for every
 * card the viewer can see or knows exists (face-down cards are slots with
 * code 0), and move slots around as MSG_MOVE / MSG_DRAW / etc. arrive.
 *
 * Why it exists when the core can be queried directly:
 *   1. The log renderer needs to NAME cards that messages reference only by
 *      zone (targets, attackers, chain links). That needs a model of "what was
 *      at P1's monster zone 3 at that moment".
 *   2. It is an independent oracle: at the end of a replay it must agree with
 *      the masked core query. That cross-check is how the masking rules and
 *      this model police each other.
 *
 * Coordinates follow the core: `controller` 0|1, `location` an OcgLocation
 * bit, `sequence` the index within it. Field spell = SZONE seq 5, Pendulum
 * zones = SZONE seq 6-7, Extra Monster Zones = MZONE seq 5-6.
 */

import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";

/** Zone counts under Master Rule 5. */
export const MZONE_COUNT = 7;
export const SZONE_COUNT = 8;
export const FIELD_SPELL_SEQ = 5;
export const PZONE_FIRST_SEQ = 6;

/** Locations whose cards are kept as an ordered list rather than fixed slots. */
const LIST_LOCATIONS = { [OcgLocation.HAND]: "hand", [OcgLocation.GRAVE]: "grave", [OcgLocation.REMOVED]: "removed", [OcgLocation.EXTRA]: "extra" };

/**
 * Pure function. A card slot as the viewer knows it.
 *
 * Args:
 *     code (number): Passcode, or 0 if unknown to the viewer.
 *     position (number): OcgPosition bits.
 *
 * Returns:
 *     {code, position, overlay: Array}
 *
 * Examples:
 *     >>> makeSlot(89631139, 1) // {code: 89631139, position: 1, overlay: []}
 */
export function makeSlot(code, position) {
  return { code, position, overlay: [] };
}

/**
 * Pure function. Fresh empty model for the start of a duel.
 *
 * Args:
 *     startingLP (number): LP both players begin with.
 *     deckSizes ([number, number]): Main deck sizes per player.
 *
 * Returns:
 *     object: The field model. See module doc for shape.
 *
 * Examples:
 *     >>> createField(8000, [50, 50]).players[1].deckCount // 50
 *     >>> createField(8000, [50, 50]).players[0].mzone.length // 7
 */
export function createField(startingLP, deckSizes) {
  const player = (deckCount) => ({
    lp: startingLP,
    mzone: Array(MZONE_COUNT).fill(null),
    szone: Array(SZONE_COUNT).fill(null),
    hand: [],
    grave: [],
    removed: [],
    extra: [],
    deckCount,
  });
  return { players: [player(deckSizes[0]), player(deckSizes[1])], turn: 0, turnPlayer: null, phase: 0, winner: null, winReason: null };
}

/**
 * Pure function. Maps a core (location, sequence) onto our storage.
 *
 * Args:
 *     location (number): OcgLocation bit (OVERLAY flag stripped by caller).
 *     sequence (number): Index within the location.
 *
 * Returns:
 *     {kind: "slot"|"list"|"deck"|"none", key?: string, index?: number}
 *
 * Examples:
 *     >>> resolveLocation(4, 2)    // {kind: "slot", key: "mzone", index: 2}
 *     >>> resolveLocation(256, 0)  // {kind: "slot", key: "szone", index: 5}   (field spell zone)
 *     >>> resolveLocation(512, 1)  // {kind: "slot", key: "szone", index: 7}   (right pendulum zone)
 *     >>> resolveLocation(2, 3)    // {kind: "list", key: "hand", index: 3}
 *     >>> resolveLocation(1, 0)    // {kind: "deck"}
 *     >>> resolveLocation(0, 0)    // {kind: "none"}
 */
export function resolveLocation(location, sequence) {
  if (location === OcgLocation.MZONE) return { kind: "slot", key: "mzone", index: sequence };
  if (location === OcgLocation.SZONE) return { kind: "slot", key: "szone", index: sequence };
  if (location === OcgLocation.FZONE) return { kind: "slot", key: "szone", index: FIELD_SPELL_SEQ };
  if (location === OcgLocation.PZONE) return { kind: "slot", key: "szone", index: PZONE_FIRST_SEQ + sequence };
  if (location in LIST_LOCATIONS) return { kind: "list", key: LIST_LOCATIONS[location], index: sequence };
  if (location === OcgLocation.DECK) return { kind: "deck" };
  return { kind: "none" };
}

/**
 * Query. The slot at a core coordinate, or null. Reads the model only.
 *
 * Args:
 *     field (object): The model.
 *     loc ({controller, location, sequence, overlay_sequence?}): Coordinate.
 *
 * Returns:
 *     object|null: The slot.
 *
 * Examples:
 *     >>> // cardAt(field, {controller: 0, location: 4, sequence: 2})?.code
 */
export function cardAt(field, loc) {
  const player = field.players[loc.controller];
  if (loc.location & OcgLocation.OVERLAY) {
    const host = cardAt(field, { ...loc, location: loc.location & ~OcgLocation.OVERLAY });
    return host?.overlay[loc.overlay_sequence ?? 0] ?? null;
  }
  const where = resolveLocation(loc.location, loc.sequence);
  if (where.kind === "slot" || where.kind === "list") return player[where.key][where.index] ?? null;
  return null;
}

/**
 * Command. Detaches and returns the slot at a coordinate (mutates `field`).
 *
 * Args:
 *     field (object): The model.
 *     loc (object): Coordinate.
 *
 * Returns:
 *     object|null: The removed slot, or null if nothing was there.
 */
function takeCard(field, loc) {
  const player = field.players[loc.controller];
  if (loc.location & OcgLocation.OVERLAY) {
    const host = cardAt(field, { ...loc, location: loc.location & ~OcgLocation.OVERLAY });
    return host ? host.overlay.splice(loc.overlay_sequence ?? 0, 1)[0] ?? null : null;
  }
  const where = resolveLocation(loc.location, loc.sequence);
  if (where.kind === "slot") {
    const slot = player[where.key][where.index];
    player[where.key][where.index] = null;
    return slot;
  }
  if (where.kind === "list") return player[where.key].splice(where.index, 1)[0] ?? null;
  if (where.kind === "deck") {
    player.deckCount -= 1;
    return null;
  }
  return null;
}

/**
 * Command. Places a slot at a coordinate (mutates `field`).
 *
 * Args:
 *     field (object): The model.
 *     loc (object): Coordinate incl. position.
 *     slot (object): The slot to place.
 */
function putCard(field, loc, slot) {
  const player = field.players[loc.controller];
  slot.position = loc.position;
  if (loc.location & OcgLocation.OVERLAY) {
    const host = cardAt(field, { ...loc, location: loc.location & ~OcgLocation.OVERLAY });
    if (host) host.overlay.splice(loc.overlay_sequence ?? host.overlay.length, 0, slot);
    return;
  }
  const where = resolveLocation(loc.location, loc.sequence);
  if (where.kind === "slot") player[where.key][where.index] = slot;
  else if (where.kind === "list") player[where.key].splice(where.index, 0, slot);
  else if (where.kind === "deck") player.deckCount += 1;
}

/**
 * Command. Sets a slot's code when the message revealed one (0 = keep what
 * the viewer already knew).
 *
 * Args:
 *     slot (object|null): The slot.
 *     code (number): Revealed code, or 0.
 */
function learn(slot, code) {
  if (slot && code !== 0) slot.code = code;
}

/**
 * Command. Advances the model by one masked message. Mutates `field`.
 *
 * Messages that carry no state (targets, hints, battle announcements) are
 * ignored here; the log renderer handles their display.
 *
 * Args:
 *     field (object): The model to update.
 *     msg (OcgMessage): A message ALREADY masked for this viewer.
 *     viewer (0|1|2): Whose model this is (needed for the few messages whose
 *         knowledge effect depends on ownership but which carry no codes).
 *
 * Examples:
 *     >>> const f = createField(8000, [40, 40]);
 *     >>> applyMessage(f, {type: 90, player: 0, drawn: [{code: 5, position: 10}]}, 0);
 *     >>> f.players[0].hand.length   // 1
 *     >>> f.players[0].deckCount     // 39
 */
export function applyMessage(field, msg, viewer) {
  const T = OcgMessageType;
  switch (msg.type) {
    case T.NEW_TURN:
      field.turn += 1;
      field.turnPlayer = msg.player;
      return;
    case T.NEW_PHASE:
      field.phase = msg.phase;
      return;
    case T.DRAW: {
      const player = field.players[msg.player];
      for (const { code, position } of msg.drawn) player.hand.push(makeSlot(code, position));
      player.deckCount -= msg.drawn.length;
      return;
    }
    case T.MOVE: {
      const slot = takeCard(field, msg.from) ?? makeSlot(0, msg.to.position);
      learn(slot, msg.card);
      if (msg.to.location !== 0) putCard(field, msg.to, slot);
      return;
    }
    case T.SET:
    case T.SUMMONING:
    case T.SPSUMMONING:
    case T.FLIPSUMMONING:
    case T.CHAINING: {
      const slot = cardAt(field, msg);
      learn(slot, msg.code);
      if (slot && msg.type !== T.CHAINING) slot.position = msg.position;
      return;
    }
    case T.POS_CHANGE: {
      const slot = cardAt(field, msg);
      learn(slot, msg.code);
      if (slot) slot.position = msg.position;
      return;
    }
    case T.SWAP: {
      const a = takeCard(field, msg.card1);
      const b = takeCard(field, msg.card2);
      if (b) putCard(field, { ...msg.card1, position: b.position }, b);
      if (a) putCard(field, { ...msg.card2, position: a.position }, a);
      return;
    }
    case T.SHUFFLE_SET_CARD: {
      // Cards are permuted among their zones; the non-owner can no longer tell
      // which face-down card is which. Owners may always look at their own.
      const moved = msg.cards.map(({ from }) => takeCard(field, from));
      msg.cards.forEach(({ from, to }, i) => {
        const slot = moved[i] ?? makeSlot(0, from.position);
        if (viewer !== to.controller) slot.code = 0;
        putCard(field, { ...to, position: slot.position }, slot);
      });
      return;
    }
    case T.SHUFFLE_HAND:
    case T.SHUFFLE_EXTRA: {
      const key = msg.type === T.SHUFFLE_HAND ? "hand" : "extra";
      const list = field.players[msg.player][key];
      msg.cards.forEach((code, i) => {
        if (!list[i]) list[i] = makeSlot(0, OcgPosition.FACEDOWN_ATTACK);
        list[i].code = code;
      });
      return;
    }
    case T.CONFIRM_CARDS:
      for (const card of msg.cards) learn(cardAt(field, card), card.code);
      return;
    case T.SWAP_GRAVE_DECK: {
      const player = field.players[msg.player];
      player.deckCount += player.grave.length - msg.returned_to_extra.length;
      const returned = new Set(msg.returned_to_extra);
      for (const slot of player.grave) if (returned.has(slot.code)) player.extra.push(slot);
      player.grave = [];
      return;
    }
    case T.REMOVE_CARDS:
      for (const loc of msg.cards) takeCard(field, loc);
      return;
    case T.LPUPDATE:
      field.players[msg.player].lp = msg.lp;
      return;
    case T.DAMAGE:
    case T.PAY_LPCOST:
      field.players[msg.player].lp -= msg.amount;
      return;
    case T.RECOVER:
      field.players[msg.player].lp += msg.amount;
      return;
    case T.WIN:
      field.winner = msg.player;
      field.winReason = msg.reason;
      return;
    default:
      return;
  }
}

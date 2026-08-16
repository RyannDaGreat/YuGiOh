/**
 * YGN — the text duel log.
 *
 * Turns a masked message stream into one compact, human- and LLM-readable line
 * per event. Chess has algebraic notation; this is the equivalent for a duel.
 * The reader must be able to reconstruct everything they are entitled to know
 * from the log alone.
 *
 * Format at a glance:
 *     == Turn 2 (P1) ==                    turn header
 *     -- Main Phase 1                      phase marker
 *     P1 draws 1 card                      (opponent's draws are counted, not named)
 *     P1 sets a monster at m3              face-down cards of the opponent are anonymous
 *     P1 activates Dark Hole from hand (s2) [chain 1]
 *     >> chain 1 resolves: Dark Hole
 *     Trap Master: P1 m3 (fd DEF) -> P1 GY   a move line: name, from, to
 *     Rude Kaiser (P0 m4) attacks Sorcerer of the Doomed (P1 m2)
 *       battle: Rude Kaiser 1800 ATK vs Sorcerer of the Doomed 1450 ATK: Sorcerer of the Doomed destroyed
 *     P1 takes 350 damage (LP 8000 -> 7650)
 *
 * Vocabulary: `P0`/`P1` players (absolute — the same log line reads identically
 * for both viewers, only the hidden names differ); `m0..m6` monster zones;
 * `s0..s4` spell/trap zones, `field` the field spell zone, `pz0/pz1` pendulum
 * zones; `hand`, `GY`, `banished`, `deck`, `extra`; `?` an unknown card;
 * `ATK`/`DEF`/`fd ATK`/`fd DEF`/`fd`/`up` positions.
 */

import { OcgCardHintType, OcgHintType, OcgLocation, OcgMessageType, OcgPhase, OcgPlayerHintType, OcgPosition } from "ocgcore-wasm";
import { cardName } from "./cards.js";
import { applyMessage, cardAt, createField, FIELD_SPELL_SEQ, PZONE_FIRST_SEQ } from "./field.js";
import { counterName, describe, sysString, victoryString } from "./strings.js";

const T = OcgMessageType;

/** Phases worth a marker line. Battle sub-steps are noise and are skipped. */
const PHASE_LABELS = {
  [OcgPhase.DRAW]: "Draw Phase",
  [OcgPhase.STANDBY]: "Standby Phase",
  [OcgPhase.MAIN1]: "Main Phase 1",
  [OcgPhase.BATTLE_START]: "Battle Phase",
  [OcgPhase.MAIN2]: "Main Phase 2",
  [OcgPhase.END]: "End Phase",
};

/** Messages that immediately follow a MOVE and describe the same event better. */
const MOVE_FOLLOWERS = new Set([T.SET, T.SUMMONING, T.SPSUMMONING, T.CHAINING]);

/**
 * Pure function. Name a card code as the viewer knows it.
 *
 * Args:
 *     code (number): Passcode, 0 if unknown.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> nameOf(89631139) // "Blue-Eyes White Dragon"
 *     >>> nameOf(0)        // "?"
 */
export function nameOf(code) {
  return code === 0 ? "?" : cardName(code);
}

/**
 * Pure function. Short zone label for a location/sequence.
 *
 * Args:
 *     location (number): OcgLocation bit.
 *     sequence (number): Index within it.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> zoneLabel(4, 2)   // "m2"
 *     >>> zoneLabel(8, 5)   // "field"
 *     >>> zoneLabel(8, 6)   // "pz0"
 *     >>> zoneLabel(16, 3)  // "GY"
 *     >>> zoneLabel(2, 0)   // "hand"
 */
export function zoneLabel(location, sequence) {
  switch (location & ~OcgLocation.OVERLAY) {
    case OcgLocation.MZONE: return `m${sequence}`;
    case OcgLocation.SZONE:
      if (sequence === FIELD_SPELL_SEQ) return "field";
      if (sequence >= PZONE_FIRST_SEQ) return `pz${sequence - PZONE_FIRST_SEQ}`;
      return `s${sequence}`;
    case OcgLocation.FZONE: return "field";
    case OcgLocation.PZONE: return `pz${sequence}`;
    case OcgLocation.HAND: return "hand";
    case OcgLocation.GRAVE: return "GY";
    case OcgLocation.REMOVED: return "banished";
    case OcgLocation.DECK: return "deck";
    case OcgLocation.EXTRA: return "extra";
    default: return `loc${location}`;
  }
}

/**
 * Pure function. Position label. Spells/traps only distinguish face-up/down.
 *
 * Args:
 *     position (number): OcgPosition bits.
 *     isMonsterZone (boolean): Whether ATK/DEF applies.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> posLabel(1, true)   // "ATK"
 *     >>> posLabel(8, true)   // "fd DEF"
 *     >>> posLabel(10, false) // "fd"
 *     >>> posLabel(5, false)  // "up"
 */
export function posLabel(position, isMonsterZone) {
  if (!isMonsterZone) return position & OcgPosition.FACEUP ? "up" : "fd";
  const faceDown = position & OcgPosition.FACEDOWN ? "fd " : "";
  return `${faceDown}${position & OcgPosition.ATTACK ? "ATK" : "DEF"}`;
}

/**
 * Pure function. "P1 m3" — a place on the table.
 *
 * Args:
 *     loc ({controller, location, sequence}): Coordinate.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> place({controller: 1, location: 4, sequence: 3}) // "P1 m3"
 *     >>> place({controller: 0, location: 16, sequence: 0}) // "P0 GY"
 */
export function place(loc) {
  return `P${loc.controller} ${zoneLabel(loc.location, loc.sequence)}`;
}

/**
 * Pure function. "P1 m3 (fd DEF)" — a place with position when on the field.
 *
 * Args:
 *     loc ({controller, location, sequence, position}): Coordinate.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> placePos({controller: 0, location: 4, sequence: 2, position: 8})  // "P0 m2 (fd DEF)"
 *     >>> placePos({controller: 0, location: 16, sequence: 2, position: 5}) // "P0 GY"
 */
export function placePos(loc) {
  const onField = loc.location & (OcgLocation.MZONE | OcgLocation.SZONE | OcgLocation.FZONE | OcgLocation.PZONE);
  if (!onField) return place(loc);
  return `${place(loc)} (${posLabel(loc.position, loc.location === OcgLocation.MZONE)})`;
}

/**
 * Pure function. Renders one viewer's masked stream as YGN lines.
 *
 * Args:
 *     messages (OcgMessage[]): Masked for the viewer (see view.js).
 *     opts ({viewer: number, startingLP: number, deckSizes: [number, number]})
 *
 * Returns:
 *     {lines: string[], field: object}: The log and the final field model.
 *
 * Examples:
 *     >>> renderLog([{type: 40, player: 0}, {type: 41, phase: 4}], {viewer: 0, startingLP: 8000, deckSizes: [50, 50]}).lines
 *     ["== Duel start ==", "== Turn 1 (P0) ==", "-- Main Phase 1"]
 */
export function renderLog(messages, { viewer, startingLP, deckSizes }) {
  const field = createField(startingLP, deckSizes);
  const lines = [];
  const chain = []; // chain link names by index (chain_size - 1)

  // "Name (P1 m3)" for a coordinate, using what the viewer's field model knows.
  const named = (loc) => `${nameOf(cardAt(field, loc)?.code ?? 0)} (${place(loc)})`;

  lines.push("== Duel start ==");
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const next = messages[i + 1];
    const emit = (line) => lines.push(line);
    const sameSpot = (a, b) => a && b && a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;

    switch (msg.type) {
      case T.NEW_TURN:
        applyMessage(field, msg, viewer);
        emit(`== Turn ${field.turn} (P${msg.player}) ==`);
        continue;
      case T.NEW_PHASE:
        applyMessage(field, msg, viewer);
        if (PHASE_LABELS[msg.phase]) emit(`-- ${PHASE_LABELS[msg.phase]}`);
        continue;
      case T.DRAW: {
        applyMessage(field, msg, viewer);
        const names = msg.drawn.map((d) => nameOf(d.code));
        const allHidden = msg.drawn.every((d) => d.code === 0);
        emit(allHidden ? `P${msg.player} draws ${names.length} card${names.length === 1 ? "" : "s"}` : `P${msg.player} draws ${names.join(", ")}`);
        continue;
      }
      case T.MOVE: {
        const fromText = placePos(msg.from);
        applyMessage(field, msg, viewer);
        // The follower message (set/summon/activate) narrates this move better.
        if (next && MOVE_FOLLOWERS.has(next.type) && sameSpot(next, msg.to)) continue;
        if (msg.to.location === 0) {
          emit(`${nameOf(msg.card)}: ${fromText} -> removed from play entirely`);
        } else {
          emit(`${nameOf(msg.card)}: ${fromText} -> ${placePos(msg.to)}`);
        }
        continue;
      }
      case T.SET: {
        applyMessage(field, msg, viewer);
        const isMonster = msg.location === OcgLocation.MZONE;
        const what = msg.code === 0 ? (isMonster ? "a monster" : "a card") : nameOf(msg.code);
        emit(`P${msg.controller} sets ${what} at ${zoneLabel(msg.location, msg.sequence)}`);
        continue;
      }
      case T.SUMMONING:
        applyMessage(field, msg, viewer);
        emit(`P${msg.controller} normal summons ${nameOf(msg.code)} at ${zoneLabel(msg.location, msg.sequence)} ${posLabel(msg.position, true)}`);
        continue;
      case T.SPSUMMONING: {
        const prev = messages[i - 1];
        const from = prev?.type === T.MOVE && sameSpot(prev.to, msg) ? ` from ${zoneLabel(prev.from.location, prev.from.sequence)}` : "";
        applyMessage(field, msg, viewer);
        emit(`P${msg.controller} special summons ${nameOf(msg.code)} at ${zoneLabel(msg.location, msg.sequence)} ${posLabel(msg.position, true)}${from}`);
        continue;
      }
      case T.FLIPSUMMONING:
        applyMessage(field, msg, viewer);
        emit(`P${msg.controller} flip summons ${nameOf(msg.code)} (${zoneLabel(msg.location, msg.sequence)}) -> ${posLabel(msg.position, true)}`);
        continue;
      case T.POS_CHANGE: {
        applyMessage(field, msg, viewer);
        // Flipping a set spell/trap face-up to activate it is part of the activation line.
        if (next?.type === T.CHAINING && sameSpot(next, msg)) continue;
        const isMonster = msg.location === OcgLocation.MZONE;
        emit(`${nameOf(msg.code)} (P${msg.controller} ${zoneLabel(msg.location, msg.sequence)}): ${posLabel(msg.prev_position, isMonster)} -> ${posLabel(msg.position, isMonster)}`);
        continue;
      }
      case T.CHAINING: {
        const prev = messages[i - 1];
        const cameFrom = prev?.type === T.MOVE && sameSpot(prev.to, msg) ? ` from ${zoneLabel(prev.from.location, prev.from.sequence)}` : "";
        applyMessage(field, msg, viewer);
        chain[msg.chain_size - 1] = nameOf(msg.code);
        const effect = describe(msg.description);
        const where = `${cameFrom} (${zoneLabel(msg.location, msg.sequence)})`;
        emit(`P${msg.triggering_controller} activates ${nameOf(msg.code)}${where} [chain ${msg.chain_size}]${effect ? `: ${effect}` : ""}`);
        continue;
      }
      case T.CHAIN_SOLVING:
        emit(`>> chain ${msg.chain_size} resolves: ${chain[msg.chain_size - 1] ?? "?"}`);
        continue;
      case T.CHAIN_NEGATED:
        emit(`>> chain ${msg.chain_size} negated: ${chain[msg.chain_size - 1] ?? "?"}`);
        continue;
      case T.CHAIN_DISABLED:
        emit(`>> chain ${msg.chain_size} effect disabled: ${chain[msg.chain_size - 1] ?? "?"}`);
        continue;
      case T.CHAIN_END:
        chain.length = 0;
        continue;
      case T.BECOME_TARGET:
        emit(`  targets ${msg.cards.map(named).join(", ")}`);
        continue;
      case T.CARD_TARGET:
        emit(`${named(msg.card)} targets ${named(msg.target)}`);
        continue;
      case T.CANCEL_TARGET:
        emit(`${named(msg.card)} no longer targets ${named(msg.target)}`);
        continue;
      case T.EQUIP:
        emit(`${named(msg.card)} equipped to ${named(msg.target)}`);
        continue;
      case T.ATTACK: {
        emit(msg.target ? `${named(msg.card)} attacks ${named(msg.target)}` : `${named(msg.card)} attacks directly`);
        continue;
      }
      case T.BATTLE: {
        if (!msg.target || msg.target.location === 0) continue;
        const stat = (c) => (c.position & OcgPosition.ATTACK ? `${c.attack} ATK` : `${c.defense} DEF`);
        const a = `${nameOf(cardAt(field, msg.card)?.code ?? 0)} ${stat(msg.card)}`;
        const b = `${nameOf(cardAt(field, msg.target)?.code ?? 0)} ${stat(msg.target)}`;
        const outcome = msg.card.destroyed && msg.target.destroyed ? "both destroyed"
          : msg.card.destroyed ? `${nameOf(cardAt(field, msg.card)?.code ?? 0)} destroyed`
          : msg.target.destroyed ? `${nameOf(cardAt(field, msg.target)?.code ?? 0)} destroyed`
          : "no destruction";
        emit(`  battle: ${a} vs ${b}: ${outcome}`);
        continue;
      }
      case T.ATTACK_DISABLED:
        emit("  attack negated");
        continue;
      case T.DAMAGE: {
        const before = field.players[msg.player].lp;
        applyMessage(field, msg, viewer);
        emit(`P${msg.player} takes ${msg.amount} damage (LP ${before} -> ${field.players[msg.player].lp})`);
        continue;
      }
      case T.RECOVER: {
        const before = field.players[msg.player].lp;
        applyMessage(field, msg, viewer);
        emit(`P${msg.player} gains ${msg.amount} LP (LP ${before} -> ${field.players[msg.player].lp})`);
        continue;
      }
      case T.PAY_LPCOST: {
        const before = field.players[msg.player].lp;
        applyMessage(field, msg, viewer);
        emit(`P${msg.player} pays ${msg.amount} LP (LP ${before} -> ${field.players[msg.player].lp})`);
        continue;
      }
      case T.LPUPDATE:
        applyMessage(field, msg, viewer);
        emit(`P${msg.player} LP becomes ${msg.lp}`);
        continue;
      case T.SHUFFLE_HAND:
        applyMessage(field, msg, viewer);
        emit(`P${msg.player} shuffles hand`);
        continue;
      case T.SHUFFLE_DECK:
        emit(`P${msg.player} shuffles deck`);
        continue;
      case T.CONFIRM_CARDS:
        emit(`P${msg.player} reveals ${msg.cards.map((c) => `${nameOf(c.code)} (${place(c)})`).join(", ")}`);
        applyMessage(field, msg, viewer);
        continue;
      case T.CONFIRM_DECKTOP:
        emit(`P${msg.player} reveals top of deck: ${msg.cards.map((c) => nameOf(c.code)).join(", ")}`);
        continue;
      case T.CONFIRM_EXTRATOP:
        emit(`P${msg.player} reveals from extra deck: ${msg.cards.map((c) => nameOf(c.code)).join(", ")}`);
        continue;
      case T.RANDOM_SELECTED:
        emit(`  randomly selected: ${msg.cards.map(named).join(", ")}`);
        continue;
      case T.TOSS_COIN:
        emit(`P${msg.player} tosses coin: ${msg.results.map((heads) => (heads ? "heads" : "tails")).join(", ")}`);
        continue;
      case T.TOSS_DICE:
        emit(`P${msg.player} rolls dice: ${msg.results.join(", ")}`);
        continue;
      case T.HINT:
        if (msg.hint_type === OcgHintType.MESSAGE) emit(`note: ${describe(msg.hint)}`);
        else if (msg.hint_type === OcgHintType.OPSELECTED) emit(`  choice made: ${describe(msg.hint)}`);
        else if (msg.hint_type === OcgHintType.CODE) emit(`  declared: ${nameOf(Number(msg.hint))}`);
        else if (msg.hint_type === OcgHintType.NUMBER) emit(`  declared: ${msg.hint}`);
        else if (msg.hint_type === OcgHintType.RACE) emit(`  declared type: ${msg.hint}`);
        else if (msg.hint_type === OcgHintType.ATTRIB) emit(`  declared attribute: ${msg.hint}`);
        continue;
      case T.CARD_HINT: {
        const who = named(msg);
        if (msg.card_hint === OcgCardHintType.DESC_ADD) emit(`${who} gains: ${describe(msg.description)}`);
        else if (msg.card_hint === OcgCardHintType.DESC_REMOVE) emit(`${who} loses: ${describe(msg.description)}`);
        else if (msg.card_hint === OcgCardHintType.CARD) emit(`${who} is treated as ${nameOf(Number(msg.description))}`);
        else if (msg.card_hint === OcgCardHintType.TURN) emit(`${who} turn counter: ${msg.description}`);
        else if (msg.card_hint === OcgCardHintType.NUMBER) emit(`${who} number: ${msg.description}`);
        continue;
      }
      case T.PLAYER_HINT:
        if (msg.player_hint === OcgPlayerHintType.DESC_ADD) emit(`P${msg.player} is under: ${describe(msg.description)}`);
        else if (msg.player_hint === OcgPlayerHintType.DESC_REMOVE) emit(`P${msg.player} no longer under: ${describe(msg.description)}`);
        continue;
      case T.ADD_COUNTER:
        emit(`${named(msg)} gets ${msg.count} ${counterName(msg.counter_type)}`);
        continue;
      case T.REMOVE_COUNTER:
        emit(`${named(msg)} loses ${msg.count} ${counterName(msg.counter_type)}`);
        continue;
      case T.MISSED_EFFECT:
        emit(`${nameOf(msg.code)} (P${msg.controller} ${zoneLabel(msg.location, msg.sequence)}) missed the timing for its effect`);
        continue;
      case T.SWAP: {
        const line = `${named(msg.card1)} and ${named(msg.card2)} swap places`;
        applyMessage(field, msg, viewer);
        emit(line);
        continue;
      }
      case T.WIN:
        applyMessage(field, msg, viewer);
        emit(msg.player === 2 ? `== DRAW (${victoryString(msg.reason)}) ==` : `== P${msg.player} WINS (${victoryString(msg.reason)}) ==`);
        continue;
      case T.SHUFFLE_SET_CARD:
        applyMessage(field, msg, viewer);
        emit(`P${msg.cards[0]?.from.controller ?? "?"} shuffles set cards`);
        continue;
      case T.SWAP_GRAVE_DECK:
        applyMessage(field, msg, viewer);
        emit(`P${msg.player} swaps graveyard and deck`);
        continue;
      case T.REMOVE_CARDS:
      case T.SHUFFLE_EXTRA:
        applyMessage(field, msg, viewer);
        continue;
      case T.REVERSE_DECK:
        emit("decks are turned face-up");
        continue;
      case T.DECK_TOP:
        emit(`P${msg.player} deck top: ${nameOf(msg.code)}`);
        continue;
      default:
        applyMessage(field, msg, viewer);
        continue;
    }
  }
  return { lines, field };
}

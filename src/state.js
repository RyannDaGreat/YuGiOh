/**
 * Full game state from one viewer's perspective — as data (for the UI) and as
 * text (for the CLI and for LLM prompts).
 *
 * Reads the live core (authoritative: current ATK/DEF after modifiers, equips,
 * counters, chain) and applies the visibility rules EDOPro's server uses for
 * its field refreshes (`CoreUtils::Query::IsPublicQuery`): a card's identity is
 * shown if the viewer controls it, or it is face-up, or the core flags it
 * public. Everything else is a `?` with only its position known.
 *
 * The viewer's own memory counts too: a face-down card that was revealed
 * earlier (De-Spell flipping a trap, a Book of Moon on a known monster) stays
 * known even though the core marks it non-public. That knowledge lives in the
 * viewer's field model (field.js), consulted for every hidden slot — exactly
 * what EDOPro's client does when it merges refresh data onto the card objects
 * it already holds.
 *
 * Both decklists are public knowledge (a rule of this harness, mirroring a
 * tournament with registered lists). So the state also lists, per player, the
 * cards NOT visible to the viewer: for the viewer's own deck that is exactly
 * the deck contents (order withheld); for the opponent it is "hand + deck +
 * face-downs" as one unordered pool — what a competent human tracks.
 */

import { OcgLocation, OcgPhase, OcgPosition, OcgQueryFlags } from "ocgcore-wasm";
import { cardInfo, cardName, isPendulumMonster, scaleText, typeLabel } from "./cards.js";
import { coord } from "./events.js";
import { cardAt } from "./field.js";
import { posLabel, zoneLabel } from "./log.js";
import { SPECTATOR } from "./view.js";

// OcgQueryFlags.TYPE is deliberately absent: ocgcore-wasm 0.1.2 mis-parses it
// and returns null for the whole card. Card type comes from cards.cdb instead.
const QUERY_ALL = OcgQueryFlags.CODE | OcgQueryFlags.POSITION | OcgQueryFlags.ALIAS
  | OcgQueryFlags.LEVEL | OcgQueryFlags.RANK | OcgQueryFlags.ATTRIBUTE | OcgQueryFlags.RACE
  | OcgQueryFlags.ATTACK | OcgQueryFlags.DEFENSE | OcgQueryFlags.BASE_ATTACK | OcgQueryFlags.BASE_DEFENSE
  | OcgQueryFlags.EQUIP_CARD | OcgQueryFlags.TARGET_CARD | OcgQueryFlags.OVERLAY_CARD | OcgQueryFlags.COUNTERS
  | OcgQueryFlags.OWNER | OcgQueryFlags.STATUS | OcgQueryFlags.IS_PUBLIC | OcgQueryFlags.LSCALE
  | OcgQueryFlags.RSCALE | OcgQueryFlags.LINK | OcgQueryFlags.IS_HIDDEN;

// Card status bits from the core (ygopro-core `ocgapi_constants.h`; the wasm's
// QUERY_STATUS returns the raw `card::status` word). Verified empirically against
// ocgcore-wasm 0.1.2 — see concerns.md 2026-08-18.
/** Effects negated. */
const STATUS_DISABLED = 0x1;
/** Spell/Trap Set this turn — a Trap or Quick-Play Spell so marked cannot be activated this turn. Cleared at the turn change. */
const STATUS_SET_TURN = 0x10;
/** Battle position changed this turn; the core stamps it on a monster Set from hand, which is what forbids Flip Summoning it this turn. Cleared at the turn change. */
const STATUS_FORM_CHANGED = 0x100;
/** Normal Summoned this turn. */
const STATUS_SUMMON_TURN = 0x800;
/** Flip Summoned this turn. */
const STATUS_FLIP_SUMMON_TURN = 0x20000000;
/** Special Summoned this turn. */
const STATUS_SPSUMMON_TURN = 0x40000000;

const PHASE_NAMES = {
  [OcgPhase.DRAW]: "Draw Phase", [OcgPhase.STANDBY]: "Standby Phase", [OcgPhase.MAIN1]: "Main Phase 1",
  [OcgPhase.BATTLE_START]: "Battle Phase (start)", [OcgPhase.BATTLE_STEP]: "Battle Phase (battle step)",
  [OcgPhase.DAMAGE]: "Battle Phase (damage step)", [OcgPhase.DAMAGE_CAL]: "Battle Phase (damage calc)",
  [OcgPhase.BATTLE]: "Battle Phase (end step)", [OcgPhase.MAIN2]: "Main Phase 2", [OcgPhase.END]: "End Phase",
};

/**
 * Pure function. May `viewer` see this card's identity? (EDOPro's IsPublicQuery.)
 *
 * Args:
 *     card (OcgCardQueryInfo): Queried card, with position/isPublic/isHidden.
 *     controller (number): Who controls the location it sits in.
 *     location (number): OcgLocation bit.
 *     viewer (0|1|2): Player index or SPECTATOR.
 *
 * Returns:
 *     boolean
 *
 * Examples:
 *     >>> isVisible({position: 8}, 0, 4, 0)                 // true   (own face-down monster)
 *     >>> isVisible({position: 8}, 0, 4, 1)                 // false  (opponent's face-down monster)
 *     >>> isVisible({position: 1}, 0, 4, 1)                 // true   (face-up)
 *     >>> isVisible({position: 10}, 0, 2, 1)                // false  (opponent's hand)
 *     >>> isVisible({position: 5}, 0, 16, 1)                // true   (graveyard is public)
 *     >>> isVisible({position: 8, isHidden: true}, 0, 4, 0) // false  (hidden even from controller)
 */
export function isVisible(card, controller, location, viewer) {
  if (viewer === SPECTATOR) return true;
  if (card.isHidden) return false;
  if (viewer === controller) return true;
  if (location === OcgLocation.GRAVE) return true;
  return Boolean(card.isPublic) || Boolean(card.position & OcgPosition.FACEUP);
}

/**
 * Query. All cards in one location of one player, straight from the core.
 *
 * Args:
 *     core, handle: Live duel.
 *     controller (0|1): Player.
 *     location (number): OcgLocation bit.
 *
 * Returns:
 *     Array<OcgCardQueryInfo|null>: Index = sequence. Zones keep null for empty
 *     slots; list locations (hand, GY, deck...) are dense. Deck order is real
 *     here — callers must never expose it.
 */
export function queryLocation(core, handle, controller, location) {
  return core.duelQueryLocation(handle, { flags: QUERY_ALL, controller, location });
}

/**
 * Pure function. Multiset difference of card names: `deck` minus `seen`.
 *
 * Args:
 *     deckCodes (number[]): Every passcode in the registered decklist.
 *     seenCodes (number[]): Passcodes visible to the viewer, owned by that player.
 *
 * Returns:
 *     string[]: Sorted names of the cards not yet accounted for.
 *
 * Examples:
 *     >>> unseenNames([1, 1, 2], [1])            // [name(1), name(2)] sorted
 *     >>> unseenNames([5], [5]).length           // 0
 */
export function unseenNames(deckCodes, seenCodes) {
  const remaining = new Map();
  for (const code of deckCodes) remaining.set(code, (remaining.get(code) ?? 0) + 1);
  for (const code of seenCodes) if (remaining.get(code) > 0) remaining.set(code, remaining.get(code) - 1);
  const names = [];
  for (const [code, count] of remaining) for (let i = 0; i < count; i++) names.push(cardName(code));
  return names.sort();
}

/**
/**
 * Pure function. Normalises a queried card's counters to `{type: count}`.
 *
 * ocgcore-wasm's QUERY_COUNTERS parser stores each counter BACKWARDS — keyed by
 * the count with the type as the value (`t.counters[count] = type`) — so a card
 * with 7 Spell Counters (type 1) comes back as `{7: 1}` instead of `{1: 7}`,
 * which makes a counter badge read "1" no matter how high it climbs. We swap it
 * back here. (Two counter types with the SAME count would already have collided
 * inside the wasm before we see them; that rare case is unrecoverable and lost.)
 *
 * Args:
 *     raw (object): The wasm's `card.counters`, keyed by count → type.
 *
 * Returns:
 *     object: `{type: count}`.
 *
 * Examples:
 *     >>> normalizeCounters({7: 1})   // {1: 7}  (7 Spell Counters)
 *     >>> normalizeCounters({14: 1})  // {1: 14}
 */
function normalizeCounters(raw) {
  const out = {};
  for (const [count, type] of Object.entries(raw)) out[type] = Number(count);
  return out;
}

/**
 * Pure function. A field card as data, identity withheld when not known.
 *
 * Args:
 *     card (OcgCardQueryInfo): Queried card.
 *     known (boolean): Whether the viewer may identify it.
 *     isMonsterZone (boolean): Zone type.
 *
 * Returns:
 *     {name: string|null, code: number, position: string, faceDown: boolean, negated: boolean,
 *      setThisTurn: boolean, summonedThisTurn: boolean,
 *      atk?, def?, baseAtk?, baseDef?, level?, rank?, link?, typeLabel?, scale?: string,
 *      equippedTo?: string, targets?: string[], materials?: string[], counters?: object}
 *     `scale` is set only for a Pendulum Monster sitting in a spell/trap zone —
 *     that is a Pendulum Zone, where the scale is the card's whole point.
 *     `setThisTurn` / `summonedThisTurn` are public information (everyone saw the
 *     card go down), so they are filled in even when the identity is withheld.
 *
 * Examples:
 *     >>> fieldCardData({code: 89631139, position: 1, attack: 3000, defense: 2500, baseAttack: 3000, baseDefense: 2500, level: 8}, true, true).name
 *     "Blue-Eyes White Dragon"
 *     >>> fieldCardData({position: 8, status: 0}, false, true)
 *     {name: null, code: 0, position: "fd DEF", faceDown: true, negated: false, setThisTurn: false, summonedThisTurn: false}
 *     >>> fieldCardData({position: 10, status: 0x10}, false, false).setThisTurn   // true  (opponent's trap, Set this turn)
 *     >>> fieldCardData({position: 8, status: 0x100}, false, true).setThisTurn    // true  (opponent's monster, Set this turn)
 *     >>> fieldCardData({code: 91584698, position: 5}, true, false).scale  // "4" (Performapal Trump Witch in a Pendulum Zone)
 */
export function fieldCardData(card, known, isMonsterZone) {
  const faceDown = Boolean(card.position & OcgPosition.FACEDOWN);
  const base = {
    name: known ? cardName(card.code) : null,
    code: known ? card.code : 0,
    position: posLabel(card.position, isMonsterZone),
    faceDown,
    negated: false,
    setThisTurn: faceDown && Boolean(card.status & (isMonsterZone ? STATUS_FORM_CHANGED : STATUS_SET_TURN)),
    summonedThisTurn: Boolean(card.status & (STATUS_SUMMON_TURN | STATUS_FLIP_SUMMON_TURN | STATUS_SPSUMMON_TURN)),
  };
  if (!known) return base;
  const info = cardInfo(card.code);
  const data = { ...base, negated: Boolean(card.status & STATUS_DISABLED), typeLabel: typeLabel(info?.type ?? 0) };
  if (isMonsterZone) {
    Object.assign(data, { atk: card.attack, def: card.defense, baseAtk: card.baseAttack, baseDef: card.baseDefense, level: card.level, rank: card.rank, link: card.link?.rating ?? 0 });
  } else if (isPendulumMonster(card.code)) {
    // A Pendulum Monster in a spell/trap zone is a scale in a Pendulum Zone.
    // The scale is the printed one (cards.cdb), not the core's: ocgcore-wasm
    // does not deliver rscale to the engine, so the queried rightScale is 0 for
    // every card (see claude_instructions.md "Pendulum scales").
    data.scale = scaleText(info.lscale, info.rscale);
  }
  if (card.equipCard) {
    data.equippedTo = zoneLabel(card.equipCard.location, card.equipCard.sequence);
    // {p,zone,seq} of the linked card, so the client can draw a relationship line
    // to its slot (the label above is for text; this is for the visual overlay).
    data.equipTarget = coord(card.equipCard);
  }
  if (card.targetCards?.length) data.targets = card.targetCards.map((t) => `P${t.controller} ${zoneLabel(t.location, t.sequence)}`);
  if (card.overlayCards?.length) data.materials = card.overlayCards.map(cardName);
  if (card.counters && Object.keys(card.counters).length) data.counters = normalizeCounters(card.counters);
  return data;
}

/**
 * Query. Gathers the whole visible state for `viewer` as plain data.
 *
 * Args:
 *     core, handle: Live duel after replay.
 *     opts.viewer (0|1|2)
 *     opts.deckNames ([string, string]): Labels for the two decklists.
 *     opts.deckCodes ([number[], number[]]): The registered decklists as passcodes.
 *     opts.format ("classic"|"goat"): The duel's ruleset; defaults to "classic".
 *     opts.model (object): The viewer's field model (field.js) — turn/phase,
 *         remembered card identities, winner/winReason once the duel is over.
 *
 * Returns:
 *     {viewer, format, turn, turnPlayer, phaseName, winner: number|null, players: [PlayerState, PlayerState], chain: [{name, place}]}
 *     PlayerState = {index, deckName, lp, handCount, deckCount, graveCount, banishCount, extraCount,
 *                    mzone: (FieldCard|null)[7], szone: (FieldCard|null)[8],
 *                    hand/grave/removed/extra: Array<{name: string|null, code: number}>  (null/0 = not identifiable),
 *                    extra entries also carry faceUp: boolean (a Pendulum returned face-up is public),
 *                    unseenKind: "deck"|"pool", unseen: string[]}
 */
export function collectState(core, handle, { viewer, deckNames, deckCodes, model, format = "classic" }) {
  const field = core.duelQueryField(handle);
  const known = (card, controller, location, sequence) => isVisible(card, controller, location, viewer)
    || (cardAt(model, { controller, location, sequence })?.code ?? 0) !== 0;
  // {name, code} for list locations; identity withheld (null/0) when not known.
  const entry = (controller, location) => (card, seq) => (known(card, controller, location, seq) ? { name: cardName(card.code), code: card.code } : { name: null, code: 0 });
  // Extra Deck entries also say whether the card lies face-up there: a Pendulum
  // Monster that left the field (or was used as material) returns face-up and is
  // public, re-summonable knowledge — quite different from the face-down Extra
  // Deck proper, which the opponent never sees. Both live in the same pile.
  const extraEntry = (controller) => (card, seq) => ({ ...entry(controller, OcgLocation.EXTRA)(card, seq), faceUp: Boolean(card.position & OcgPosition.FACEUP) });

  const players = [0, 1].map((p) => {
    const fp = field.players[p];
    const zone = (location) => queryLocation(core, handle, p, location).map((card, seq) => (card ? fieldCardData(card, known(card, p, location, seq), location === OcgLocation.MZONE) : null));
    const dense = (location) => queryLocation(core, handle, p, location).filter(Boolean);
    let unseenKind;
    let unseen;
    if (viewer === p || viewer === SPECTATOR) {
      unseenKind = "deck";
      unseen = dense(OcgLocation.DECK).map((c) => cardName(c.code)).sort();
    } else {
      const seen = [];
      for (const location of [OcgLocation.MZONE, OcgLocation.SZONE, OcgLocation.HAND, OcgLocation.GRAVE, OcgLocation.REMOVED, OcgLocation.EXTRA]) {
        for (const owner of [0, 1]) {
          queryLocation(core, handle, owner, location).forEach((c, seq) => {
            if (c && c.owner === p && known(c, owner, location, seq)) seen.push(c.code);
          });
        }
      }
      unseenKind = "pool";
      unseen = unseenNames(deckCodes[p], seen);
    }
    return {
      index: p,
      deckName: deckNames[p],
      lp: fp.lp | 0, // the binding reads the core's int32 LP as uint32; negative LP must stay negative
      handCount: fp.hand_size,
      deckCount: fp.deck_size,
      graveCount: fp.grave_size,
      banishCount: fp.banish_size,
      extraCount: fp.extra_size,
      mzone: zone(OcgLocation.MZONE),
      szone: zone(OcgLocation.SZONE),
      hand: dense(OcgLocation.HAND).map(entry(p, OcgLocation.HAND)),
      grave: dense(OcgLocation.GRAVE).map((c) => ({ name: cardName(c.code), code: c.code })),
      removed: dense(OcgLocation.REMOVED).map(entry(p, OcgLocation.REMOVED)),
      extra: dense(OcgLocation.EXTRA).map(extraEntry(p)),
      unseenKind,
      unseen,
    };
  });

  return {
    viewer,
    format,
    turn: model.turn,
    turnPlayer: model.turnPlayer,
    phaseName: PHASE_NAMES[model.phase] ?? "start",
    winner: model.winner,
    players,
    chain: field.chain.map((link) => ({ name: cardName(link.code), place: `P${link.controller} ${zoneLabel(link.location, link.sequence)}` })),
  };
}

/**
 * Pure function. One line for a field card from its data.
 *
 * Args:
 *     c (object): From fieldCardData.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> describeFieldCard({name: null, position: "fd DEF"})                          // "? (fd DEF)"
 *     >>> describeFieldCard({name: null, position: "fd", setThisTurn: true})           // "? (fd) (set this turn)"
 *     >>> describeFieldCard({name: "Trap Hole", position: "fd", typeLabel: "Trap"})     // "Trap Hole (fd, Trap)"
 *     >>> describeFieldCard({name: "Trap Hole", position: "fd", typeLabel: "Trap", setThisTurn: true})
 *     "Trap Hole (fd, Trap) (set this turn)"
 *     >>> describeFieldCard({name: "Battle Ox", position: "ATK", atk: 1700, def: 1000, baseAtk: 1700, baseDef: 1000, level: 4})
 *     "Battle Ox ATK 1700/1000 Lv4"
 *     >>> describeFieldCard({name: "Performapal Trump Witch", position: "up", typeLabel: "Effect Pendulum Monster", scale: "4"})
 *     "Performapal Trump Witch (up, Effect Pendulum Monster, scale 4)"
 */
export function describeFieldCard(c) {
  const setNote = c.setThisTurn ? " (set this turn)" : "";
  if (c.name === null) return `? (${c.position})${setNote}`;
  const parts = [c.name];
  if (c.atk !== undefined) {
    const atk = c.atk === c.baseAtk ? `${c.atk}` : `${c.atk}(base ${c.baseAtk})`;
    const def = c.def === c.baseDef ? `${c.def}` : `${c.def}(base ${c.baseDef})`;
    parts.push(`${c.position} ${atk}/${def}`);
    if (c.level) parts.push(`Lv${c.level}`);
    if (c.rank) parts.push(`Rank${c.rank}`);
    if (c.link) parts.push(`Link${c.link}`);
  } else {
    parts.push(`(${c.position}, ${c.typeLabel}${c.scale === undefined ? "" : `, scale ${c.scale}`})`);
  }
  if (c.negated) parts.push("[effects negated]");
  if (c.equippedTo) parts.push(`[equipped to ${c.equippedTo}]`);
  if (c.targets) parts.push(`[targets ${c.targets.join(", ")}]`);
  if (c.materials) parts.push(`[materials: ${c.materials.join(", ")}]`);
  if (c.counters) parts.push(`[counters: ${Object.entries(c.counters).map(([type, n]) => `${n}x#${type}`).join(", ")}]`);
  return parts.join(" ") + setNote;
}

/**
 * Pure function. Renders collected state as text lines.
 *
 * Args:
 *     state (object): From collectState.
 *
 * Returns:
 *     string[]
 *
 * Examples:
 *     >>> // renderState(collectState(...))[0]  ->  "Turn 3 (P0's turn), Main Phase 1."
 */
export function renderState(state) {
  const you = (p) => (state.viewer === p ? " [you]" : "");
  const lines = [];
  const result = state.winner === null ? "" : state.winner === 2 ? " DUEL OVER: draw." : ` DUEL OVER: P${state.winner} wins.`;
  const formatTag = state.format && state.format !== "classic" ? ` [${state.format.toUpperCase()} format]` : "";
  lines.push(`Turn ${state.turn}${state.turnPlayer === null ? "" : ` (P${state.turnPlayer}'s turn)`}, ${state.phaseName}.${formatTag}${result}`);
  lines.push(`Decks: P0 = ${state.players[0].deckName}${you(0)}, P1 = ${state.players[1].deckName}${you(1)}  (both decklists are public: \`ygo deck <name>\`)`);
  for (const p of state.players) {
    lines.push("");
    lines.push(`--- P${p.index} (${p.deckName})${you(p.index)}: LP ${p.lp} | hand ${p.handCount} | deck ${p.deckCount} | GY ${p.graveCount} | banished ${p.banishCount} | extra ${p.extraCount}`);
    const monsterRows = p.mzone.map((c, seq) => c && `  ${zoneLabel(OcgLocation.MZONE, seq)}: ${describeFieldCard(c)}`).filter(Boolean);
    const spellRows = p.szone.map((c, seq) => c && `  ${zoneLabel(OcgLocation.SZONE, seq)}: ${describeFieldCard(c)}`).filter(Boolean);
    lines.push(...(monsterRows.length ? monsterRows : ["  (no monsters)"]));
    lines.push(...(spellRows.length ? spellRows : ["  (no spells/traps)"]));
    if (p.hand.length) lines.push(`  hand: ${p.hand.map((c) => c.name ?? "?").join(", ")}`);
    if (p.grave.length) lines.push(`  GY: ${p.grave.map((c) => c.name).join(", ")}`);
    if (p.removed.length) lines.push(`  banished: ${p.removed.map((c) => c.name ?? "? (face-down)").join(", ")}`);
    if (p.extra.length) {
      const up = p.extra.filter((c) => c.faceUp);
      const down = p.extra.filter((c) => !c.faceUp);
      if (down.length) lines.push(`  extra: ${down.map((c) => c.name ?? "?").join(", ")}`);
      // Face-up Extra Deck cards are Pendulums that can be Pendulum Summoned back — worth their own line.
      if (up.length) lines.push(`  extra (face-up, Pendulum-summonable): ${up.map((c) => c.name ?? "?").join(", ")}`);
    }
    lines.push(p.unseenKind === "deck"
      ? `  deck contents (unordered): ${p.unseen.join(", ")}`
      : `  unseen (hand + deck + face-down, ${p.unseen.length}): ${p.unseen.join(", ")}`);
  }
  if (state.chain.length) {
    lines.push("");
    lines.push("Chain in progress:");
    state.chain.forEach((link, i) => lines.push(`  ${i + 1}. ${link.name} (${link.place})`));
  }
  return lines;
}

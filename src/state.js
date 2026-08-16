/**
 * Full game state as text, from one viewer's perspective.
 *
 * Reads the live core (authoritative: current ATK/DEF after modifiers, equips,
 * counters, chain) and applies the same visibility rules EDOPro's server uses
 * for its field refreshes (`CoreUtils::Query::IsPublicQuery`): a card's
 * identity is shown if the viewer controls it, or it is face-up, or the core
 * flags it public. Everything else is a `?` with only its position known.
 *
 * The viewer's own memory counts too: a face-down card that was revealed
 * earlier (De-Spell flipping a trap, a Book of Moon on a known monster) stays
 * known even though the core marks it non-public. That knowledge lives in the
 * viewer's field model (field.js), which is consulted for every hidden slot —
 * exactly what EDOPro's client does when it merges refresh data onto the card
 * objects it already holds.
 *
 * Both decklists are public knowledge (that is a rule of this harness, not of
 * the game — it mirrors a tournament where lists are registered). So the state
 * also lists, per player, the cards that are NOT visible to the viewer: for
 * the viewer's own deck that is exactly the deck contents (order withheld);
 * for the opponent it is "hand + deck + face-downs" as one unordered pool,
 * which is precisely what a competent human tracks.
 */

import { OcgLocation, OcgPhase, OcgPosition, OcgQueryFlags } from "ocgcore-wasm";
import { cardInfo, cardName, typeLabel } from "./cards.js";
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

/** Card status bit from the core: effects negated (STATUS_DISABLED). */
const STATUS_DISABLED = 0x1;

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
 * Pure function. One-line description of a card on the field as the viewer sees it.
 *
 * Args:
 *     card (OcgCardQueryInfo): Queried card.
 *     visible (boolean): Whether identity may be shown.
 *     isMonsterZone (boolean): Zone type.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> describeFieldCard({code: 89631139, position: 1, attack: 3000, defense: 2500, baseAttack: 3000, baseDefense: 2500, level: 8}, true, true)
 *     "Blue-Eyes White Dragon ATK 3000/2500 Lv8"
 *     >>> describeFieldCard({position: 8}, false, true)
 *     "? (fd DEF)"
 */
export function describeFieldCard(card, visible, isMonsterZone) {
  if (!visible) return `? (${posLabel(card.position, isMonsterZone)})`;
  const parts = [cardName(card.code)];
  if (isMonsterZone) {
    const atk = card.attack === card.baseAttack ? `${card.attack}` : `${card.attack}(base ${card.baseAttack})`;
    const def = card.defense === card.baseDefense ? `${card.defense}` : `${card.defense}(base ${card.baseDefense})`;
    parts.push(`${posLabel(card.position, true)} ${atk}/${def}`);
    if (card.level) parts.push(`Lv${card.level}`);
    if (card.rank) parts.push(`Rank${card.rank}`);
    if (card.link?.rating) parts.push(`Link${card.link.rating}`);
  } else {
    parts.push(`(${posLabel(card.position, false)}, ${typeLabel(cardInfo(card.code)?.type ?? 0)})`);
  }
  if (card.status & STATUS_DISABLED) parts.push("[effects negated]");
  if (card.equipCard) parts.push(`[equipped to ${zoneLabel(card.equipCard.location, card.equipCard.sequence)}]`);
  if (card.targetCards?.length) parts.push(`[targets ${card.targetCards.map((t) => `P${t.controller} ${zoneLabel(t.location, t.sequence)}`).join(", ")}]`);
  if (card.overlayCards?.length) parts.push(`[materials: ${card.overlayCards.map(cardName).join(", ")}]`);
  const counters = Object.entries(card.counters ?? {});
  if (counters.length) parts.push(`[counters: ${counters.map(([type, n]) => `${n}x#${type}`).join(", ")}]`);
  return parts.join(" ");
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
 * Query. Renders the whole visible state for `viewer` as text lines.
 *
 * Args:
 *     core, handle: Live duel after replay.
 *     opts.viewer (0|1|2)
 *     opts.deckNames ([string, string]): Labels for the two decklists.
 *     opts.deckCodes ([number[], number[]]): The registered decklists as passcodes.
 *     opts.model (object): The viewer's field model (field.js) — its turn/phase
 *         and its remembered card identities.
 *
 * Returns:
 *     string[]
 */
export function renderState(core, handle, { viewer, deckNames, deckCodes, model }) {
  const field = core.duelQueryField(handle);
  const lines = [];
  const you = (p) => (viewer === p ? " [you]" : "");
  const phaseName = PHASE_NAMES[model.phase] ?? "start";
  lines.push(`Turn ${model.turn}${model.turnPlayer === null ? "" : ` (P${model.turnPlayer}'s turn)`}, ${phaseName}.`);
  // Visible by rule, or remembered by the viewer from an earlier reveal.
  const known = (card, controller, location, sequence) => isVisible(card, controller, location, viewer)
    || (cardAt(model, { controller, location, sequence })?.code ?? 0) !== 0;
  lines.push(`Decks: P0 = ${deckNames[0]}${you(0)}, P1 = ${deckNames[1]}${you(1)}  (both decklists are public: \`ygo deck <name>\`)`);

  for (const p of [0, 1]) {
    const fp = field.players[p];
    lines.push("");
    lines.push(`--- P${p} (${deckNames[p]})${you(p)}: LP ${fp.lp} | hand ${fp.hand_size} | deck ${fp.deck_size} | GY ${fp.grave_size} | banished ${fp.banish_size} | extra ${fp.extra_size}`);

    const zoneRows = (location) => queryLocation(core, handle, p, location)
      .map((card, seq) => card && `  ${zoneLabel(location, seq)}: ${describeFieldCard(card, known(card, p, location, seq), location === OcgLocation.MZONE)}`)
      .filter(Boolean);
    const monsterRows = zoneRows(OcgLocation.MZONE);
    const spellRows = zoneRows(OcgLocation.SZONE);
    lines.push(...(monsterRows.length ? monsterRows : ["  (no monsters)"]));
    lines.push(...(spellRows.length ? spellRows : ["  (no spells/traps)"]));

    const hand = queryLocation(core, handle, p, OcgLocation.HAND).filter(Boolean);
    const handNames = hand.map((c, seq) => (known(c, p, OcgLocation.HAND, seq) ? cardName(c.code) : "?"));
    if (handNames.length) lines.push(`  hand: ${handNames.join(", ")}`);
    const grave = queryLocation(core, handle, p, OcgLocation.GRAVE).filter(Boolean);
    if (grave.length) lines.push(`  GY: ${grave.map((c) => cardName(c.code)).join(", ")}`);
    const removed = queryLocation(core, handle, p, OcgLocation.REMOVED).filter(Boolean);
    if (removed.length) lines.push(`  banished: ${removed.map((c, seq) => (known(c, p, OcgLocation.REMOVED, seq) ? cardName(c.code) : "? (face-down)")).join(", ")}`);
    const extra = queryLocation(core, handle, p, OcgLocation.EXTRA).filter(Boolean);
    if (extra.length) lines.push(`  extra: ${extra.map((c) => (isVisible(c, p, OcgLocation.EXTRA, viewer) ? cardName(c.code) : "?")).join(", ")}`);

    // What the viewer cannot see of this player's registered deck.
    if (viewer === p || viewer === SPECTATOR) {
      const deck = queryLocation(core, handle, p, OcgLocation.DECK).filter(Boolean).map((c) => cardName(c.code)).sort();
      lines.push(`  deck contents (unordered): ${deck.join(", ")}`);
    } else {
      const seen = [];
      for (const location of [OcgLocation.MZONE, OcgLocation.SZONE, OcgLocation.HAND, OcgLocation.GRAVE, OcgLocation.REMOVED, OcgLocation.EXTRA]) {
        for (const owner of [0, 1]) {
          queryLocation(core, handle, owner, location).forEach((c, seq) => {
            if (c && c.owner === p && known(c, owner, location, seq)) seen.push(c.code);
          });
        }
      }
      const unseen = unseenNames(deckCodes[p], seen);
      lines.push(`  unseen (hand + deck + face-down, ${unseen.length}): ${unseen.join(", ")}`);
    }
  }

  if (field.chain.length) {
    lines.push("");
    lines.push("Chain in progress:");
    field.chain.forEach((link, i) => lines.push(`  ${i + 1}. ${cardName(link.code)} (P${link.controller} ${zoneLabel(link.location, link.sequence)})`));
  }
  return lines;
}


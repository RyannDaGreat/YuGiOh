/**
 * Decision menus: the legal-action list the core hands us, rendered as numbered
 * options, and the inverse — turning a player's choice back into the exact
 * OcgResponse the core expects.
 *
 * Every SELECT_* message enumerates its legal answers, so a player (human or
 * LLM) never has to know the rules to avoid an illegal move: they pick from
 * the list. That is the single biggest reason this harness sits on ocgcore.
 *
 * Choice syntax accepted by `chooseFromMenu`:
 *     "3"        pick option 3
 *     "1,4"      pick options 1 and 4 (multi-select menus)
 *     "0"        the menu's zero option: pass / cancel / no / done, when offered
 *     "name:X"   declare card X by name (ANNOUNCE_CARD)
 *     "3:2,5:1"  counters: 2 from option 3, 1 from option 5 (SELECT_COUNTER)
 *
 * The response stored in the duel record is the OcgResponse, never the menu
 * number — menu numbering is presentation and may change; responses are the
 * durable, replayable truth.
 */

import { OcgHintTiming, OcgHintType, OcgLocation, OcgMessageType, OcgPosition, OcgResponseType, SelectBattleCMDAction, SelectIdleCMDAction, ocgAttributeString, ocgRaceString } from "ocgcore-wasm";
import { cardName, codeOf } from "./cards.js";
import { describe, sysString } from "./strings.js";
import { cardAt } from "./field.js";
import { nameOf, place, zoneLabel } from "./log.js";

/** Field-mask layout for SELECT_PLACE/DISFIELD (relative to the asking player). */
const MASK_OPPONENT_SHIFT = 16;
const MASK_SZONE_SHIFT = 8;
const MASK_MZONE_BITS = 0x7f;
const MASK_SZONE_BITS = 0xff;

/** System string ids EDOPro uses as default prompts. */
const SYS_SELECT = 560;
const SYS_SELECT_TRIBUTE = 531;
const SYS_SELECT_OPTION = 555;
const SYS_SELECT_POSITION = 561;
const SYS_SELECT_ZONE_FOR = 569;
const SYS_DISABLE_ZONE = 570;
const SYS_DECLARE_ATTRIBUTE = 562;
const SYS_DECLARE_RACE = 563;
const SYS_DECLARE_CARD = 564;
const SYS_DECLARE_NUMBER = 565;
const SYS_USE_EFFECT_OF = 200;
const SYS_ACTIVATE_TRIGGER = 221;
const SYS_ACTIVATE_TRIGGER_NOTE = 223;
/** MSG_SELECT_EFFECTYN uses these description values as sentinels. */
const DESC_DEFAULT_EFFECT_PROMPT = 0n;
const DESC_TRIGGER_EFFECT_PROMPT = 221n;

const TIMING_LABELS = [
  [OcgHintTiming.DRAW_PHASE, "draw phase"], [OcgHintTiming.STANDBY_PHASE, "standby phase"],
  [OcgHintTiming.MAIN_END, "end of main phase"], [OcgHintTiming.BATTLE_START, "start of battle phase"],
  [OcgHintTiming.BATTLE_END, "end of battle phase"], [OcgHintTiming.END_PHASE, "end phase"],
  [OcgHintTiming.SUMMON, "after a normal summon"], [OcgHintTiming.SPSUMMON, "after a special summon"],
  [OcgHintTiming.FLIPSUMMON, "after a flip summon"], [OcgHintTiming.MSET, "after a monster was set"],
  [OcgHintTiming.SSET, "after a spell/trap was set"], [OcgHintTiming.POS_CHANGE, "after a position change"],
  [OcgHintTiming.ATTACK, "attack declared"], [OcgHintTiming.DAMAGE_STEP, "damage step"],
  [OcgHintTiming.DAMAGE_CAL, "damage calculation"], [OcgHintTiming.CHAIN_END, "after a chain resolved"],
  [OcgHintTiming.DRAW, "after a draw"], [OcgHintTiming.DAMAGE, "after damage"],
  [OcgHintTiming.RECOVER, "after LP gain"], [OcgHintTiming.DESTROY, "after destruction"],
];

/**
 * Pure function. Words for a hint_timing bitmask.
 *
 * Args:
 *     mask (number): OcgHintTiming bits.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> timingWords(0x40)        // "after a normal summon"
 *     >>> timingWords(0x1 | 0x20)  // "draw phase, end phase"
 *     >>> timingWords(0)           // ""
 */
export function timingWords(mask) {
  return TIMING_LABELS.filter(([bit]) => mask & bit).map(([, label]) => label).join(", ");
}

/**
 * Pure function. Substitutes a card name into an EDOPro format string, which
 * may use printf `%ls` or fmt `{}` placeholders.
 *
 * Args:
 *     template (string): The system/card string.
 *     values (string[]): Substitutions in order.
 *
 * Returns:
 *     string
 *
 * Examples:
 *     >>> fillTemplate('Use the effect of "%ls" from [%ls]?', ["Trap Hole", "s1"])
 *     'Use the effect of "Trap Hole" from [s1]?'
 *     >>> fillTemplate("Your choice: [{}]", ["Yes"])  // "Your choice: [Yes]"
 */
export function fillTemplate(template, values) {
  let i = 0;
  return template.replace(/%ls|\{\}/g, () => values[i++] ?? "");
}

/**
 * Pure function. Name for a card entry in a select list, honouring masking.
 *
 * Entries the selecting player does not control arrive with code 0 (see
 * view.js). If the viewer's field model knows the card anyway (it is face-up,
 * or was revealed), that name is used — exactly what a human at the table
 * knows. Truly hidden cards stay "?".
 *
 * Args:
 *     entry ({code, controller, location, sequence}): List entry.
 *     field (object|null): The viewer's field model (field.js), or null.
 *
 * Returns:
 *     string: e.g. "Rude Kaiser (P1 m4)" or "? (P1 m0)".
 *
 * Examples:
 *     >>> entryLabel({code: 26378150, controller: 1, location: 4, sequence: 4}, null) // "Rude Kaiser (P1 m4)"
 *     >>> entryLabel({code: 0, controller: 1, location: 4, sequence: 0}, null)        // "? (P1 m0)"
 */
export function entryLabel(entry, field) {
  const code = entry.code !== 0 ? entry.code : (field ? cardAt(field, entry)?.code ?? 0 : 0);
  return `${nameOf(code)} (${place(entry)})`;
}

/**
 * Pure function. Expands a field mask into selectable zones.
 *
 * A SET bit means the zone is NOT selectable (the core's convention). The low
 * 16 bits are the asking player's zones, the high 16 the opponent's; within
 * each half bits 0-6 are monster zones 0-6 and bits 8-15 spell/trap zones 0-7.
 *
 * Args:
 *     mask (number): field_mask from the message.
 *     player (0|1): The asking player.
 *
 * Returns:
 *     Array<{player, location, sequence, label}>
 *
 * Examples:
 *     >>> selectableZones(0xffffffff ^ 0b11, 0).map((z) => z.label)          // ["P0 m0", "P0 m1"]
 *     >>> selectableZones(0xffffffff ^ (1 << 8), 1).map((z) => z.label)      // ["P1 s0"]
 *     >>> selectableZones(0xffffffff ^ (1 << 16), 1).map((z) => z.label)     // ["P0 m0"]
 */
export function selectableZones(mask, player) {
  const zones = [];
  for (const [side, owner] of [[0, player], [MASK_OPPONENT_SHIFT, 1 - player]]) {
    const half = (mask >>> side) & 0xffff;
    for (let seq = 0; seq < 7; seq++) {
      if (!(half & (1 << seq)) && (MASK_MZONE_BITS & (1 << seq))) {
        zones.push({ player: owner, location: OcgLocation.MZONE, sequence: seq, label: `P${owner} ${zoneLabel(OcgLocation.MZONE, seq)}` });
      }
    }
    for (let seq = 0; seq < 8; seq++) {
      if (!((half >>> MASK_SZONE_SHIFT) & (1 << seq)) && (MASK_SZONE_BITS & (1 << seq))) {
        zones.push({ player: owner, location: OcgLocation.SZONE, sequence: seq, label: `P${owner} ${zoneLabel(OcgLocation.SZONE, seq)}` });
      }
    }
  }
  return zones;
}

/**
 * Pure function. Makes duplicate labels distinct by appending an ordinal, so
 * "Activate X" and "Activate X" (two effects of one card whose script has no
 * effect strings) become "Activate X (effect #1)" / "(effect #2)".
 *
 * Args:
 *     items (Array<{label, value}>): Menu items.
 *
 * Returns:
 *     Array<{label, value}>: New array; only duplicated labels are changed.
 *
 * Examples:
 *     >>> disambiguate([{label: "a"}, {label: "a"}, {label: "b"}]).map((i) => i.label)
 *     ["a (effect #1)", "a (effect #2)", "b"]
 *     >>> disambiguate([{label: "a"}]).map((i) => i.label)  // ["a"]
 */
export function disambiguate(items) {
  const counts = new Map();
  for (const it of items) counts.set(it.label, (counts.get(it.label) ?? 0) + 1);
  const seen = new Map();
  return items.map((it) => {
    if (counts.get(it.label) < 2) return it;
    const n = (seen.get(it.label) ?? 0) + 1;
    seen.set(it.label, n);
    return { ...it, label: `${it.label} (effect #${n})` };
  });
}

/**
 * Pure function. Builds the menu for a pending core question.
 *
 * Args:
 *     msg (OcgMessage): The pending SELECT or ANNOUNCE message (masked for
 *         the asked player).
 *     ctx (object): Context for prompts.
 *     ctx.selectHint (bigint): Last HINT_SELECTMSG value (0n if none).
 *     ctx.eventHint (bigint): Last HINT_EVENT value (0n if none).
 *     ctx.field (object|null): The asked player's field model, to name cards
 *         whose codes the selection list withholds but the player can see.
 *
 * Returns:
 *     Menu: {
 *       title: string,
 *       items: Array<{label: string, value: any}>,          numbered from 1
 *       zero: {label: string, response: OcgResponse}|null,   the "0" option
 *       mode: "one"|"many"|"order"|"counters"|"name",
 *       min: number, max: number,                            for "many"
 *       build: (values: any[]) => OcgResponse,               from chosen item values
 *     }
 *
 * Examples:
 *     >>> buildMenu({type: 13, player: 0, description: 0n}, {selectHint: 0n, eventHint: 0n, field: null}).items.map((i) => i.label)
 *     ["Yes", "No"]
 */
export function buildMenu(msg, ctx) {
  const T = OcgMessageType;
  const R = OcgResponseType;
  const one = (title, items, zero = null) => ({ title, items, zero, mode: "one", min: 1, max: 1, build: ([v]) => v });
  const selectPrompt = (fallbackSys) => (ctx.selectHint ? describe(ctx.selectHint) : sysString(fallbackSys));

  switch (msg.type) {
    case T.SELECT_IDLECMD: {
      const items = [];
      msg.summons.forEach((c, i) => items.push({ label: `Normal summon ${entryLabel(c, ctx.field)}`, value: { action: SelectIdleCMDAction.SELECT_SUMMON, index: i } }));
      msg.special_summons.forEach((c, i) => items.push({ label: `Special summon ${entryLabel(c, ctx.field)}`, value: { action: SelectIdleCMDAction.SELECT_SPECIAL_SUMMON, index: i } }));
      msg.monster_sets.forEach((c, i) => items.push({ label: `Set monster ${entryLabel(c, ctx.field)}`, value: { action: SelectIdleCMDAction.SELECT_MONSTER_SET, index: i } }));
      msg.spell_sets.forEach((c, i) => items.push({ label: `Set spell/trap ${entryLabel(c, ctx.field)}`, value: { action: SelectIdleCMDAction.SELECT_SPELL_SET, index: i } }));
      msg.activates.forEach((c, i) => {
        const effect = describe(c.description);
        items.push({ label: `Activate ${entryLabel(c, ctx.field)}${effect ? `: ${effect}` : ""}`, value: { action: SelectIdleCMDAction.SELECT_ACTIVATE, index: i } });
      });
      msg.pos_changes.forEach((c, i) => items.push({ label: `Change battle position of ${entryLabel(c, ctx.field)}`, value: { action: SelectIdleCMDAction.SELECT_POS_CHANGE, index: i } }));
      if (msg.to_bp) items.push({ label: "Enter Battle Phase", value: { action: SelectIdleCMDAction.TO_BP, index: null } });
      if (msg.to_ep) items.push({ label: "End turn", value: { action: SelectIdleCMDAction.TO_EP, index: null } });
      return { title: `P${msg.player}: main phase action`, items: disambiguate(items), zero: null, mode: "one", min: 1, max: 1, build: ([v]) => ({ type: R.SELECT_IDLECMD, ...v }) };
    }
    case T.SELECT_BATTLECMD: {
      const items = [];
      msg.attacks.forEach((c, i) => items.push({ label: `Attack with ${entryLabel(c, ctx.field)}${c.can_direct ? " (can attack directly)" : ""}`, value: { action: SelectBattleCMDAction.SELECT_BATTLE, index: i } }));
      msg.chains.forEach((c, i) => {
        const effect = describe(c.description);
        items.push({ label: `Activate ${entryLabel(c, ctx.field)}${effect ? `: ${effect}` : ""}`, value: { action: SelectBattleCMDAction.SELECT_CHAIN, index: i } });
      });
      if (msg.to_m2) items.push({ label: "Enter Main Phase 2", value: { action: SelectBattleCMDAction.TO_M2, index: null } });
      if (msg.to_ep) items.push({ label: "End turn", value: { action: SelectBattleCMDAction.TO_EP, index: null } });
      return { title: `P${msg.player}: battle phase action`, items: disambiguate(items), zero: null, mode: "one", min: 1, max: 1, build: ([v]) => ({ type: R.SELECT_BATTLECMD, ...v }) };
    }
    case T.SELECT_CHAIN: {
      const when = timingWords(msg.hint_timing | msg.hint_timing_other);
      const event = ctx.eventHint ? describe(ctx.eventHint) : "";
      const context = [event, when && `timing: ${when}`].filter(Boolean).join("; ");
      const items = msg.selects.map((c, i) => {
        const effect = describe(c.description);
        return { label: `Activate ${entryLabel(c, ctx.field)}${effect ? `: ${effect}` : ""}`, value: i };
      });
      const zero = msg.forced ? null : { label: "Do not activate anything", response: { type: R.SELECT_CHAIN, index: null } };
      return { title: `P${msg.player}: respond?${context ? ` (${context})` : ""}${msg.forced ? " [must activate]" : ""}`, items: disambiguate(items), zero, mode: "one", min: 1, max: 1, build: ([i]) => ({ type: R.SELECT_CHAIN, index: i }) };
    }
    case T.SELECT_CARD: {
      const items = msg.selects.map((c, i) => ({ label: entryLabel(c, ctx.field), value: i }));
      const zero = msg.can_cancel ? { label: "Cancel", response: { type: R.SELECT_CARD, indicies: null } } : null;
      return { title: `P${msg.player}: ${selectPrompt(SYS_SELECT)} (choose ${rangeText(msg.min, msg.max)})`, items, zero, mode: "many", min: msg.min, max: msg.max, build: (idx) => ({ type: R.SELECT_CARD, indicies: idx }) };
    }
    case T.SELECT_UNSELECT_CARD: {
      const items = [
        ...msg.select_cards.map((c, i) => ({ label: entryLabel(c, ctx.field), value: i })),
        ...msg.unselect_cards.map((c, i) => ({ label: `Deselect ${entryLabel(c, ctx.field)}`, value: msg.select_cards.length + i })),
      ];
      const zero = msg.can_finish ? { label: "Finish selecting", response: { type: R.SELECT_UNSELECT_CARD, index: null } }
        : msg.can_cancel ? { label: "Cancel", response: { type: R.SELECT_UNSELECT_CARD, index: null } } : null;
      return { title: `P${msg.player}: ${selectPrompt(SYS_SELECT)} (one at a time, ${rangeText(msg.min, msg.max)} total)`, items, zero, mode: "one", min: 1, max: 1, build: ([i]) => ({ type: R.SELECT_UNSELECT_CARD, index: i }) };
    }
    case T.SELECT_TRIBUTE: {
      const items = msg.selects.map((c, i) => ({ label: `${entryLabel(c, ctx.field)}${c.release_param > 1 ? ` (counts as ${c.release_param} tributes)` : ""}`, value: i }));
      const zero = msg.can_cancel ? { label: "Cancel", response: { type: R.SELECT_TRIBUTE, indicies: null } } : null;
      return { title: `P${msg.player}: ${selectPrompt(SYS_SELECT_TRIBUTE)} (choose ${rangeText(msg.min, msg.max)})`, items, zero, mode: "many", min: msg.min, max: msg.max, build: (idx) => ({ type: R.SELECT_TRIBUTE, indicies: idx }) };
    }
    case T.SELECT_SUM: {
      const must = msg.selects_must.map((c) => `${entryLabel(c, ctx.field)} [${c.amount}]`);
      const items = msg.selects.map((c, i) => ({ label: `${entryLabel(c, ctx.field)} [${c.amount}]`, value: i }));
      const goal = msg.select_max ? `total exactly ${msg.amount}` : `total at least ${msg.amount}`;
      const title = `P${msg.player}: ${selectPrompt(SYS_SELECT)} (${goal}${must.length ? `; already included: ${must.join(", ")}` : ""}, choose ${rangeText(msg.min, msg.max)} more)`;
      return { title, items, zero: null, mode: "many", min: msg.min, max: msg.max, build: (idx) => ({ type: R.SELECT_SUM, indicies: idx }) };
    }
    case T.SELECT_POSITION: {
      const labels = [[OcgPosition.FACEUP_ATTACK, "Face-up Attack"], [OcgPosition.FACEDOWN_ATTACK, "Face-down Attack"], [OcgPosition.FACEUP_DEFENSE, "Face-up Defense"], [OcgPosition.FACEDOWN_DEFENSE, "Face-down Defense"]];
      const items = labels.filter(([bit]) => msg.positions & bit).map(([bit, label]) => ({ label, value: bit }));
      return one(`P${msg.player}: ${sysString(SYS_SELECT_POSITION)} for ${cardName(msg.code)}`, items.map((it) => ({ label: it.label, value: { type: R.SELECT_POSITION, position: it.value } })));
    }
    case T.SELECT_PLACE:
    case T.SELECT_DISFIELD: {
      const zones = selectableZones(msg.field_mask, msg.player);
      const items = zones.map((z) => ({ label: z.label, value: { player: z.player, location: z.location, sequence: z.sequence } }));
      // For SELECT_PLACE the select hint is a card code ("Select the zone to place X").
      const title = msg.type === T.SELECT_PLACE
        ? `P${msg.player}: ${ctx.selectHint ? fillTemplate(sysString(SYS_SELECT_ZONE_FOR), [cardName(Number(ctx.selectHint))]) : sysString(SYS_SELECT)} (choose ${msg.count})`
        : `P${msg.player}: ${selectPrompt(SYS_DISABLE_ZONE)} (choose ${msg.count})`;
      const type = msg.type === T.SELECT_PLACE ? R.SELECT_PLACE : R.SELECT_DISFIELD;
      return { title, items, zero: null, mode: "many", min: msg.count, max: msg.count, build: (places) => ({ type, places }) };
    }
    case T.SELECT_EFFECTYN: {
      const where = `${place(msg)}`;
      let text;
      if (msg.description === DESC_DEFAULT_EFFECT_PROMPT) text = fillTemplate(sysString(SYS_USE_EFFECT_OF), [cardName(msg.code), where]);
      else if (msg.description === DESC_TRIGGER_EFFECT_PROMPT) text = `${fillTemplate(sysString(SYS_ACTIVATE_TRIGGER), [cardName(msg.code), where])} ${sysString(SYS_ACTIVATE_TRIGGER_NOTE)}`;
      else text = fillTemplate(describe(msg.description), [cardName(msg.code)]);
      return one(`P${msg.player}: ${text}`, [{ label: "Yes", value: { type: R.SELECT_EFFECTYN, yes: true } }, { label: "No", value: { type: R.SELECT_EFFECTYN, yes: false } }]);
    }
    case T.SELECT_YESNO:
      return one(`P${msg.player}: ${describe(msg.description)}`, [{ label: "Yes", value: { type: R.SELECT_YESNO, yes: true } }, { label: "No", value: { type: R.SELECT_YESNO, yes: false } }]);
    case T.SELECT_OPTION:
      return one(`P${msg.player}: ${selectPrompt(SYS_SELECT_OPTION)}`, msg.options.map((d, i) => ({ label: describe(d), value: { type: R.SELECT_OPTION, index: i } })));
    case T.SELECT_COUNTER: {
      const items = msg.cards.map((c, i) => ({ label: `${entryLabel(c, ctx.field)} (has ${c.count})`, value: i }));
      return { title: `P${msg.player}: remove ${msg.count} counter(s) of type #${msg.counter_type} — answer as option:count, e.g. 1:2`, items, zero: null, mode: "counters", min: 1, max: items.length, build: (counts) => ({ type: R.SELECT_COUNTER, counters: counts }) };
    }
    case T.SORT_CARD: {
      const items = msg.cards.map((c, i) => ({ label: entryLabel(c, ctx.field), value: i }));
      return { title: `P${msg.player}: choose an order (list all, first = top)`, items, zero: { label: "Keep current order", response: { type: R.SORT_CARD, order: null } }, mode: "order", min: items.length, max: items.length, build: (order) => ({ type: R.SORT_CARD, order }) };
    }
    case T.ANNOUNCE_RACE: {
      const items = [...ocgRaceString.entries()].filter(([bit]) => msg.available & bit).map(([bit, name]) => ({ label: name, value: bit }));
      return { title: `P${msg.player}: ${selectPrompt(SYS_DECLARE_RACE)} (choose ${msg.count})`, items, zero: null, mode: "many", min: msg.count, max: msg.count, build: (races) => ({ type: R.ANNOUNCE_RACE, races }) };
    }
    case T.ANNOUNCE_ATTRIB: {
      const items = [...ocgAttributeString.entries()].filter(([bit]) => msg.available & bit).map(([bit, name]) => ({ label: name.toUpperCase(), value: bit }));
      return { title: `P${msg.player}: ${selectPrompt(SYS_DECLARE_ATTRIBUTE)} (choose ${msg.count})`, items, zero: null, mode: "many", min: msg.count, max: msg.count, build: (attributes) => ({ type: R.ANNOUNCE_ATTRIB, attributes }) };
    }
    case T.ANNOUNCE_NUMBER:
      return one(`P${msg.player}: ${selectPrompt(SYS_DECLARE_NUMBER)}`, msg.options.map((n) => ({ label: `${n}`, value: { type: R.ANNOUNCE_NUMBER, value: Number(n) } })));
    case T.ANNOUNCE_CARD:
      return { title: `P${msg.player}: ${selectPrompt(SYS_DECLARE_CARD)} — answer as name:<exact card name>`, items: [], zero: null, mode: "name", min: 1, max: 1, build: ([code]) => ({ type: R.ANNOUNCE_CARD, card: code }) };
    case T.ROCK_PAPER_SCISSORS:
      return one(`P${msg.player}: rock, paper, scissors`, [1, 2, 3].map((v, i) => ({ label: ["Rock", "Paper", "Scissors"][i], value: { type: R.ROCK_PAPER_SCISSORS, value: v } })));
    default:
      throw new Error(`no menu for message type ${msg.type}`);
  }
}

/**
 * Pure function. "exactly 1" / "1-3" text for a min/max range.
 *
 * Examples:
 *     >>> rangeText(1, 1) // "exactly 1"
 *     >>> rangeText(1, 3) // "1-3"
 */
function rangeText(min, max) {
  return min === max ? `exactly ${min}` : `${min}-${max}`;
}

/**
 * Pure function. Renders a menu as text lines.
 *
 * Args:
 *     menu (Menu): From buildMenu.
 *
 * Returns:
 *     string[]
 *
 * Examples:
 *     >>> renderMenu({title: "P0: respond?", items: [{label: "Activate Trap Hole (P0 s1)"}], zero: {label: "Do not activate anything"}, mode: "one"})
 *     ["P0: respond?", "  1. Activate Trap Hole (P0 s1)", "  0. Do not activate anything"]
 */
export function renderMenu(menu) {
  const lines = [menu.title];
  menu.items.forEach((item, i) => lines.push(`  ${i + 1}. ${item.label}`));
  if (menu.zero) lines.push(`  0. ${menu.zero.label}`);
  if (menu.mode === "many" && menu.items.length) lines.push(`  (answer with comma-separated numbers, e.g. "1" or "1,3")`);
  return lines;
}

/**
 * Pure function. Turns a typed choice into the OcgResponse for a menu.
 *
 * Args:
 *     menu (Menu): From buildMenu.
 *     text (string): The player's choice, see module doc for syntax.
 *
 * Returns:
 *     OcgResponse
 *
 * Throws:
 *     Error: on any malformed or out-of-range choice — the caller must not
 *     record it. Illegal-but-well-formed choices are caught later by the core
 *     (MSG_RETRY), which the harness also treats as an error.
 *
 * Examples:
 *     >>> chooseFromMenu(buildMenu({type: 13, player: 0, description: 0n}, {selectHint: 0n, eventHint: 0n, field: null}), "1")
 *     {type: 3, yes: true}
 *     >>> chooseFromMenu(buildMenu({type: 13, player: 0, description: 0n}, {selectHint: 0n, eventHint: 0n, field: null}), "2")
 *     {type: 3, yes: false}
 */
export function chooseFromMenu(menu, text) {
  const raw = String(text).trim();
  if (raw === "0") {
    if (!menu.zero) throw new Error(`"0" is not an option here`);
    return menu.zero.response;
  }
  if (menu.mode === "name") {
    const match = raw.match(/^name:(.+)$/);
    if (!match) throw new Error(`answer as name:<card name>`);
    return menu.build([codeOf(match[1].trim())]);
  }
  if (menu.mode === "counters") {
    const counts = Array(menu.items.length).fill(0);
    for (const part of raw.split(",")) {
      const m = part.trim().match(/^(\d+):(\d+)$/);
      if (!m) throw new Error(`counters must be option:count pairs, got ${JSON.stringify(part)}`);
      counts[itemIndex(menu, m[1])] = Number(m[2]);
    }
    return menu.build(counts);
  }
  const picks = raw.split(",").map((p) => itemIndex(menu, p.trim()));
  if (menu.mode === "one" && picks.length !== 1) throw new Error(`choose exactly one option`);
  if (menu.mode === "many" && (picks.length < menu.min || picks.length > menu.max)) {
    throw new Error(`choose ${rangeText(menu.min, menu.max)} option(s), got ${picks.length}`);
  }
  if (menu.mode === "order" && (picks.length !== menu.items.length || new Set(picks).size !== picks.length)) {
    throw new Error(`list every option exactly once`);
  }
  if (new Set(picks).size !== picks.length) throw new Error(`duplicate options`);
  return menu.build(picks.map((i) => menu.items[i].value));
}

/**
 * Pure function. Parses "3" into the 0-based item index, validating range.
 *
 * Examples:
 *     >>> itemIndex({items: [1, 2, 3]}, "2") // 1
 */
function itemIndex(menu, token) {
  if (!/^\d+$/.test(token)) throw new Error(`not an option number: ${JSON.stringify(token)}`);
  const n = Number(token);
  if (n < 1 || n > menu.items.length) throw new Error(`option ${n} out of range 1-${menu.items.length}`);
  return n - 1;
}

/**
 * Pure function. Finds the hints that precede the pending question. The core
 * sends HINT_SELECTMSG ("what this selection is for") right before a select
 * question, and HINT_EVENT ("what just happened") at the start of a timing
 * window. EDOPro consumes the select hint with the next question and keeps the
 * event hint until the next one replaces it; this mirrors that.
 *
 * Args:
 *     messages (OcgMessage[]): The viewer's masked stream, pending question last.
 *
 * Returns:
 *     {selectHint: bigint, eventHint: bigint}   (0n when absent)
 *
 * Examples:
 *     >>> hintsBefore([{type: 2, hint_type: 3, hint: 502n}, {type: 15}]).selectHint  // 502n
 *     >>> hintsBefore([{type: 15}, {type: 2, hint_type: 3, hint: 502n}, {type: 11}, {type: 15}]).selectHint  // 0n (consumed by the earlier question)
 *     >>> hintsBefore([{type: 2, hint_type: 1, hint: 23n}, {type: 11}, {type: 16}]).eventHint  // 23n
 */
export function hintsBefore(messages) {
  const T = OcgMessageType;
  const isQuestion = (m) => (m.type >= T.SELECT_BATTLECMD && m.type <= T.SELECT_UNSELECT_CARD) || (m.type >= T.ANNOUNCE_RACE && m.type <= T.ANNOUNCE_NUMBER);
  let selectHint = 0n;
  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i];
    if (m.type === T.HINT && m.hint_type === OcgHintType.SELECTMSG) { selectHint = m.hint; break; }
    if (isQuestion(m)) break;
  }
  let eventHint = 0n;
  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i];
    if (m.type === T.HINT && m.hint_type === OcgHintType.EVENT) { eventHint = m.hint; break; }
  }
  return { selectHint, eventHint };
}

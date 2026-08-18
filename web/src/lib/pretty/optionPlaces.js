/**
 * Where on the table each menu option points.
 *
 * Every option the engine offers names a place in a fixed way — "Normal summon
 * Beaver Warrior (P0 hand)", "Attack with Blue-Eyes (P1 m0)", "Activate Book of
 * Moon (P0 s1)", "Sangan (P0 m2)" in a target list, "P0 m3" in a zone list,
 * "Special summon Kagari (P0 extra)" — so a label can be resolved to the card,
 * slot or pile it is about. That is what lets the table light up what is
 * clickable and open a context menu of just that card's options.
 *
 * Pure: label text in, place out. The table decides how to draw it.
 */

/**
 * "(P0 m2)" / "(P1 hand 3)" / "(P0 extra 5)" / "(P0 deck)" — at the end of a label, or followed by
 * further parentheticals ("Attack with X (P1 m0) (can attack directly)",
 * "Activate X (P0 s1): Gain 1000 LP (effect #2)"), a bracketed amount from a
 * SELECT_SUM tribute list ("Sangan (P0 m2) [1000]"), or an effect description —
 * or a bare zone item "P0 m2" from a zone-select menu.
 */
const PLACE = /\(?\bP(?<p>[01]) (?:(?<list>hand|extra|GY|deck|banished)(?: (?<idx>\d+))?|m(?<m>[0-6])|s(?<s>[0-7])|(?<field>field))\)?(?:\s*(?:\([^()]*\)|\[[^[\]]*\]))*(?:\s*:.*)?\s*$/;

/** List places as the label spells them -> the table's kind names. */
const LIST_KINDS = { hand: "hand", extra: "extra", GY: "grave", deck: "deck", banished: "banished" };

/**
 * The action verb the engine puts in front of a card name (src/menu.js
 * buildMenu). Everything after it, up to the place, is the card's name.
 */
const VERB = /^(Normal summon|Tribute summon|Set monster|Set spell\/trap|Special summon|Pendulum Summon using|Activate|Attack with|Flip summon|Change battle position of|Deselect)\s+/i;

/**
 * A trailing " — explanation" (Pendulum Summon labels carry a long note). Never
 * part of a card name: no card name contains a spaced em dash.
 */
const NOTE = /\s+—\s.*$/;

/** What nameOf() prints for a card whose code the message withheld — nothing to look up. */
const UNKNOWN_NAME = "?";

/**
 * Pure function. The place an option label points at, or null.
 *
 * Args:
 *     label (string): One menu item's label.
 *
 * Returns:
 *     {p: 0|1, kind: "m"|"s"|"hand"|"extra"|"grave"|"deck"|"banished", seq: number|null}|null
 *     `field` maps to the spell/trap row's field slot (`s`, seq 5) as the table lays it out.
 *     A list place (hand, extra, GY, banished) carries the card's index in that list
 *     when the label has one; `seq` is null for the deck and for older, index-less labels.
 *
 * Examples:
 *     >>> placeOf("Normal summon Beaver Warrior (P0 hand 3)") // {p: 0, kind: "hand", seq: 3}
 *     >>> placeOf("Normal summon Beaver Warrior (P0 hand)")   // {p: 0, kind: "hand", seq: null}   (older records)
 *     >>> placeOf("Attack with Blue-Eyes White Dragon (P1 m0)") // {p: 1, kind: "m", seq: 0}
 *     >>> placeOf("Attack with Kuriboh (P1 m1) (can attack directly)")   // {p: 1, kind: "m", seq: 1}
 *     >>> placeOf("Activate Book of Moon (P0 s1)")             // {p: 0, kind: "s", seq: 1}
 *     >>> placeOf("P0 m3")                                    // {p: 0, kind: "m", seq: 3}
 *     >>> placeOf("Special summon Kagari (P0 extra 5)")       // {p: 0, kind: "extra", seq: 5}
 *     >>> placeOf("Special summon Kagari (P0 extra)")         // {p: 0, kind: "extra", seq: null}
 *     >>> placeOf("Dark Magician (P0 deck)")                  // {p: 0, kind: "deck", seq: null}
 *     >>> placeOf("Activate Monster Reborn (P0 field)")       // {p: 0, kind: "s", seq: 5}
 *     >>> placeOf("Sangan (P0 m2) [1000]")                    // {p: 0, kind: "m", seq: 2}
 *     >>> placeOf("Pendulum Summon using Dragonpit Magician (P0 s0) — summons monsters…")  // {p: 0, kind: "s", seq: 0}
 *     >>> placeOf("End turn")                                 // null
 */
export function placeOf(label) {
  // The trailing note goes first: it is prose, and its own "(P0 s7)" mentions
  // (the Pendulum scales) must not be mistaken for the option's place.
  const m = String(label).replace(NOTE, "").match(PLACE)?.groups;
  if (!m) return null;
  const p = Number(m.p);
  if (m.list) return { p, kind: LIST_KINDS[m.list], seq: m.idx === undefined ? null : Number(m.idx) };
  if (m.field) return { p, kind: "s", seq: 5 };
  if (m.m !== undefined) return { p, kind: "m", seq: Number(m.m) };
  return { p, kind: "s", seq: Number(m.s) };
}

/**
 * Pure function. The card name an option is about, if the label carries one:
 * everything between the action verb phrase and the trailing place — used to
 * preview the card an option names when the option is hovered, and to tell
 * hand cards apart in records from before hand labels carried an index.
 *
 * A label that is nothing but a name ("Dark Magician", as a plain SELECT_CARD
 * item) is returned as-is: a colon is NOT treated as an effect separator there,
 * because names contain them ("Number 39: Utopia"). That means a non-card option
 * ("End turn") comes back as its own text; whoever looks the name up decides
 * what to do when it matches no card.
 *
 * Args:
 *     label (string): One menu item's label.
 *
 * Returns:
 *     string|null: null when the label names nothing lookupable — a bare zone
 *     ("P0 m3") or a card whose code was withheld ("? (P1 m0)").
 *
 * Examples:
 *     >>> nameIn("Normal summon Beaver Warrior (P0 hand 3)")   // "Beaver Warrior"
 *     >>> nameIn("Set spell/trap Dark Hole (P0 hand)")         // "Dark Hole"
 *     >>> nameIn("Sangan (P0 m2)")                             // "Sangan"
 *     >>> nameIn("Activate Book of Moon (P0 s1): Target 1 monster")  // "Book of Moon"
 *     >>> nameIn("Activate Magician's Circle (P0 s0) (effect #2)")   // "Magician's Circle"
 *     >>> nameIn("Dark Magician (P0 deck)")                    // "Dark Magician"
 *     >>> nameIn("Number 39: Utopia")                          // "Number 39: Utopia"
 *     >>> nameIn("P0 m3")                                      // null
 *     >>> nameIn("? (P1 m0)")                                  // null
 */
export function nameIn(label) {
  const text = String(label).replace(NOTE, "").replace(PLACE, "").trim();
  const name = text.replace(VERB, "").trim();
  return !name || name === UNKNOWN_NAME ? null : name;
}

/** The phase-strip buttons that are also menu options, by the label the engine gives each. */
const PHASE_LABELS = { BP: /^Enter Battle Phase$/, M2: /^Enter Main Phase 2$/, EP: /^End turn/ };

/**
 * Pure function. Which menu option each phase-strip button stands for, so the
 * strip is clickable in the same style as cards: hovering BP lights up "Enter
 * Battle Phase" and clicking it plays it.
 *
 * Args:
 *     items (string[]): Menu item labels.
 *
 * Returns:
 *     {BP?: number, M2?: number, EP?: number}: option index per phase key.
 *
 * Examples:
 *     >>> phaseOptions(["Attack with X (P0 m0)", "Enter Main Phase 2", "End turn (skip Main Phase 2)"])
 *     {M2: 1, EP: 2}
 */
export function phaseOptions(items) {
  const out = {};
  (items ?? []).forEach((label, index) => {
    for (const [key, re] of Object.entries(PHASE_LABELS)) if (re.test(label) && out[key] === undefined) out[key] = index;
  });
  return out;
}

/**
 * Pure function. Groups menu items by the place they point at, so the table can
 * ask "which options belong to THIS slot / hand card / pile" in one lookup.
 *
 * Args:
 *     items (string[]): Menu item labels (menuSummary order; index = option-1).
 *
 * Returns:
 *     Array<{index: number, label: string, place: object, name: string|null}>
 *
 * Examples:
 *     >>> optionPlaces(["Normal summon Sangan (P0 hand 1)", "End turn"])
 *     [{index: 0, label: "Normal summon Sangan (P0 hand 1)", place: {p: 0, kind: "hand", seq: 1}, name: "Sangan"}]
 */
export function optionPlaces(items) {
  return (items ?? [])
    .map((label, index) => ({ index, label, place: placeOf(label), name: nameIn(label) }))
    .filter((o) => o.place !== null);
}

/**
 * Pure function. The options that belong to one card or slot on the table.
 *
 * Args:
 *     options (Array): From optionPlaces.
 *     at ({p, kind, seq, name?}): The slot / pile / list card being asked about.
 *         A card in a list (hand, extra, GY, banished) matches by its index (two
 *         copies of one card are two different cards); asking about the whole
 *         pile (`seq` null) returns every option in it — that is what lights
 *         the pile itself; a hand option whose label predates indices matches
 *         by name instead.
 *
 * Returns:
 *     Array: The matching options, in menu order.
 *
 * Examples:
 *     >>> const opts = optionPlaces(["Set spell/trap Dark Hole (P0 hand 2)", "Set spell/trap Dark Hole (P0 hand 3)", "Activate Dark Hole (P0 hand 3)"])
 *     >>> optionsAt(opts, {p: 0, kind: "hand", seq: 2, name: "Dark Hole"}).map((o) => o.index)   // [0]
 *     >>> optionsAt(opts, {p: 0, kind: "hand", seq: 3, name: "Dark Hole"}).map((o) => o.index)   // [1, 2]
 *     >>> optionsAt(optionPlaces(["Set monster Kuriboh (P0 hand)"]), {p: 0, kind: "hand", seq: 0, name: "Kuriboh"}).length  // 1
 *     >>> const pile = optionPlaces(["Special summon Kagari (P0 extra 2)", "Special summon Shizuku (P0 extra 4)"])
 *     >>> optionsAt(pile, {p: 0, kind: "extra", seq: null}).map((o) => o.index)   // [0, 1]   (the whole pile)
 *     >>> optionsAt(pile, {p: 0, kind: "extra", seq: 4}).map((o) => o.index)      // [1]      (one card in the pile viewer)
 */
export function optionsAt(options, at) {
  return options.filter((o) => {
    if (o.place.p !== at.p || o.place.kind !== at.kind) return false;
    if (at.kind === "m" || at.kind === "s") return o.place.seq === at.seq;
    if (at.seq === null || at.seq === undefined) return true; // the whole pile
    if (o.place.seq === null) return at.kind === "hand" && Boolean(at.name && o.name && (o.name === at.name || o.label.includes(at.name)));
    return o.place.seq === at.seq;
  });
}

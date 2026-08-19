/**
 * Count-distribution menus (mode "counters", src/menu.js SELECT_COUNTER): the
 * answer is option:count pairs ("1:2,3:1") that must sum to an exact total,
 * each option capped by how many counters its card holds ("… (has 4)").
 *
 * The duel page keeps ONE counts array (index-aligned with the menu items) as
 * the source of truth; the aside's steppers/badges, the free-text box and the
 * table's card bubbles are all views over it, kept in sync through these
 * helpers. They only read and render presentation strings — the engine's
 * parser (menu.js chooseFromMenu) stays the sole authority on the submitted
 * answer, which is always the same "1:2,3:1" text a typed answer uses.
 *
 * Pure: strings and arrays in, strings and arrays out.
 */

/**
 * Pure function. How many counters an option's card can give up — the
 * "(has N)" suffix menu.js puts on every SELECT_COUNTER item — or null when
 * the label carries no cap.
 *
 * @param {string} label - One menu item's label.
 * @returns {number|null}
 *
 * @example capOf("Mythical Beast Jackal King (P0 m0) (has 4)") // 4
 * @example capOf("Mythical Institution (P0 s1) (has 2)") // 2
 * @example capOf("End turn") // null
 */
export function capOf(label) {
  const m = String(label).match(/\(has (\d+)\)\s*$/);
  return m ? Number(m[1]) : null;
}

/**
 * Pure function. The exact total a counters menu wants, read from its title
 * ("P0: remove 3 counter(s) of type #1 — …"), or null when the title does not
 * say — the UI then accepts any positive total and the engine has the last
 * word on a wrong one.
 *
 * @param {string} title - The menu title.
 * @returns {number|null}
 *
 * @example neededOf("P0: remove 3 counter(s) of type #1 — answer as option:count, e.g. 1:2") // 3
 * @example neededOf("P0: choose a main phase action") // null
 */
export function neededOf(title) {
  const m = String(title).match(/remove (\d+) counter/);
  return m ? Number(m[1]) : null;
}

/**
 * Pure function. The canonical "option:count" answer text for a counts array —
 * exactly the syntax chooseFromMenu parses, so submitting it reuses the text
 * path unchanged. Zero entries are omitted; all zeros renders as "".
 *
 * @param {number[]} counts - Count per option, index-aligned with the menu items.
 * @returns {string}
 *
 * @example countsToText([2, 0, 1]) // "1:2,3:1"
 * @example countsToText([0, 0, 0]) // ""
 */
export function countsToText(counts) {
  return counts.flatMap((n, i) => (n > 0 ? [`${i + 1}:${n}`] : [])).join(",");
}

/**
 * Pure function. Parses "1:2,3:1" into a full-length counts array, or null
 * when the text is not (yet) a valid answer: a malformed pair (e.g. while
 * still typing), an option number outside 1..caps.length, or a count above
 * its option's cap. "" parses as all zeros; a repeated option keeps the last
 * pair, exactly as chooseFromMenu does.
 *
 * @param {string} text - The free-text answer as typed.
 * @param {Array<number|null>} caps - Per-option caps (capOf); null = uncapped.
 * @returns {number[]|null}
 *
 * @example textToCounts("1:2,3:1", [4, 2, 2]) // [2, 0, 1]
 * @example textToCounts("", [4, 2]) // [0, 0]
 * @example textToCounts("1:9", [4, 2]) // null (over the cap)
 * @example textToCounts("1:", [4, 2]) // null (malformed — mid-typing)
 * @example textToCounts("3:1", [4, 2]) // null (no option 3)
 */
export function textToCounts(text, caps) {
  const counts = caps.map(() => 0);
  const trimmed = String(text).trim();
  if (trimmed === "") return counts;
  for (const part of trimmed.split(",")) {
    const m = part.trim().match(/^(\d+):(\d+)$/);
    if (!m) return null;
    const index = Number(m[1]) - 1;
    const count = Number(m[2]);
    if (index < 0 || index >= caps.length) return null;
    if (caps[index] !== null && count > caps[index]) return null;
    counts[index] = count;
  }
  return counts;
}

/**
 * Pure function. A copy of the counts with option `index` stepped by `delta`,
 * clamped into 0..cap — the −/+ stepper behaviour.
 *
 * @param {number[]} counts - Current counts.
 * @param {number} index - 0-based option index to step.
 * @param {number} delta - +1 or -1.
 * @param {number|null} cap - The option's cap (capOf); null = uncapped.
 * @returns {number[]}
 *
 * @example steppedAt([2, 0], 1, +1, 2) // [2, 1]
 * @example steppedAt([2, 0], 0, +1, 2) // [2, 0] (already at the cap)
 * @example steppedAt([2, 0], 1, -1, 2) // [2, 0] (already at 0)
 */
export function steppedAt(counts, index, delta, cap) {
  const top = cap ?? Infinity;
  return counts.map((n, i) => (i === index ? Math.min(top, Math.max(0, n + delta)) : n));
}

/**
 * Pure function. A copy of the counts with option `index` bumped by one — the
 * card-click behaviour. A bump AT the cap wraps to 0 (chosen over "do
 * nothing" so a card stays fully click-operable: keep clicking and you cycle
 * through 0 again, undoing a misclick without touching the steppers).
 *
 * @param {number[]} counts - Current counts.
 * @param {number} index - 0-based option index to bump.
 * @param {number|null} cap - The option's cap (capOf); null = uncapped.
 * @returns {number[]}
 *
 * @example bumpedAt([0, 0], 0, 2) // [1, 0]
 * @example bumpedAt([1, 0], 0, 2) // [2, 0]
 * @example bumpedAt([2, 0], 0, 2) // [0, 0] (at the cap — wraps)
 */
export function bumpedAt(counts, index, cap) {
  return counts.map((n, i) => (i === index ? (cap !== null && n >= cap ? 0 : n + 1) : n));
}

/**
 * Pure function. Sum of a counts array — the running "N of M" total.
 *
 * @param {number[]} counts - Count per option.
 * @returns {number}
 *
 * @example totalOf([2, 0, 1]) // 3
 * @example totalOf([]) // 0
 */
export function totalOf(counts) {
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * Pure function. Whether a counts array is a submittable answer: every count
 * within its cap and the total exactly the needed amount — or, when the menu
 * stated no total (neededOf null), any positive total, leaving the verdict to
 * the engine.
 *
 * @param {number[]} counts - Count per option.
 * @param {Array<number|null>} caps - Per-option caps (capOf).
 * @param {number|null} needed - Exact total wanted (neededOf).
 * @returns {boolean}
 *
 * @example countsReady([2, 1], [4, 2], 3) // true
 * @example countsReady([2, 0], [4, 2], 3) // false (one short)
 * @example countsReady([2, 2], [4, 2], 3) // false (one over)
 * @example countsReady([5, 0], [4, 2], 5) // false (over the first cap)
 * @example countsReady([1, 0], [4, 2], null) // true (no stated total)
 */
export function countsReady(counts, caps, needed) {
  if (counts.some((n, i) => caps[i] !== null && n > caps[i])) return false;
  const total = totalOf(counts);
  return needed === null ? total > 0 : total === needed;
}

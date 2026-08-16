/**
 * Seeded RNG and shuffling.
 *
 * Why this exists: the core's own deck shuffle proved unreliable (passing
 * `sequence: 2` to duelNewCard left both decks in insertion order, so both
 * players drew identical hands). We shuffle the passcode list ourselves before
 * handing cards to the engine. The side benefit is the one that matters more:
 * a duel becomes fully reproducible from its integer seed, so two agent
 * strategies can be compared on literally the same shuffles.
 */

/** mulberry32 constants — a small, fast, well-distributed 32-bit PRNG. */
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_MUL_A = 61;
const MULBERRY_SHIFT_A = 15;
const MULBERRY_SHIFT_B = 7;
const MULBERRY_SHIFT_C = 14;
const UINT32_SCALE = 4294967296;

/**
 * Pure function. Builds a mulberry32 generator from a 32-bit seed.
 *
 * The returned closure is impure (it advances internal state); the factory
 * itself is pure, and identical seeds always produce identical sequences.
 *
 * Args:
 *     seed (number): 32-bit integer seed.
 *
 * Returns:
 *     function(): number - Successive floats in [0, 1).
 *
 * Examples:
 *     >>> const r = mulberry32(42); r() === mulberry32(42)() // true
 *     >>> const r2 = mulberry32(1); r2() >= 0 && r2() < 1    // true
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> MULBERRY_SHIFT_A), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_B), t | MULBERRY_MUL_A);
    return ((t ^ (t >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_SCALE;
  };
}

/**
 * Pure function. Fisher-Yates shuffle returning a new array; input untouched.
 *
 * Args:
 *     items (Array): Items to shuffle.
 *     seed (number): 32-bit integer seed.
 *
 * Returns:
 *     Array: A new array holding the same items in shuffled order.
 *
 * Examples:
 *     >>> shuffled([1,2,3,4,5], 7).length                   // 5
 *     >>> shuffled([1,2,3], 9).join() === shuffled([1,2,3], 9).join() // true
 *     >>> const a = [1,2,3]; shuffled(a, 4); a.join()       // "1,2,3"
 */
export function shuffled(items, seed) {
  const next = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pure function. Derives a distinct sub-seed from a base seed and a label.
 *
 * Lets one duel seed drive several independent streams (player 0's shuffle,
 * player 1's shuffle, the core's own RNG) without them correlating.
 *
 * Args:
 *     seed (number): Base 32-bit seed.
 *     label (string): Stream name, e.g. "deck0".
 *
 * Returns:
 *     number: A 32-bit sub-seed.
 *
 * Examples:
 *     >>> subSeed(1, "deck0") === subSeed(1, "deck1") // false
 *     >>> subSeed(1, "deck0") === subSeed(1, "deck0") // true
 */
export function subSeed(seed, label) {
  let hash = seed >>> 0;
  for (const char of label) {
    hash = Math.imul(hash ^ char.charCodeAt(0), MULBERRY_INCREMENT) >>> 0;
  }
  return hash >>> 0;
}

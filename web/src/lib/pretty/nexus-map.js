/**
 * Our cue names -> Dueling Nexus sound filenames.
 *
 * The Nexus duel client ships one wav per duel event under
 * https://duelingnexus.com/assets/sounds/; bin/fetch-nexus-sfx.sh downloads them
 * into vendor/nexus/sfx/ (gitignored, personal use) and the /nexus-sfx/ route
 * serves them. They are the preferred source for every cue they cover because
 * they were authored for exactly these events — the CC0 files in
 * web/static/sfx/ and the synth in sound.js cover the rest.
 *
 * Nexus names events noun-first (summon-special, life-damage, next-turn) where
 * we use EDOPro's names (specialsummon, damage, nextturn), hence this table.
 * The alias keys (`recover`, `turn`) mirror sound.js's ALIASES so a lookup by
 * either name works. Cues with no Nexus file — hit, destroyed, banished,
 * tribute, poschange, resolve, reveal, removecounter, directattack, win, lose,
 * turn-bell — are deliberately absent; the set simply has nothing for them.
 */

/** Cue name -> filename in vendor/nexus/sfx/. Absent key = no Nexus sound. */
export const NEXUS_FILES = {
  // Summoning family.
  summon: "summon.wav",
  specialsummon: "summon-special.wav",
  flip: "summon-flip.wav",
  set: "set.wav",
  // Cards and effects.
  activate: "activate.wav",
  chain: "chain.wav",
  negate: "negate.wav",
  equip: "equip.wav",
  addcounter: "counter.wav",
  // Combat and life points.
  attack: "attack.wav",
  damage: "life-damage.wav",
  gainlp: "life-recover.wav",
  recover: "life-recover.wav",
  // Piles and randomness.
  draw: "draw.wav",
  shuffle: "shuffle.wav",
  coinflip: "coin-flip.wav",
  diceroll: "dice-roll.wav",
  // Structure.
  phase: "next-phase.wav",
  nextturn: "next-turn.wav",
  turn: "next-turn.wav",
};

/**
 * Pure function. The URL of a cue's Nexus sound, or null if the set has none.
 *
 * @param {string} name - Cue name, e.g. "specialsummon"
 * @returns {string|null} URL under /nexus-sfx/, or null
 *
 * @example nexusUrl("specialsummon") // "/nexus-sfx/summon-special.wav"
 * @example nexusUrl("draw")          // "/nexus-sfx/draw.wav"
 * @example nexusUrl("banished")      // null
 */
export function nexusUrl(name) {
  return NEXUS_FILES[name] ? `/nexus-sfx/${NEXUS_FILES[name]}` : null;
}

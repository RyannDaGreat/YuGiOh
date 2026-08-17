/**
 * Duel sound effects. Real audio files from web/static/sfx/<name>.(ogg|mp3|wav)
 * when present (see web/static/ASSET-LICENSES.md); a tiny WebAudio synth stands
 * in for any cue that has no file, so the app never goes silent.
 *
 * The cue names are EDOPro's (summon, specialsummon, activate, set, flip,
 * reveal, equip, destroyed, banished, attack, directattack, draw, shuffle,
 * damage, gainlp, addcounter, removecounter, coinflip, diceroll, nextturn,
 * phase) plus ours for things EDOPro does not voice separately (hit, tribute,
 * chain, resolve, poschange, lose, turn-bell). One cue per distinct happening
 * in the animation digest (src/events.js) — that is the point of the set: the
 * ear should be able to tell a tribute summon from a special summon without
 * looking. The single source of truth for which cues exist is `synth` below;
 * every cue has a fallback there whether or not a file backs it.
 *
 * Browsers only allow audio after a user gesture; `unlock()` must be called
 * from a click handler once (the mute toggle does it).
 */

/** File basenames to try when a cue's own name has no file, so older files keep working. */
const ALIASES = { gainlp: "recover", nextturn: "turn" };
const EXTENSIONS = ["ogg", "mp3", "wav"];
/** Loaded HTMLAudioElements by cue name (only cues that have a file). */
const clips = new Map();
/** Volume for file clips (synth has its own master gain). */
const CLIP_VOLUME = 0.5;

/**
 * Query. The URLs to try for one cue, in order: its own name, then its alias.
 *
 * @param {string} name - Cue name
 * @returns {string[]} Candidate URLs under /sfx/
 *
 * @example candidateUrls("flip")   // ["/sfx/flip.ogg", "/sfx/flip.mp3", "/sfx/flip.wav"]
 * @example candidateUrls("gainlp") // ["/sfx/gainlp.ogg", ..., "/sfx/recover.ogg", ...]
 */
function candidateUrls(name) {
  const basenames = ALIASES[name] ? [name, ALIASES[name]] : [name];
  return basenames.flatMap((base) => EXTENSIONS.map((ext) => `/sfx/${base}.${ext}`));
}

/**
 * Command. Finds which cue files exist and preloads them. Called once by unlock().
 */
async function loadClips() {
  await Promise.all(Object.keys(synth).map(async (name) => {
    for (const url of candidateUrls(name)) {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.volume = CLIP_VOLUME;
        clips.set(name, audio);
        return;
      }
    }
  }));
}

/**
 * Command. Plays a cue: the file clip if one exists, else the synth fallback.
 */
function cue(name, fallback) {
  if (muted) return;
  const clip = clips.get(name);
  if (clip) {
    const node = clip.cloneNode();
    node.volume = CLIP_VOLUME;
    node.play().catch(() => {});
    return;
  }
  fallback();
}

/** Master volume, deliberately modest. */
const MASTER_GAIN = 0.18;

let ctx = null;
let master = null;
let muted = true;

/**
 * Command. Creates/resumes the AudioContext; call from a user gesture.
 * Returns whether sound is now on.
 */
export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  muted = false;
  if (clips.size === 0) loadClips();
  return true;
}

/** Command. Silences everything until unlock() is called again. */
export function mute() {
  muted = true;
}

/** Query. Whether sound is currently enabled. */
export function isOn() {
  return !muted && ctx !== null;
}

/**
 * Command. Plays a tone: type, start/end frequency (Hz), duration (s), gain.
 * A sweep from f0 to f1 gives most of the character.
 */
function tone(type, f0, f1, duration, gain = 1, when = 0) {
  if (muted || !ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/**
 * Command. Plays a filtered noise burst — swooshes and impacts.
 */
function noise(duration, cutoffFrom, cutoffTo, gain = 1, when = 0) {
  if (muted || !ctx) return;
  const t = ctx.currentTime + when;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoffFrom, t);
  filter.frequency.exponentialRampToValueAtTime(cutoffTo, t + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
}

/**
 * Command. Plays the same short noise tick several times — rattles and clatters.
 */
function ticks(count, spacing, duration, cutoffFrom, cutoffTo, gain) {
  for (let k = 0; k < count; k++) noise(duration, cutoffFrom, cutoffTo, gain, k * spacing);
}

/**
 * Synth fallbacks, one per cue. This object IS the cue list: `sfx` is built
 * from its keys, so a cue cannot exist without a fallback.
 */
const synth = {
  // Summoning family: rising and bright, each bigger than the last.
  summon: () => { tone("triangle", 330, 660, 0.25, 0.6); tone("triangle", 660, 990, 0.25, 0.4, 0.12); },
  specialsummon: () => { tone("triangle", 392, 784, 0.3, 0.6); tone("triangle", 587, 1175, 0.3, 0.45, 0.1); tone("sine", 880, 1760, 0.25, 0.3, 0.2); },
  tribute: () => { tone("sine", 220, 70, 0.35, 0.7); noise(0.2, 800, 120, 0.5); },
  flip: () => { tone("square", 500, 1000, 0.15, 0.25); },
  set: () => { noise(0.12, 1500, 300, 0.4); },
  poschange: () => { noise(0.1, 900, 250, 0.3); },
  // Cards and effects.
  activate: () => { tone("sine", 880, 1320, 0.18, 0.5); tone("sine", 1320, 1760, 0.18, 0.4, 0.1); },
  chain: () => { tone("triangle", 520, 780, 0.12, 0.35); tone("triangle", 780, 1040, 0.12, 0.25, 0.07); },
  resolve: () => { tone("sine", 900, 450, 0.25, 0.35); },
  reveal: () => { tone("sine", 1046, 1568, 0.22, 0.4); },
  equip: () => { tone("square", 700, 1400, 0.12, 0.25); tone("square", 1050, 1400, 0.12, 0.2, 0.08); },
  addcounter: () => { tone("square", 900, 1400, 0.08, 0.25); },
  removecounter: () => { tone("square", 1400, 900, 0.08, 0.25); },
  // Combat and removal.
  attack: () => { noise(0.35, 400, 6000, 0.8); tone("sawtooth", 200, 900, 0.3, 0.3); },
  directattack: () => { noise(0.45, 300, 7000, 0.9); tone("sawtooth", 150, 600, 0.4, 0.4); },
  hit: () => { noise(0.25, 3000, 80, 1); tone("sine", 140, 40, 0.3, 0.9); },
  destroyed: () => { noise(0.5, 1200, 60, 0.9); tone("sawtooth", 180, 30, 0.5, 0.7); },
  banished: () => { noise(0.45, 200, 5000, 0.6); tone("sine", 300, 1800, 0.4, 0.35); },
  // Life points.
  damage: () => { tone("sawtooth", 300, 60, 0.5, 0.6); },
  gainlp: () => { tone("sine", 600, 1200, 0.4, 0.4); },
  // Piles and randomness.
  draw: () => { noise(0.08, 2000, 500, 0.3); },
  shuffle: () => { ticks(4, 0.06, 0.05, 2500, 600, 0.25); },
  coinflip: () => { tone("triangle", 1200, 900, 0.25, 0.3); tone("triangle", 1500, 1100, 0.25, 0.2, 0.05); },
  diceroll: () => { ticks(3, 0.055, 0.04, 4000, 1500, 0.4); },
  // Structure and endings.
  nextturn: () => { tone("sine", 440, 440, 0.12, 0.3); },
  phase: () => { tone("sine", 660, 660, 0.06, 0.15); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone("triangle", f, f, 0.35, 0.5, i * 0.15)); },
  lose: () => { [523, 415, 349, 262].forEach((f, i) => tone("triangle", f, f, 0.35, 0.45, i * 0.15)); },
  "turn-bell": () => { tone("sine", 1568, 1568, 0.5, 0.4); tone("sine", 2093, 2093, 0.4, 0.2); },
};

/**
 * Named effects, one per cue: file clip if present, else synth. The old names
 * `recover` and `turn` stay callable as aliases of `gainlp` and `nextturn`.
 */
export const sfx = Object.fromEntries([
  ...Object.keys(synth).map((name) => [name, () => cue(name, synth[name])]),
  ...Object.entries(ALIASES).map(([canonical, old]) => [old, () => cue(canonical, synth[canonical])]),
]);

/**
 * Duel sound effects. Real audio files from web/static/sfx/<name>.(ogg|mp3|wav)
 * when present (see web/static/ASSET-LICENSES.md); a tiny WebAudio synth stands
 * in for any cue that has no file, so the app never goes silent.
 *
 * Browsers only allow audio after a user gesture; `unlock()` must be called
 * from a click handler once (the mute toggle does it).
 */

/** Cue names; each may have a file under /sfx/ and always has a synth fallback. */
const CUES = ["attack", "hit", "damage", "recover", "summon", "set", "draw", "activate", "flip", "turn", "win"];
const EXTENSIONS = ["ogg", "mp3", "wav"];
/** Loaded HTMLAudioElements by cue name (only cues that have a file). */
const clips = new Map();
/** Volume for file clips (synth has its own master gain). */
const CLIP_VOLUME = 0.5;

/**
 * Command. Finds which cue files exist and preloads them. Called once by unlock().
 */
async function loadClips() {
  await Promise.all(CUES.map(async (name) => {
    for (const ext of EXTENSIONS) {
      const url = `/sfx/${name}.${ext}`;
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
function cue(name, synth) {
  if (muted) return;
  const clip = clips.get(name);
  if (clip) {
    const node = clip.cloneNode();
    node.volume = CLIP_VOLUME;
    node.play().catch(() => {});
    return;
  }
  synth();
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

/** Synth fallbacks, one per cue. */
const synth = {
  attack: () => { noise(0.35, 400, 6000, 0.8); tone("sawtooth", 200, 900, 0.3, 0.3); },
  hit: () => { noise(0.25, 3000, 80, 1); tone("sine", 140, 40, 0.3, 0.9); },
  summon: () => { tone("triangle", 330, 660, 0.25, 0.6); tone("triangle", 660, 990, 0.25, 0.4, 0.12); },
  set: () => { noise(0.12, 1500, 300, 0.4); },
  activate: () => { tone("sine", 880, 1320, 0.18, 0.5); tone("sine", 1320, 1760, 0.18, 0.4, 0.1); },
  flip: () => { tone("square", 500, 1000, 0.15, 0.25); },
  damage: () => { tone("sawtooth", 300, 60, 0.5, 0.6); },
  recover: () => { tone("sine", 600, 1200, 0.4, 0.4); },
  draw: () => { noise(0.08, 2000, 500, 0.3); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone("triangle", f, f, 0.35, 0.5, i * 0.15)); },
  turn: () => { tone("sine", 440, 440, 0.12, 0.3); },
};

/** Named effects, one per animation event kind: file clip if present, else synth. */
export const sfx = Object.fromEntries(CUES.map((name) => [name, () => cue(name, synth[name])]));

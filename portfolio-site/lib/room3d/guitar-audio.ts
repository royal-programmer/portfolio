/**
 * The guitar app's sound (round 37d): recorded CC0 samples (public/audio/guitar/*.ogg, 11 notes, loaded the first time the
 * guitar is zoomed and cached), played through Web Audio with `playbackRate` for the pitch. When the samples cannot load or
 * decode (an old Safari without Ogg Vorbis, a missing file) the Karplus-Strong plucks of chord.ts take over, so a tap always
 * sounds. Silent when the site's Sound is off (the page decides and tells the visitor). Every play is logged to
 * `window.__guitarAudio.plays` outside production, which is how the browser tests see a tap or a strum.
 */
import { midiHz, pluck } from "./chord";
import { chordPlan, SAMPLES, voiceFor, type ChordId } from "./guitar";

export type Play = { string: number; fret: number; midi: number; sample: string; rate: number; via: "sample" | "synth"; at: number };

let ctx: AudioContext | null = null;
let loading: Promise<boolean> | null = null;
const buffers = new Map<string, AudioBuffer>();
const synth = new Map<number, AudioBuffer>();
const ringing: Array<AudioBufferSourceNode | null> = [null, null, null, null, null, null];
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 5200;
  master.connect(tone).connect(ctx.destination);
  return ctx;
}

/** Fetches and decodes the samples once (call it when the guitar is zoomed). Resolves true when every note is ready; false means the synth fallback is in use. */
export function loadSamples(): Promise<boolean> {
  if (loading) return loading;
  const c = audio();
  if (!c) return (loading = Promise.resolve(false));
  loading = Promise.all(
    SAMPLES.map(async (s) => {
      const r = await fetch(`/audio/guitar/${s.id}.ogg`);
      if (!r.ok) throw new Error(`${s.id}: ${r.status}`);
      buffers.set(s.id, await c.decodeAudioData(await r.arrayBuffer()));
    }),
  )
    .then(() => true)
    .catch(() => false);
  return loading;
}

export const samplesReady = (): boolean => buffers.size === SAMPLES.length;

const log = (p: Play) => {
  if (process.env.NODE_ENV === "production") return;
  const w = window as unknown as { __guitarAudio?: { plays: Play[]; ready?: boolean } };
  const a = (w.__guitarAudio ??= { plays: [] });
  a.plays.push(p);
  if (a.plays.length > 300) a.plays.shift();
  a.ready = samplesReady();
};

/**
 * Plays one string at a fret, `delay` seconds from now. A new note on a string stops the one still ringing there. Returns what was
 * played (also logged), or null when there is no Web Audio at all.
 */
export function playNote(string: number, fret: number, delay = 0, gain = 0.8): Play | null {
  const c = audio();
  if (!c) return null;
  if (c.state === "suspended") void c.resume();
  const v = voiceFor(string, fret);
  const t0 = c.currentTime + 0.01 + Math.max(0, delay);
  const src = c.createBufferSource();
  let via: Play["via"] = "sample";
  const buf = buffers.get(v.sample);
  if (buf && samplesReady()) {
    src.buffer = buf;
    src.playbackRate.value = v.rate;
  } else {
    via = "synth";
    let b = synth.get(v.midi);
    if (!b) {
      const data = pluck(midiHz(v.midi), c.sampleRate, 2.2, string + 3);
      b = c.createBuffer(1, data.length, c.sampleRate);
      b.getChannelData(0).set(data);
      synth.set(v.midi, b);
    }
    src.buffer = b;
  }
  const g = c.createGain();
  g.gain.setValueAtTime(gain * (via === "synth" ? 0.4 : 1), t0);
  src.connect(g).connect(master ?? c.destination);
  const prev = ringing[string];
  if (prev) {
    try {
      prev.stop(t0 + 0.05);
    } catch {}
  }
  ringing[string] = src;
  src.start(t0);
  src.onended = () => {
    if (ringing[string] === src) ringing[string] = null;
    g.disconnect();
  };
  const p: Play = { string, fret, midi: v.midi, sample: v.sample, rate: v.rate, via, at: performance.now() };
  log(p);
  window.dispatchEvent(new CustomEvent("room3d:strum", { detail: { id: "guitar", audio: true, string } }));
  return p;
}

/** Strums a chord (the shapes in guitar.ts), the strings 30 ms apart, low to high. Returns the notes played. */
export function strumChordNotes(id: ChordId): Play[] {
  return chordPlan(id).flatMap((n) => {
    const p = playNote(n.string, n.fret, n.at, 0.75);
    return p ? [p] : [];
  });
}

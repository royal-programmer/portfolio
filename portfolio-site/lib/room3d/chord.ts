/**
 * The guitar's chords (round 37a), synthesised with Web Audio: no audio files. Each string is a Karplus-Strong pluck
 * (a burst of noise circulating through a short, damped delay line) written into an AudioBuffer, then the strings are
 * started a few milliseconds apart through a low-pass and a gain, so a click sounds like a strum. The notes and the
 * timing are pure (`chordNotes`, `strumPlan`) and checked by `scripts/room3d-check.mjs`; only `strumChord` touches
 * the browser, and it is only called while the site's sound is on (the page decides).
 */
import type { CHORD_IDS } from "./schema";

export type ChordId = (typeof CHORD_IDS)[number];

/** MIDI note numbers of the strings that ring, low to high, in open position. */
const NOTES: Record<ChordId, number[]> = {
  Em: [40, 47, 52, 55, 59, 64],
  Am: [45, 52, 57, 60, 64],
  C: [48, 52, 55, 60, 64],
  G: [43, 47, 50, 55, 59, 67],
  D: [50, 57, 62, 66],
  E: [40, 47, 52, 56, 59, 64],
  A: [45, 52, 57, 61, 64],
  Dm: [50, 57, 62, 65],
};

export const midiHz = (n: number): number => 440 * 2 ** ((n - 69) / 12);

/** The frequencies (Hz) of a chord's strings, low to high. */
export const chordNotes = (id: ChordId): number[] => (NOTES[id] ?? NOTES.Em).map(midiHz);

/** When each string starts (seconds after the strum begins) and how loud: a downstroke, the low strings first and a little harder. */
export function strumPlan(count: number, spread = 0.032): Array<{ at: number; gain: number }> {
  return Array.from({ length: count }, (_, i) => ({ at: i * spread, gain: 0.34 * (1 - (i / Math.max(1, count)) * 0.35) }));
}

/** One plucked string as samples (Karplus-Strong). Deterministic for a given seed. */
export function pluck(freq: number, sampleRate: number, seconds: number, seed = 1, decay = 0.9965): Float32Array {
  const n = Math.max(2, Math.round(sampleRate / freq));
  const line = new Float32Array(n);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    line[i] = (s / 233280) * 2 - 1;
  }
  const out = new Float32Array(Math.round(sampleRate * seconds));
  let p = 0;
  for (let i = 0; i < out.length; i++) {
    const a = line[p];
    const b = line[(p + 1) % n];
    out[i] = a;
    line[p] = (a + b) * 0.5 * decay;
    p = (p + 1) % n;
  }
  return out;
}

let ctx: AudioContext | null = null;

/** Strums the chord now. Returns false when the browser has no Web Audio. Call it from a click (a user gesture). */
export function strumChord(id: ChordId): boolean {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx ??= new AC();
  const c = ctx;
  if (c.state === "suspended") void c.resume();
  const freqs = chordNotes(id);
  const plan = strumPlan(freqs.length);
  const out = c.createGain();
  out.gain.value = 0.9;
  const tone = c.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3200;
  out.connect(tone).connect(c.destination);
  const t0 = c.currentTime + 0.02;
  freqs.forEach((f, i) => {
    const data = pluck(f, c.sampleRate, 2.2, i + 3);
    const buf = c.createBuffer(1, data.length, c.sampleRate);
    buf.getChannelData(0).set(data);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = plan[i].gain;
    src.connect(g).connect(out);
    src.start(t0 + plan[i].at);
  });
  window.setTimeout(() => out.disconnect(), 2800);
  return true;
}

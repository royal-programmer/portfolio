/**
 * The guitar app's music (round 37d), pure: the six strings' tuning, which recorded sample plays a note and how far it is
 * pitch-shifted (`playbackRate`), where a finger lands on the neck, the chord shapes, and the strum timing. The browser side
 * (decoding, playing) is in guitar-audio.ts. Checked by `scripts/room3d-check.mjs`.
 */
import type { CHORD_IDS } from "./schema";

export type ChordId = (typeof CHORD_IDS)[number];

/** Standard tuning, MIDI numbers, string 6 (low E) to string 1 (high e). */
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64] as const;
/** The label of each string, in the same order. */
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"] as const;
/** String numbers as guitarists say them (6 is the thickest). */
export const STRING_NUMBERS = [6, 5, 4, 3, 2, 1] as const;
/** The frets shown on the neck. */
export const FRETS = 12;
/** Fret numbers that carry a marker dot (12 carries two). */
export const MARKERS = [3, 5, 7, 9, 12] as const;

/** The recorded notes (public/audio/guitar/<id>.ogg): file id and the MIDI note it holds. */
export const SAMPLES: ReadonlyArray<{ id: string; midi: number }> = [
  { id: "e2", midi: 40 },
  { id: "a2", midi: 45 },
  { id: "c3", midi: 48 },
  { id: "eb3", midi: 51 },
  { id: "gb3", midi: 54 },
  { id: "a3", midi: 57 },
  { id: "c4", midi: 60 },
  { id: "eb4", midi: 63 },
  { id: "gb4", midi: 66 },
  { id: "a4", midi: 69 },
  { id: "c5", midi: 72 },
];

/** The MIDI note a finger makes: the string's open note plus the fret. */
export const noteFor = (string: number, fret: number): number => OPEN_STRINGS[string] + fret;

/** The sample nearest to a note (ties go to the lower one, so the shift is up, which keeps more of the body). */
export function pickSample(midi: number): { id: string; midi: number } {
  let best = SAMPLES[0];
  for (const s of SAMPLES) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  return best;
}

/** The `playbackRate` that turns a sample into a note. */
export const rateFor = (sampleMidi: number, midi: number): number => 2 ** ((midi - sampleMidi) / 12);

/** The sample and rate for a string and fret. */
export function voiceFor(string: number, fret: number): { sample: string; rate: number; midi: number } {
  const midi = noteFor(string, fret);
  const s = pickSample(midi);
  return { sample: s.id, rate: rateFor(s.midi, midi), midi };
}

/**
 * Where along the neck a point is, as a fret. `u` runs 0..1 over the fretted part, from the nut (0) to the 12th fret line (1), with
 * the frets spaced as on a real neck (each space is 2^(-1/12) of the one before it). The fret that sounds is the one at the far
 * end of the space the finger is in (a finger between the nut and the first fret line makes fret 1). At or below 0 is the open string.
 */
export function fretAt(u: number): number {
  if (!(u > 0)) return 0;
  const x = Math.min(u, 1) * 0.5; // 12 frets cover half the scale length
  const n = Math.floor(-12 * Math.log2(1 - x)) + 1;
  return Math.max(1, Math.min(FRETS, n));
}

/** The position (0..1 along the fretted part) of fret line `n`. */
export const fretLine = (n: number): number => (1 - 2 ** (-n / 12)) / 0.5;

/** The middle of the space that makes fret `n` (where a marker dot or a finger dot sits), 0..1 along the fretted part. */
export const fretMid = (n: number): number => (fretLine(n - 1) + fretLine(n)) / 2;

/** Chord shapes: the fret for each string (low to high), -1 = muted. */
export const CHORD_SHAPES: Record<ChordId, readonly number[]> = {
  Em: [0, 2, 2, 0, 0, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  C: [-1, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  D: [-1, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  A: [-1, 0, 2, 2, 2, 0],
  Dm: [-1, -1, 0, 2, 3, 1],
};

/** Seconds between two strings of one strum: a swipe or a chord starts them 20 to 40 ms apart. */
export const STRUM_GAP = { min: 0.02, max: 0.04, typical: 0.03 } as const;

/** When each string of a chord starts (seconds from the strum), low to high, skipping muted ones. */
export function chordPlan(id: ChordId, gap: number = STRUM_GAP.typical): Array<{ string: number; fret: number; at: number }> {
  const out: Array<{ string: number; fret: number; at: number }> = [];
  let k = 0;
  (CHORD_SHAPES[id] ?? CHORD_SHAPES.Em).forEach((fret, string) => {
    if (fret < 0) return;
    out.push({ string, fret, at: k * gap });
    k++;
  });
  return out;
}

/**
 * A swipe across the strings: when the next crossed string starts, at least `gap` after the one before (`lastAt`, on the audio
 * clock, -Infinity at the start of the swipe) and never in the past (`now`).
 */
export function swipeStart(now: number, lastAt: number, gap: number = STRUM_GAP.typical): number {
  return Math.max(now, lastAt + gap);
}

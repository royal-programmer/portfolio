/**
 * Normal mode's constellations (Round E, Ratul's brief): around each chapter's display, the world's
 * things draw themselves in one stroke language — single-weight line, round caps, the world's colour.
 * Each object is a set of polylines in a unit box (y down). The bike is traced from its model
 * (bike-lines.ts); the rest are drawn here by hand.
 *
 * `place` says where an object stands around the display, in display-widths from its centre
 * (x right, y down), its size as a fraction of the display's width, and its depth (0 far … 1 near).
 */
import { BIKE_LINES } from "./bike-lines";

export type Pt = readonly [number, number];
export type Strokes = ReadonlyArray<ReadonlyArray<Pt>>;
export type Placed = { name: string; strokes: Strokes; place: { x: number; y: number; size: number; depth: number } };

const circle = (cx: number, cy: number, r: number, n = 24): Pt[] => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const line = (...pts: Pt[]): Pt[] => pts;

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------
const laptop: Strokes = [
  rect(0.2, 0.2, 0.6, 0.5),
  line([0.12, 0.74], [0.88, 0.74], [0.8, 0.82], [0.2, 0.82], [0.12, 0.74]),
  line([0.3, 0.32], [0.5, 0.32]),
  line([0.3, 0.4], [0.62, 0.4]),
  line([0.34, 0.48], [0.56, 0.48]),
  line([0.3, 0.56], [0.46, 0.56]),
];
const keyboard: Strokes = [
  rect(0.06, 0.34, 0.88, 0.32),
  ...[0, 1, 2].map((r): Pt[] => line([0.12, 0.42 + r * 0.08], [0.88, 0.42 + r * 0.08])),
  ...[0.2, 0.32, 0.44, 0.56, 0.68, 0.8].map((x): Pt[] => line([x, 0.38], [x, 0.58])),
  line([0.3, 0.62], [0.7, 0.62]),
];
const coffee: Strokes = [
  line([0.3, 0.42], [0.34, 0.86], [0.66, 0.86], [0.7, 0.42]),
  circle(0.5, 0.42, 0.2, 20).map(([x, y]) => [x, 0.42 + (y - 0.42) * 0.3] as const),
  line([0.7, 0.52], [0.84, 0.5], [0.86, 0.66], [0.68, 0.72]),
  line([0.42, 0.3], [0.46, 0.22], [0.42, 0.14]),
  line([0.56, 0.3], [0.6, 0.22], [0.56, 0.14]),
];
const server: Strokes = [
  rect(0.3, 0.1, 0.4, 0.8),
  ...[0.26, 0.42, 0.58, 0.74].map((y): Pt[] => line([0.3, y], [0.7, y])),
  ...[0.18, 0.34, 0.5, 0.66].map((y): Pt[] => circle(0.62, y, 0.018, 8)),
  ...[0.18, 0.34, 0.5, 0.66].map((y): Pt[] => line([0.36, y], [0.52, y])),
];
const branch: Strokes = [
  line([0.3, 0.9], [0.3, 0.16]),
  circle(0.3, 0.16, 0.05, 12),
  circle(0.3, 0.52, 0.05, 12),
  circle(0.3, 0.9, 0.05, 12),
  line([0.3, 0.52], [0.5, 0.42], [0.7, 0.36]),
  circle(0.7, 0.36, 0.05, 12),
  line([0.7, 0.36], [0.7, 0.62], [0.3, 0.82]),
];
const prompt: Strokes = [
  rect(0.1, 0.22, 0.8, 0.56),
  line([0.1, 0.32], [0.9, 0.32]),
  line([0.22, 0.46], [0.32, 0.54], [0.22, 0.62]),
  line([0.38, 0.64], [0.5, 0.64]),
];

const chart: Strokes = [
  line([0.08, 0.84], [0.92, 0.84]),
  ...[[0.2, 0.62, 0.42], [0.32, 0.56, 0.38], [0.44, 0.6, 0.3], [0.56, 0.44, 0.26], [0.68, 0.4, 0.2], [0.8, 0.34, 0.14]].flatMap(([x, lo, hi]): Pt[][] => [line([x, lo + 0.1], [x, hi - 0.06]), rect(x - 0.035, hi, 0.07, lo - hi)]),
];
const clock: Strokes = [circle(0.5, 0.5, 0.36), line([0.5, 0.5], [0.5, 0.26]), line([0.5, 0.5], [0.68, 0.58]), ...[0, 1, 2, 3].map((i): Pt[] => { const a = (i * Math.PI) / 2; return line([0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3], [0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.36]); })];
const journal: Strokes = [rect(0.22, 0.14, 0.56, 0.72), line([0.3, 0.14], [0.3, 0.86]), ...[0.3, 0.42, 0.54, 0.66].map((y): Pt[] => line([0.38, y], [0.7, y])), line([0.6, 0.14], [0.6, 0.06], [0.68, 0.06], [0.68, 0.14])];
const calculator: Strokes = [rect(0.26, 0.1, 0.48, 0.8), rect(0.32, 0.16, 0.36, 0.14), ...[0, 1, 2].flatMap((r) => [0, 1, 2].map((c): Pt[] => rect(0.32 + c * 0.125, 0.38 + r * 0.15, 0.09, 0.09)))];
const monitor2: Strokes = [rect(0.1, 0.16, 0.8, 0.5), line([0.5, 0.66], [0.5, 0.8]), line([0.32, 0.82], [0.68, 0.82]), line([0.18, 0.56], [0.3, 0.42], [0.42, 0.5], [0.56, 0.3], [0.7, 0.38], [0.82, 0.26])];

const camera: Strokes = [
  line([0.14, 0.72], [0.14, 0.34], [0.32, 0.34], [0.38, 0.24], [0.62, 0.24], [0.68, 0.34], [0.86, 0.34], [0.86, 0.72], [0.14, 0.72]),
  circle(0.5, 0.53, 0.15),
  circle(0.5, 0.53, 0.07),
  line([0.72, 0.42], [0.78, 0.42]),
  line([0.22, 0.34], [0.22, 0.28], [0.3, 0.28]),
];
const lens: Strokes = [circle(0.5, 0.5, 0.36), circle(0.5, 0.5, 0.26), circle(0.5, 0.5, 0.12), circle(0.5, 0.5, 0.05, 12), line([0.5 + 0.26 * Math.cos(-0.6), 0.5 + 0.26 * Math.sin(-0.6)], [0.5 + 0.36 * Math.cos(-0.6), 0.5 + 0.36 * Math.sin(-0.6)])];
const tripod: Strokes = [line([0.5, 0.14], [0.5, 0.4]), rect(0.42, 0.08, 0.16, 0.08), line([0.5, 0.4], [0.2, 0.92]), line([0.5, 0.4], [0.8, 0.92]), line([0.5, 0.4], [0.52, 0.92]), line([0.34, 0.66], [0.52, 0.66], [0.66, 0.66])];
const softbox: Strokes = [line([0.5, 0.42], [0.5, 0.92]), line([0.36, 0.92], [0.64, 0.92]), line([0.3, 0.1], [0.7, 0.1], [0.62, 0.4], [0.38, 0.4], [0.3, 0.1]), line([0.38, 0.4], [0.5, 0.42], [0.62, 0.4])];
const film: Strokes = [rect(0.3, 0.2, 0.4, 0.64), ...[0.3, 0.42, 0.54, 0.66, 0.78].map((y): Pt[] => rect(0.33, y, 0.05, 0.05)), ...[0.3, 0.42, 0.54, 0.66, 0.78].map((y): Pt[] => rect(0.62, y, 0.05, 0.05)), line([0.45, 0.36], [0.55, 0.36]), line([0.45, 0.62], [0.55, 0.62])];

const easel: Strokes = [line([0.28, 0.96], [0.5, 0.16], [0.72, 0.96]), line([0.5, 0.74], [0.5, 0.96]), line([0.3, 0.74], [0.7, 0.74]), rect(0.18, 0.26, 0.64, 0.44), line([0.18, 0.58], [0.3, 0.44], [0.4, 0.52], [0.52, 0.36], [0.64, 0.5], [0.82, 0.54])];
const palette: Strokes = [circle(0.5, 0.5, 0.36, 28).map(([x, y]) => [0.5 + (x - 0.5) * 1.15, y] as const), circle(0.68, 0.46, 0.06, 12), circle(0.34, 0.36, 0.05, 12), circle(0.5, 0.3, 0.05, 12), circle(0.3, 0.56, 0.05, 12), circle(0.46, 0.68, 0.05, 12), circle(0.64, 0.66, 0.05, 12)];
const brushes: Strokes = [line([0.3, 0.92], [0.42, 0.2]), line([0.42, 0.2], [0.46, 0.08], [0.5, 0.2]), line([0.6, 0.92], [0.64, 0.3]), rect(0.6, 0.18, 0.08, 0.12), line([0.64, 0.18], [0.66, 0.06])];
const tubes: Strokes = [rect(0.2, 0.3, 0.2, 0.56), rect(0.26, 0.2, 0.08, 0.1), line([0.2, 0.86], [0.4, 0.78]), rect(0.46, 0.34, 0.2, 0.52), rect(0.52, 0.24, 0.08, 0.1), rect(0.72, 0.4, 0.14, 0.46), rect(0.76, 0.3, 0.06, 0.1)];
const pencil: Strokes = [line([0.2, 0.86], [0.76, 0.3]), line([0.26, 0.92], [0.82, 0.36]), line([0.2, 0.86], [0.12, 0.96], [0.26, 0.92]), line([0.76, 0.3], [0.82, 0.36]), line([0.7, 0.24], [0.76, 0.3]), line([0.68, 0.22], [0.74, 0.28])];

const helmet: Strokes = [line([0.16, 0.6], [0.16, 0.5], [0.22, 0.3], [0.38, 0.16], [0.6, 0.14], [0.78, 0.26], [0.86, 0.46], [0.84, 0.72], [0.74, 0.82], [0.5, 0.86], [0.3, 0.8], [0.16, 0.6]), line([0.22, 0.44], [0.74, 0.38], [0.82, 0.5], [0.78, 0.62], [0.26, 0.6], [0.22, 0.44]), line([0.3, 0.72], [0.56, 0.74])];
const gloves: Strokes = [line([0.3, 0.9], [0.3, 0.46], [0.36, 0.26], [0.42, 0.46]), line([0.42, 0.46], [0.46, 0.2], [0.52, 0.44]), line([0.52, 0.44], [0.58, 0.22], [0.62, 0.46]), line([0.62, 0.46], [0.68, 0.3], [0.7, 0.5], [0.7, 0.9], [0.3, 0.9]), line([0.7, 0.56], [0.82, 0.5], [0.72, 0.66]), line([0.3, 0.78], [0.7, 0.78])];
const roadSign: Strokes = [line([0.5, 0.92], [0.5, 0.56]), line([0.5, 0.56], [0.28, 0.34], [0.5, 0.12], [0.72, 0.34], [0.5, 0.56]), line([0.42, 0.42], [0.5, 0.26], [0.58, 0.42]), line([0.4, 0.92], [0.6, 0.92])];
const mountains: Strokes = [line([0.04, 0.8], [0.26, 0.42], [0.38, 0.58], [0.54, 0.22], [0.7, 0.5], [0.8, 0.4], [0.96, 0.8]), line([0.48, 0.34], [0.54, 0.28], [0.6, 0.34]), line([0.04, 0.86], [0.96, 0.86])];

const monitor: Strokes = [rect(0.08, 0.16, 0.84, 0.54), line([0.5, 0.7], [0.5, 0.82]), line([0.34, 0.84], [0.66, 0.84]), circle(0.5, 0.42, 0.085, 18), line([0.5, 0.26], [0.5, 0.35]), line([0.5, 0.49], [0.5, 0.58]), line([0.34, 0.42], [0.43, 0.42]), line([0.57, 0.42], [0.66, 0.42])];
const controller: Strokes = [line([0.2, 0.36], [0.8, 0.36], [0.9, 0.56], [0.86, 0.74], [0.74, 0.7], [0.66, 0.56], [0.34, 0.56], [0.26, 0.7], [0.14, 0.74], [0.1, 0.56], [0.2, 0.36]), circle(0.34, 0.46, 0.05, 12), circle(0.66, 0.5, 0.045, 12), circle(0.74, 0.42, 0.02, 8), circle(0.7, 0.46, 0.02, 8), line([0.26, 0.42], [0.26, 0.5]), line([0.22, 0.46], [0.3, 0.46])];
const headset: Strokes = [line([0.2, 0.6], [0.2, 0.44], [0.3, 0.24], [0.5, 0.16], [0.7, 0.24], [0.8, 0.44], [0.8, 0.6]), rect(0.14, 0.56, 0.14, 0.26), rect(0.72, 0.56, 0.14, 0.26), line([0.28, 0.76], [0.36, 0.84], [0.44, 0.86])];
const mouse: Strokes = [line([0.5, 0.12], [0.3, 0.2], [0.24, 0.5], [0.3, 0.8], [0.5, 0.9], [0.7, 0.8], [0.76, 0.5], [0.7, 0.2], [0.5, 0.12]), line([0.5, 0.12], [0.5, 0.46]), line([0.26, 0.46], [0.74, 0.46]), rect(0.47, 0.26, 0.06, 0.12)];
const trophy: Strokes = [line([0.3, 0.14], [0.7, 0.14], [0.66, 0.5], [0.5, 0.6], [0.34, 0.5], [0.3, 0.14]), line([0.3, 0.22], [0.18, 0.26], [0.22, 0.4], [0.34, 0.42]), line([0.7, 0.22], [0.82, 0.26], [0.78, 0.4], [0.66, 0.42]), line([0.5, 0.6], [0.5, 0.76]), rect(0.36, 0.76, 0.28, 0.08), line([0.3, 0.92], [0.7, 0.92])];

// ---------------------------------------------------------------------------
// Per world: the ring around the display. x, y in display-widths from the display's centre.
// ---------------------------------------------------------------------------
export const CONSTELLATIONS: Record<string, Placed[]> = {
  engineer: [
    { name: "laptop", strokes: laptop, place: { x: -0.62, y: -0.42, size: 0.3, depth: 0.9 } },
    { name: "server", strokes: server, place: { x: 0.54, y: -0.36, size: 0.26, depth: 0.5 } },
    { name: "coffee", strokes: coffee, place: { x: -0.66, y: 0.36, size: 0.2, depth: 1 } },
    { name: "keyboard", strokes: keyboard, place: { x: 0.1, y: 0.52, size: 0.34, depth: 0.8 } },
    { name: "branch", strokes: branch, place: { x: 0.58, y: 0.3, size: 0.18, depth: 0.4 } },
    { name: "prompt", strokes: prompt, place: { x: -0.2, y: -0.56, size: 0.18, depth: 0.3 } },
  ],
  trader: [
    { name: "chart", strokes: chart, place: { x: -0.64, y: -0.36, size: 0.3, depth: 0.9 } },
    { name: "clock", strokes: clock, place: { x: 0.56, y: -0.42, size: 0.18, depth: 0.5 } },
    { name: "journal", strokes: journal, place: { x: -0.64, y: 0.38, size: 0.2, depth: 1 } },
    { name: "calculator", strokes: calculator, place: { x: 0.54, y: 0.3, size: 0.18, depth: 0.6 } },
    { name: "monitor2", strokes: monitor2, place: { x: 0.12, y: 0.54, size: 0.3, depth: 0.7 } },
  ],
  photographer: [
    { name: "camera", strokes: camera, place: { x: -0.64, y: -0.38, size: 0.3, depth: 0.95 } },
    { name: "lens", strokes: lens, place: { x: 0.56, y: -0.4, size: 0.18, depth: 0.6 } },
    { name: "tripod", strokes: tripod, place: { x: 0.56, y: 0.28, size: 0.26, depth: 0.5 } },
    { name: "softbox", strokes: softbox, place: { x: -0.66, y: 0.36, size: 0.26, depth: 0.7 } },
    { name: "film", strokes: film, place: { x: 0.14, y: 0.54, size: 0.16, depth: 0.9 } },
  ],
  artist: [
    { name: "easel", strokes: easel, place: { x: -0.64, y: -0.34, size: 0.32, depth: 0.9 } },
    { name: "palette", strokes: palette, place: { x: 0.56, y: -0.4, size: 0.22, depth: 0.7 } },
    { name: "brushes", strokes: brushes, place: { x: 0.58, y: 0.3, size: 0.22, depth: 0.5 } },
    { name: "tubes", strokes: tubes, place: { x: -0.64, y: 0.38, size: 0.22, depth: 1 } },
    { name: "pencil", strokes: pencil, place: { x: 0.1, y: 0.54, size: 0.2, depth: 0.6 } },
  ],
  ride: [
    { name: "bike", strokes: BIKE_LINES, place: { x: -0.6, y: -0.34, size: 0.46, depth: 1 } },
    { name: "helmet", strokes: helmet, place: { x: 0.56, y: -0.4, size: 0.2, depth: 0.7 } },
    { name: "gloves", strokes: gloves, place: { x: 0.58, y: 0.3, size: 0.18, depth: 0.5 } },
    { name: "roadSign", strokes: roadSign, place: { x: -0.66, y: 0.4, size: 0.2, depth: 0.6 } },
    { name: "mountains", strokes: mountains, place: { x: 0.1, y: 0.56, size: 0.36, depth: 0.3 } },
  ],
  gamer: [
    { name: "monitor", strokes: monitor, place: { x: -0.64, y: -0.36, size: 0.3, depth: 0.9 } },
    { name: "controller", strokes: controller, place: { x: 0.56, y: -0.4, size: 0.24, depth: 0.8 } },
    { name: "headset", strokes: headset, place: { x: 0.58, y: 0.3, size: 0.2, depth: 0.5 } },
    { name: "mouse", strokes: mouse, place: { x: -0.66, y: 0.38, size: 0.14, depth: 1 } },
    { name: "trophy", strokes: trophy, place: { x: 0.12, y: 0.54, size: 0.18, depth: 0.6 } },
  ],
};

export const strokesLength = (s: Strokes) => s.reduce((n, poly) => n + poly.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - poly[i][0], p[1] - poly[i][1]), 0), 0);

/**
 * Normal mode's constellations (Round E, Ratul's brief, redrawn in Round F): around each chapter's
 * display, the world's things draw themselves in one stroke language — single-weight line, round
 * caps, the world's colour. Each object is a set of polylines in a unit box (y down), drawn in
 * place from its own first point; nothing slides in. The bike is traced from its model
 * (bike-lines.ts); the rest are drawn here by hand, detailed enough to read at a glance.
 *
 * `place` says where an object stands around the display, in display-widths from its centre
 * (x right, y down), its size as a fraction of the display's width, and its depth (0 far … 1 near).
 */
import { BIKE_LINES } from "./bike-lines";

export type Pt = readonly [number, number];
export type Strokes = ReadonlyArray<ReadonlyArray<Pt>>;
export type Placed = { name: string; strokes: Strokes; place: { x: number; y: number; size: number; depth: number } };

const TAU = Math.PI * 2;
const circle = (cx: number, cy: number, r: number, n = 28): Pt[] => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);
const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 28): Pt[] => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * TAU) * rx, cy + Math.sin((i / n) * TAU) * ry]);
/** Arc from angle a0 to a1 (radians, y down so angles run clockwise on screen). */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 14): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
/** Rounded rectangle, one closed stroke. */
const rrect = (x: number, y: number, w: number, h: number, r: number): Pt[] => {
  const q = Math.PI / 2;
  const pts: Pt[] = [...arc(x + w - r, y + r, r, -q, 0, 6), ...arc(x + w - r, y + h - r, r, 0, q, 6), ...arc(x + r, y + h - r, r, q, 2 * q, 6), ...arc(x + r, y + r, r, 2 * q, 3 * q, 6)];
  pts.push(pts[0]);
  return pts;
};
const line = (...pts: Pt[]): Pt[] => pts;
/** A thin bar: two parallel lines between p and q, w apart. */
const bar = (p: Pt, q: Pt, w: number): Pt[][] => {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * w * 0.5;
  const ny = (dx / l) * w * 0.5;
  return [line([p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny]), line([p[0] - nx, p[1] - ny], [q[0] - nx, q[1] - ny])];
};
const grid = (x: number, y: number, w: number, h: number, cols: number, rows: number): Pt[][] => [
  ...Array.from({ length: cols - 1 }, (_, i): Pt[] => line([x + (w * (i + 1)) / cols, y], [x + (w * (i + 1)) / cols, y + h])),
  ...Array.from({ length: rows - 1 }, (_, i): Pt[] => line([x, y + (h * (i + 1)) / rows], [x + w, y + (h * (i + 1)) / rows])),
];
/** A row of small keys. */
const keys = (x: number, y: number, n: number, k: number, gap: number): Pt[][] => Array.from({ length: n }, (_, i) => rect(x + i * (k + gap), y, k, k));
/** Radial ticks between two radii. */
const ticks = (cx: number, cy: number, r0: number, r1: number, n: number, a0 = 0, span = TAU): Pt[][] =>
  Array.from({ length: n }, (_, i): Pt[] => {
    const a = a0 + (span * i) / (span === TAU ? n : Math.max(1, n - 1));
    return line([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]);
  });

// ---------------------------------------------------------------------------
// code
// ---------------------------------------------------------------------------
/** Lines of code on a screen: indented runs of varied length, a few split into two tokens. */
const codeLines = (x: number, y: number, w: number, rows: number, step: number, seed = 1): Pt[][] => {
  const out: Pt[][] = [];
  const indents = [0, 1, 2, 2, 3, 2, 1, 2, 3, 3, 2, 1, 0];
  const widths = [0.45, 0.7, 0.55, 0.85, 0.5, 0.65, 0.4, 0.75, 0.6, 0.35, 0.8, 0.5, 0.3];
  for (let i = 0; i < rows; i++) {
    const ind = indents[(i + seed) % indents.length] * 0.07 * w;
    const len = widths[(i * 3 + seed) % widths.length] * (w - ind);
    const yy = y + i * step;
    if (i % 3 === 1) {
      // two tokens: a keyword and the rest
      const k = len * 0.28;
      out.push(line([x + ind, yy], [x + ind + k, yy]), line([x + ind + k + 0.03 * w, yy], [x + ind + len, yy]));
    } else out.push(line([x + ind, yy], [x + ind + len, yy]));
  }
  return out;
};
/** A perspective keyboard: rows of keys between a near edge and a far edge (both run left→right). */
const perspKeys = (far: Pt, farW: number, near: Pt, nearW: number, rows: number, cols: number): Pt[][] => {
  const out: Pt[][] = [];
  const at = (r: number, c: number): Pt => {
    const t = r / rows;
    const cx = far[0] + (near[0] - far[0]) * t;
    const cy = far[1] + (near[1] - far[1]) * t;
    const w = farW + (nearW - farW) * t;
    return [cx - w / 2 + (w * c) / cols, cy];
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = at(r + 0.12, c + 0.1);
      const b = at(r + 0.12, c + 0.9);
      const d = at(r + 0.88, c + 0.9);
      const e = at(r + 0.88, c + 0.1);
      out.push([a, b, d, e, a]);
    }
  }
  return out;
};
const laptop: Strokes = [
  // lid, three-quarter view: outer shell, bezel, screen
  line([0.2, 0.06], [0.8, 0.06], [0.84, 0.5], [0.16, 0.5], [0.2, 0.06]),
  line([0.235, 0.095], [0.765, 0.095], [0.8, 0.465], [0.2, 0.465], [0.235, 0.095]),
  circle(0.5, 0.078, 0.006, 8),
  // code on the screen, a cursor and a status bar
  ...codeLines(0.265, 0.15, 0.47, 9, 0.034, 2),
  rect(0.455, 0.448 - 0.03, 0.012, 0.026),
  line([0.215, 0.44], [0.785, 0.44]),
  line([0.23, 0.452], [0.3, 0.452]),
  line([0.69, 0.452], [0.77, 0.452]),
  // the hinge: two caps
  line([0.16, 0.5], [0.14, 0.53], [0.86, 0.53], [0.84, 0.5]),
  rrect(0.2, 0.505, 0.08, 0.022, 0.008),
  rrect(0.72, 0.505, 0.08, 0.022, 0.008),
  // the base: deck in perspective, front lip, feet
  line([0.14, 0.53], [0.04, 0.84], [0.96, 0.84], [0.86, 0.53]),
  line([0.04, 0.84], [0.05, 0.89], [0.95, 0.89], [0.96, 0.84]),
  line([0.05, 0.89], [0.08, 0.92], [0.92, 0.92], [0.95, 0.89]),
  // keyboard well, keys, the wider bottom row
  line([0.185, 0.56], [0.815, 0.56], [0.855, 0.72], [0.145, 0.72], [0.185, 0.56]),
  ...perspKeys([0.5, 0.56], 0.63, [0.5, 0.69], 0.69, 4, 13),
  ...perspKeys([0.5, 0.69], 0.69, [0.5, 0.72], 0.7, 1, 1).map((k) => k.map(([x, y]): Pt => [0.5 + (x - 0.5) * 0.42, y])),
  line([0.18, 0.7], [0.27, 0.7], [0.27, 0.715], [0.18, 0.715]),
  line([0.73, 0.7], [0.82, 0.7], [0.82, 0.715], [0.73, 0.715]),
  // trackpad, speaker grilles each side of the keyboard
  rrect(0.395, 0.745, 0.21, 0.085, 0.012),
  line([0.5, 0.79], [0.5, 0.83]),
  ...[0.585, 0.61, 0.635, 0.66, 0.685].map((y): Pt[] => line([0.12 + (0.185 - 0.12) * ((y - 0.56) / 0.16) * 0.5, y], [0.165 + (0.145 - 0.165) * ((y - 0.56) / 0.16), y])),
  ...[0.585, 0.61, 0.635, 0.66, 0.685].map((y): Pt[] => line([0.835 + (0.855 - 0.835) * ((y - 0.56) / 0.16), y], [0.88 - (0.185 - 0.12) * ((y - 0.56) / 0.16) * 0.5, y])),
  // ports on the left edge, a thin shadow line under the body
  rrect(0.065, 0.76, 0.03, 0.012, 0.005),
  rrect(0.06, 0.785, 0.03, 0.012, 0.005),
  circle(0.058, 0.815, 0.006, 8),
  ellipse(0.5, 0.945, 0.46, 0.012, 24),
];
const earbuds: Strokes = [
  // the case: lid open on its hinge, the body, the seat each bud sits in
  rrect(0.2, 0.46, 0.6, 0.4, 0.1),
  line([0.22, 0.47], [0.78, 0.47]),
  line([0.24, 0.46], [0.24, 0.26], [0.3, 0.12], [0.7, 0.12], [0.76, 0.26], [0.76, 0.46]),
  rrect(0.3, 0.17, 0.4, 0.22, 0.07),
  line([0.3, 0.3], [0.7, 0.3]),
  rrect(0.33, 0.2, 0.34, 0.08, 0.03),
  circle(0.5, 0.82, 0.013, 8),
  circle(0.5, 0.82, 0.006, 6),
  line([0.42, 0.86], [0.58, 0.86]),
  // left bud: head, stem, the mesh of the speaker, the sensor
  circle(0.38, 0.6, 0.075, 20),
  circle(0.38, 0.6, 0.045, 14),
  ...ticks(0.38, 0.6, 0.015, 0.035, 8),
  rrect(0.355, 0.66, 0.05, 0.17, 0.025),
  line([0.368, 0.72], [0.368, 0.8]),
  line([0.392, 0.72], [0.392, 0.8]),
  line([0.365, 0.835], [0.395, 0.835]),
  // right bud
  circle(0.62, 0.6, 0.075, 20),
  circle(0.62, 0.6, 0.045, 14),
  ...ticks(0.62, 0.6, 0.015, 0.035, 8),
  rrect(0.595, 0.66, 0.05, 0.17, 0.025),
  line([0.608, 0.72], [0.608, 0.8]),
  line([0.632, 0.72], [0.632, 0.8]),
  line([0.605, 0.835], [0.635, 0.835]),
  // the hinge pin, the pairing button on the back, a charging port on the bottom
  line([0.46, 0.46], [0.54, 0.46]),
  circle(0.78, 0.66, 0.016, 10),
  rrect(0.47, 0.86, 0.06, 0.014, 0.006),
];
const monitors: Strokes = [
  // left display: the editor — bezel, sidebar with a file tree, tabs, code, a minimap
  rrect(0.03, 0.14, 0.45, 0.36, 0.015),
  rect(0.05, 0.16, 0.41, 0.32),
  line([0.05, 0.2], [0.46, 0.2]),
  rrect(0.065, 0.17, 0.05, 0.02, 0.004),
  rrect(0.12, 0.17, 0.05, 0.02, 0.004),
  line([0.13, 0.2], [0.13, 0.48]),
  ...[0.235, 0.265, 0.295, 0.325, 0.355, 0.385].map((y, i): Pt[] => line([0.065 + (i % 2 ? 0.015 : 0), y], [0.11, y])),
  ...codeLines(0.15, 0.235, 0.24, 8, 0.03, 1),
  line([0.415, 0.2], [0.415, 0.48]),
  ...[0.23, 0.25, 0.27, 0.29, 0.31, 0.33, 0.35, 0.37, 0.39, 0.41].map((y, i): Pt[] => line([0.425, y], [0.425 + 0.012 + (i % 3) * 0.007, y])),
  line([0.05, 0.455], [0.46, 0.455]),
  // right display: the dashboard — bezel, a line chart on axes, bars, a gauge
  rrect(0.52, 0.14, 0.45, 0.36, 0.015),
  rect(0.54, 0.16, 0.41, 0.32),
  line([0.54, 0.2], [0.95, 0.2]),
  circle(0.56, 0.18, 0.006, 6),
  circle(0.58, 0.18, 0.006, 6),
  circle(0.6, 0.18, 0.006, 6),
  line([0.57, 0.23], [0.57, 0.38], [0.76, 0.38]),
  ...[0.27, 0.31, 0.35].map((y): Pt[] => line([0.56, y], [0.57, y])),
  line([0.58, 0.35], [0.62, 0.3], [0.66, 0.33], [0.7, 0.26], [0.74, 0.29]),
  line([0.58, 0.36], [0.62, 0.34], [0.66, 0.35], [0.7, 0.31], [0.74, 0.33]),
  ...[0, 1, 2, 3, 4].map((i): Pt[] => rect(0.79 + i * 0.03, 0.38 - [0.07, 0.11, 0.05, 0.13, 0.09][i], 0.02, [0.07, 0.11, 0.05, 0.13, 0.09][i])),
  line([0.78, 0.38], [0.94, 0.38]),
  arc(0.67, 0.455, 0.035, Math.PI, TAU, 10),
  line([0.67, 0.455], [0.69, 0.43]),
  line([0.73, 0.42], [0.92, 0.42]),
  line([0.73, 0.445], [0.86, 0.445]),
  line([0.73, 0.47], [0.9, 0.47]),
  // stands: necks, feet, the desk line; a cable from each
  line([0.255, 0.5], [0.255, 0.6]),
  line([0.235, 0.5], [0.235, 0.6]),
  line([0.14, 0.62], [0.35, 0.62], [0.33, 0.6], [0.16, 0.6], [0.14, 0.62]),
  line([0.745, 0.5], [0.745, 0.6]),
  line([0.765, 0.5], [0.765, 0.6]),
  line([0.65, 0.62], [0.86, 0.62], [0.84, 0.6], [0.66, 0.6], [0.65, 0.62]),
  line([0.0, 0.66], [1, 0.66]),
  line([0.26, 0.6], [0.3, 0.64], [0.3, 0.66]),
  line([0.74, 0.6], [0.7, 0.64], [0.7, 0.66]),
];
const coffee: Strokes = [
  // the mug: body with a slight taper, rim, the inner surface, latte swirl
  line([0.28, 0.4], [0.32, 0.84], [0.36, 0.88], [0.64, 0.88], [0.68, 0.84], [0.72, 0.4]),
  ellipse(0.5, 0.4, 0.22, 0.065, 28),
  ellipse(0.5, 0.42, 0.17, 0.045, 22),
  ...(() => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU * 2.2;
      const r = 0.012 + (i / 40) * 0.12;
      pts.push([0.5 + Math.cos(a) * r, 0.425 + Math.sin(a) * r * 0.3]);
    }
    return [pts];
  })(),
  // handle: outer and inner curve
  line([0.72, 0.48], [0.84, 0.46], [0.9, 0.56], [0.86, 0.7], [0.72, 0.76]),
  line([0.72, 0.54], [0.8, 0.53], [0.83, 0.6], [0.8, 0.69], [0.72, 0.7]),
  // a band around the mug and a small mark
  line([0.3, 0.6], [0.7, 0.6]),
  line([0.31, 0.64], [0.69, 0.64]),
  circle(0.5, 0.74, 0.03, 12),
  // saucer: two ellipses and its foot
  ellipse(0.5, 0.9, 0.36, 0.055, 32),
  ellipse(0.5, 0.9, 0.28, 0.035, 24),
  // steam: three wisps
  line([0.4, 0.3], [0.37, 0.24], [0.41, 0.17], [0.38, 0.1], [0.4, 0.05]),
  line([0.5, 0.31], [0.47, 0.24], [0.52, 0.16], [0.49, 0.08], [0.51, 0.02]),
  line([0.6, 0.3], [0.57, 0.24], [0.61, 0.17], [0.58, 0.1], [0.6, 0.05]),
  // two beans on the saucer
  ellipse(0.16, 0.86, 0.045, 0.028, 14),
  line([0.125, 0.87], [0.16, 0.845], [0.2, 0.87]),
  ellipse(0.84, 0.87, 0.045, 0.028, 14),
  line([0.805, 0.86], [0.84, 0.885], [0.88, 0.86]),
];
const keyboard: Strokes = [
  // the body, a slight bevel, the cable
  rrect(0.03, 0.28, 0.94, 0.46, 0.03),
  rrect(0.05, 0.3, 0.9, 0.42, 0.02),
  line([0.5, 0.28], [0.5, 0.2], [0.56, 0.14], [0.68, 0.12], [0.76, 0.14]),
  // function row (smaller), then four rows, then the bottom row
  ...Array.from({ length: 15 }, (_, i): Pt[] => rect(0.07 + i * 0.058, 0.325, 0.046, 0.03)),
  ...keys(0.07, 0.37, 14, 0.05, 0.012),
  ...keys(0.07, 0.432, 13, 0.05, 0.012),
  ...keys(0.085, 0.494, 12, 0.05, 0.012),
  ...keys(0.1, 0.556, 11, 0.05, 0.012),
  rect(0.07, 0.618, 0.1, 0.05),
  rect(0.18, 0.618, 0.06, 0.05),
  rect(0.25, 0.618, 0.06, 0.05),
  rect(0.32, 0.618, 0.33, 0.05),
  rect(0.66, 0.618, 0.06, 0.05),
  rect(0.73, 0.618, 0.06, 0.05),
  // the wide keys: tab, caps, shift, enter, backspace
  rect(0.94 - 0.09, 0.37, 0.09, 0.05),
  rect(0.07, 0.432, 0.06, 0.05),
  rect(0.07, 0.494, 0.078, 0.05),
  rect(0.07, 0.556, 0.094, 0.05),
  rect(0.83, 0.432, 0.12, 0.112),
  rect(0.782, 0.556, 0.168, 0.05),
  // arrow cluster on the bottom right
  rect(0.806, 0.618, 0.044, 0.05),
  rect(0.856, 0.618, 0.044, 0.05),
  rect(0.906, 0.618, 0.044, 0.05),
  line([0.878, 0.628], [0.878, 0.658]),
  line([0.868, 0.64], [0.878, 0.628], [0.888, 0.64]),
  // legends on W A S D and the home-row bumps
  line([0.213, 0.44], [0.22, 0.47], [0.228, 0.45], [0.236, 0.47], [0.243, 0.44]),
  line([0.175, 0.53], [0.185, 0.5], [0.195, 0.53]),
  line([0.237, 0.53], [0.257, 0.53]),
  line([0.237, 0.5], [0.257, 0.5]),
  line([0.237, 0.515], [0.257, 0.515]),
  line([0.299, 0.5], [0.299, 0.53], [0.311, 0.526], [0.315, 0.515], [0.311, 0.504], [0.299, 0.5]),
  line([0.33, 0.526], [0.342, 0.526]),
  line([0.455, 0.526], [0.467, 0.526]),
  // indicator lights
  circle(0.87, 0.34, 0.006, 6),
  circle(0.895, 0.34, 0.006, 6),
  circle(0.92, 0.34, 0.006, 6),
  // the wrist rest
  rrect(0.1, 0.78, 0.8, 0.1, 0.02),
  line([0.14, 0.83], [0.86, 0.83]),
];
const gitBranch: Strokes = [
  // main line with commits
  line([0.26, 0.94], [0.26, 0.06]),
  ...[0.1, 0.26, 0.42, 0.58, 0.74, 0.9].map((y): Pt[] => circle(0.26, y, 0.032, 14)),
  ...[0.1, 0.26, 0.42, 0.58, 0.74, 0.9].map((y): Pt[] => circle(0.26, y, 0.012, 8)),
  // a feature branch: out at 0.74, two commits, merged back at 0.26
  line([0.26, 0.74], [0.32, 0.66], [0.5, 0.62], [0.56, 0.54], [0.56, 0.36]),
  circle(0.56, 0.5, 0.032, 14),
  circle(0.56, 0.32, 0.032, 14),
  line([0.56, 0.29], [0.56, 0.2], [0.44, 0.15], [0.3, 0.12]),
  // a second branch off the feature: one commit, merged into it
  line([0.56, 0.5], [0.66, 0.56], [0.8, 0.6]),
  circle(0.84, 0.62, 0.028, 12),
  line([0.84, 0.65], [0.84, 0.78], [0.72, 0.86], [0.3, 0.9]),
  // a tag flag on the top commit, a HEAD marker, commit hashes as short dashes
  line([0.3, 0.1], [0.44, 0.1], [0.5, 0.07], [0.44, 0.04], [0.3, 0.04]),
  line([0.33, 0.07], [0.42, 0.07]),
  line([0.6, 0.32], [0.72, 0.32], [0.72, 0.36], [0.6, 0.36], [0.6, 0.32]),
  line([0.63, 0.34], [0.69, 0.34]),
  ...[0.26, 0.42, 0.58, 0.74].map((y): Pt[] => line([0.1, y], [0.2, y])),
  ...[0.26, 0.42, 0.58, 0.74].map((y): Pt[] => line([0.13, y + 0.02], [0.18, y + 0.02])),
  // arrowheads on the merges
  line([0.33, 0.11], [0.3, 0.12], [0.32, 0.15]),
  line([0.34, 0.9], [0.3, 0.9], [0.32, 0.87]),
];
const terminal: Strokes = [
  // the window, title bar, traffic lights, a title
  rrect(0.04, 0.14, 0.92, 0.72, 0.03),
  line([0.04, 0.25], [0.96, 0.25]),
  circle(0.1, 0.195, 0.015, 8),
  circle(0.15, 0.195, 0.015, 8),
  circle(0.2, 0.195, 0.015, 8),
  line([0.42, 0.195], [0.58, 0.195]),
  // prompt, a command, output block with indent, a progress bar, a second prompt, the cursor
  line([0.1, 0.32], [0.14, 0.345], [0.1, 0.37]),
  line([0.17, 0.345], [0.28, 0.345]),
  line([0.3, 0.345], [0.46, 0.345]),
  line([0.14, 0.42], [0.4, 0.42]),
  line([0.14, 0.47], [0.52, 0.47]),
  line([0.18, 0.52], [0.44, 0.52]),
  line([0.18, 0.57], [0.6, 0.57]),
  line([0.14, 0.62], [0.3, 0.62]),
  // progress bar
  rect(0.14, 0.665, 0.5, 0.035),
  ...[0.16, 0.19, 0.22, 0.25, 0.28, 0.31, 0.34, 0.37].map((x): Pt[] => line([x, 0.67], [x, 0.695])),
  line([0.4, 0.67], [0.41, 0.6825], [0.4, 0.695]),
  line([0.66, 0.69], [0.74, 0.69]),
  // second prompt + cursor
  line([0.1, 0.755], [0.14, 0.78], [0.1, 0.805]),
  rect(0.17, 0.755, 0.026, 0.05),
  // scrollbar
  line([0.93, 0.28], [0.93, 0.82]),
  rect(0.92, 0.48, 0.02, 0.2),
];
const server: Strokes = [
  // the rack frame with rails and their mounting holes
  rrect(0.2, 0.05, 0.6, 0.9, 0.02),
  line([0.26, 0.05], [0.26, 0.95]),
  line([0.74, 0.05], [0.74, 0.95]),
  ...[0.1, 0.16, 0.22, 0.28, 0.34, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7, 0.76, 0.82, 0.88].flatMap((y): Pt[][] => [circle(0.23, y, 0.006, 6), circle(0.77, y, 0.006, 6)]),
  // five units
  ...[0.09, 0.26, 0.43, 0.6, 0.77].flatMap((y): Pt[][] => [
    rect(0.27, y, 0.46, 0.14),
    // handles each end
    rrect(0.28, y + 0.02, 0.025, 0.1, 0.006),
    rrect(0.695, y + 0.02, 0.025, 0.1, 0.006),
    // three drive bays with latch marks
    rect(0.32, y + 0.025, 0.09, 0.09),
    rect(0.42, y + 0.025, 0.09, 0.09),
    rect(0.52, y + 0.025, 0.09, 0.09),
    line([0.33, y + 0.1], [0.4, y + 0.1]),
    line([0.43, y + 0.1], [0.5, y + 0.1]),
    line([0.53, y + 0.1], [0.6, y + 0.1]),
    // vents and LEDs
    ...[0.035, 0.055, 0.075, 0.095].map((d): Pt[] => line([0.625, y + d], [0.685, y + d])),
    circle(0.635, y + 0.12, 0.006, 6),
    circle(0.655, y + 0.12, 0.006, 6),
    circle(0.675, y + 0.12, 0.006, 6),
  ]),
  // cables out of the back, down to the floor
  line([0.8, 0.3], [0.86, 0.3], [0.9, 0.36], [0.9, 0.95]),
  line([0.8, 0.64], [0.85, 0.64], [0.88, 0.7], [0.88, 0.95]),
  // feet
  rect(0.22, 0.95, 0.06, 0.03),
  rect(0.72, 0.95, 0.06, 0.03),
];

// ---------------------------------------------------------------------------
// trade
// ---------------------------------------------------------------------------
/** A candle: wick above, body, wick below (x centre; o/c open & close; hi/lo). */
const candle = (x: number, o: number, c: number, hi: number, lo: number, w: number): Pt[][] => {
  const top = Math.min(o, c);
  const h = Math.max(0.006, Math.abs(o - c));
  const body = rect(x - w / 2, top, w, h);
  // a bearish body (close below open) gets a fill mark: one diagonal
  const fill = c > o ? [line([x - w / 2, top], [x + w / 2, top + h])] : [];
  return [line([x, hi], [x, top]), line([x, top + h], [x, lo]), body, ...fill];
};
const candles: Strokes = [
  // the chart frame, a faint grid, price ticks on the right, time ticks below
  rect(0.06, 0.08, 0.88, 0.76),
  ...[0.23, 0.38, 0.53, 0.68].map((y): Pt[] => line([0.06, y], [0.94, y])),
  ...[0.23, 0.38, 0.53, 0.68].map((y): Pt[] => line([0.95, y], [0.985, y])),
  ...[0.2, 0.34, 0.48, 0.62, 0.76].map((x): Pt[] => line([x, 0.84], [x, 0.87])),
  // fourteen candles
  ...(
    [
      [0.11, 0.6, 0.56, 0.53, 0.64],
      [0.17, 0.56, 0.6, 0.53, 0.63],
      [0.23, 0.6, 0.5, 0.47, 0.62],
      [0.29, 0.5, 0.53, 0.46, 0.57],
      [0.35, 0.53, 0.42, 0.4, 0.55],
      [0.41, 0.42, 0.47, 0.4, 0.5],
      [0.47, 0.47, 0.36, 0.33, 0.49],
      [0.53, 0.36, 0.4, 0.33, 0.44],
      [0.59, 0.4, 0.3, 0.27, 0.42],
      [0.65, 0.3, 0.34, 0.26, 0.37],
      [0.71, 0.34, 0.22, 0.19, 0.36],
      [0.77, 0.22, 0.27, 0.19, 0.3],
      [0.83, 0.27, 0.17, 0.14, 0.29],
      [0.89, 0.17, 0.2, 0.13, 0.24],
    ] as const
  ).flatMap(([x, o, c, hi, lo]) => candle(x, o, c, hi, lo, 0.036)),
  // a moving average through the candles
  line([0.1, 0.6], [0.2, 0.585], [0.3, 0.54], [0.4, 0.48], [0.5, 0.42], [0.6, 0.36], [0.7, 0.3], [0.8, 0.245], [0.9, 0.2]),
  // volume bars under the price
  ...[0.11, 0.17, 0.23, 0.29, 0.35, 0.41, 0.47, 0.53, 0.59, 0.65, 0.71, 0.77, 0.83, 0.89].map((x, i): Pt[] => rect(x - 0.016, 0.84 - [0.05, 0.03, 0.07, 0.02, 0.06, 0.03, 0.08, 0.03, 0.09, 0.04, 0.1, 0.04, 0.11, 0.05][i], 0.032, [0.05, 0.03, 0.07, 0.02, 0.06, 0.03, 0.08, 0.03, 0.09, 0.04, 0.1, 0.04, 0.11, 0.05][i])),
  line([0.06, 0.72], [0.94, 0.72]),
  // crosshair on the last candle with its price tag
  line([0.89, 0.08], [0.89, 0.84]),
  line([0.06, 0.185], [0.94, 0.185]),
  rrect(0.945, 0.165, 0.055, 0.04, 0.006),
  line([0.955, 0.185], [0.99, 0.185]),
  // legend in the corner: symbol and timeframe
  line([0.09, 0.115], [0.2, 0.115]),
  line([0.22, 0.115], [0.27, 0.115]),
  // an up arrow by the last candle
  line([0.89, 0.11], [0.89, 0.06]),
  line([0.87, 0.08], [0.89, 0.06], [0.91, 0.08]),
];
const bitcoin: Strokes = [
  // coin edge (two rings), reeding, inner field ring
  circle(0.5, 0.5, 0.42, 48),
  circle(0.5, 0.5, 0.37, 44),
  ...ticks(0.5, 0.5, 0.375, 0.415, 36),
  circle(0.5, 0.5, 0.31, 40),
  // the B: stem, two bowls, serifs top and bottom
  line([0.4, 0.3], [0.4, 0.7]),
  line([0.4, 0.3], [0.56, 0.3], [0.615, 0.345], [0.615, 0.435], [0.56, 0.48], [0.4, 0.48]),
  line([0.4, 0.48], [0.59, 0.48], [0.65, 0.53], [0.65, 0.64], [0.59, 0.7], [0.4, 0.7]),
  line([0.44, 0.34], [0.54, 0.34], [0.575, 0.37], [0.575, 0.41], [0.54, 0.44], [0.44, 0.44]),
  line([0.44, 0.52], [0.57, 0.52], [0.61, 0.56], [0.61, 0.62], [0.57, 0.66], [0.44, 0.66]),
  line([0.45, 0.3], [0.45, 0.22]),
  line([0.52, 0.3], [0.52, 0.22]),
  line([0.45, 0.7], [0.45, 0.78]),
  line([0.52, 0.7], [0.52, 0.78]),
  // small lettering marks around the inner ring
  ...ticks(0.5, 0.5, 0.325, 0.345, 12, -Math.PI / 2 + 0.26, Math.PI * 0.85),
  ...ticks(0.5, 0.5, 0.325, 0.345, 12, Math.PI / 2 + 0.26, Math.PI * 0.85),
  // a glint and the coin's shadow
  line([0.3, 0.26], [0.26, 0.3]),
  line([0.34, 0.22], [0.31, 0.25]),
  ellipse(0.5, 0.95, 0.36, 0.02, 24),
];
const dollars: Strokes = [
  // a stack of notes in perspective: three visible edges, the top note drawn in full
  line([0.1, 0.4], [0.72, 0.28], [0.9, 0.42], [0.28, 0.54], [0.1, 0.4]),
  line([0.28, 0.54], [0.28, 0.76]),
  line([0.9, 0.42], [0.9, 0.64]),
  line([0.28, 0.76], [0.9, 0.64]),
  line([0.1, 0.4], [0.1, 0.62], [0.28, 0.76]),
  ...[0.58, 0.62, 0.66, 0.7].map((y): Pt[] => line([0.28, y], [0.9, y - 0.12])),
  ...[0.46, 0.5, 0.54, 0.58].map((y): Pt[] => line([0.1, y], [0.28, y + 0.12])),
  // the top note: inner border, the portrait oval, corner numerals, the seal, the serial
  line([0.16, 0.405], [0.7, 0.3], [0.84, 0.415], [0.3, 0.52], [0.16, 0.405]),
  ellipse(0.5, 0.41, 0.07, 0.065, 20),
  ellipse(0.5, 0.405, 0.035, 0.045, 14),
  line([0.47, 0.44], [0.5, 0.455], [0.53, 0.44]),
  circle(0.26, 0.45, 0.035, 14),
  ...ticks(0.26, 0.45, 0.02, 0.035, 8),
  circle(0.72, 0.36, 0.03, 12),
  // "$" on the two corners and a value line
  line([0.19, 0.39], [0.19, 0.44]),
  line([0.21, 0.4], [0.18, 0.4], [0.18, 0.415], [0.2, 0.415], [0.2, 0.43], [0.17, 0.43]),
  line([0.8, 0.37], [0.8, 0.42]),
  line([0.82, 0.38], [0.79, 0.38], [0.79, 0.395], [0.81, 0.395], [0.81, 0.41], [0.78, 0.41]),
  line([0.38, 0.33], [0.62, 0.285]),
  line([0.38, 0.495], [0.62, 0.45]),
  // the band around the stack
  line([0.46, 0.33], [0.46, 0.36], [0.6, 0.33], [0.6, 0.3]),
  // a stack of coins beside, with edges
  ellipse(0.14, 0.8, 0.09, 0.03, 18),
  line([0.05, 0.8], [0.05, 0.92]),
  line([0.23, 0.8], [0.23, 0.92]),
  ellipse(0.14, 0.92, 0.09, 0.03, 18),
  line([0.05, 0.84], [0.23, 0.84]),
  line([0.05, 0.88], [0.23, 0.88]),
  line([0.14, 0.79], [0.14, 0.81]),
  circle(0.14, 0.8, 0.045, 12),
];
const brain: Strokes = [
  // outline of the brain (side view), the cerebellum, the stem
  line([0.14, 0.52], [0.16, 0.4], [0.24, 0.28], [0.36, 0.2], [0.52, 0.16], [0.68, 0.18], [0.8, 0.26], [0.88, 0.38], [0.88, 0.5], [0.84, 0.6], [0.76, 0.66], [0.66, 0.68], [0.6, 0.74], [0.5, 0.78], [0.4, 0.76], [0.3, 0.7], [0.2, 0.66], [0.14, 0.58], [0.14, 0.52]),
  line([0.6, 0.74], [0.66, 0.8], [0.74, 0.8], [0.8, 0.74], [0.78, 0.68]),
  line([0.66, 0.74], [0.72, 0.76]),
  line([0.64, 0.78], [0.7, 0.79]),
  line([0.56, 0.78], [0.56, 0.88], [0.6, 0.94]),
  line([0.62, 0.8], [0.62, 0.88], [0.6, 0.94]),
  // the main fissure and the folds (gyri) as curling lines
  line([0.5, 0.17], [0.46, 0.3], [0.5, 0.44], [0.46, 0.58], [0.5, 0.72]),
  line([0.2, 0.44], [0.26, 0.38], [0.32, 0.42], [0.38, 0.36], [0.42, 0.42]),
  line([0.22, 0.54], [0.28, 0.5], [0.34, 0.54], [0.4, 0.5], [0.44, 0.56]),
  line([0.26, 0.64], [0.32, 0.6], [0.38, 0.66], [0.44, 0.64]),
  line([0.3, 0.3], [0.36, 0.26], [0.4, 0.32], [0.44, 0.26]),
  line([0.34, 0.22], [0.4, 0.2]),
  line([0.56, 0.24], [0.62, 0.28], [0.68, 0.24], [0.74, 0.3]),
  line([0.54, 0.36], [0.6, 0.32], [0.66, 0.38], [0.72, 0.34], [0.78, 0.4]),
  line([0.54, 0.48], [0.6, 0.44], [0.66, 0.5], [0.74, 0.46], [0.8, 0.52]),
  line([0.56, 0.6], [0.62, 0.56], [0.68, 0.62], [0.76, 0.58]),
  line([0.56, 0.68], [0.62, 0.66]),
  // the mind as a circuit: nodes and traces over the right half
  circle(0.62, 0.3, 0.014, 8),
  circle(0.72, 0.44, 0.014, 8),
  circle(0.64, 0.56, 0.014, 8),
  circle(0.8, 0.58, 0.014, 8),
  line([0.62, 0.314], [0.62, 0.38], [0.72, 0.426]),
  line([0.72, 0.454], [0.72, 0.5], [0.64, 0.546]),
  line([0.654, 0.56], [0.786, 0.58]),
  // a thought spark above
  line([0.82, 0.14], [0.82, 0.08]),
  line([0.76, 0.16], [0.72, 0.12]),
  line([0.88, 0.16], [0.92, 0.12]),
];
const clock: Strokes = [
  // bezel, dial, the minute ring with sixty ticks, bold hour ticks, the quarters longer
  circle(0.5, 0.5, 0.42, 48),
  circle(0.5, 0.5, 0.39, 44),
  circle(0.5, 0.5, 0.34, 40),
  ...Array.from({ length: 60 }, (_, i): Pt[] => {
    const a = (i / 60) * TAU;
    const r1 = i % 15 === 0 ? 0.27 : i % 5 === 0 ? 0.295 : 0.32;
    return line([0.5 + Math.cos(a) * 0.34, 0.5 + Math.sin(a) * 0.34], [0.5 + Math.cos(a) * r1, 0.5 + Math.sin(a) * r1]);
  }),
  // the numerals at 12, 3, 6, 9 as small marks
  line([0.49, 0.2], [0.49, 0.25]),
  line([0.51, 0.2], [0.51, 0.25]),
  line([0.74, 0.47], [0.78, 0.47], [0.78, 0.5], [0.74, 0.5], [0.78, 0.5], [0.78, 0.53], [0.74, 0.53]),
  line([0.5, 0.75], [0.5, 0.8], [0.48, 0.8], [0.48, 0.775], [0.5, 0.775]),
  line([0.26, 0.47], [0.22, 0.47], [0.22, 0.5], [0.26, 0.5], [0.26, 0.53]),
  // a small seconds sub-dial
  circle(0.5, 0.64, 0.05, 16),
  ...ticks(0.5, 0.64, 0.04, 0.05, 12),
  line([0.5, 0.64], [0.52, 0.61]),
  // hour and minute hands as tapered shapes, the second hand thin, the hub
  line([0.5, 0.5], [0.49, 0.48], [0.62, 0.38], [0.63, 0.4], [0.51, 0.52], [0.5, 0.5]),
  line([0.5, 0.5], [0.485, 0.49], [0.495, 0.21], [0.505, 0.21], [0.515, 0.49], [0.5, 0.5]),
  line([0.5, 0.56], [0.36, 0.69]),
  line([0.5, 0.5], [0.46, 0.46]),
  circle(0.5, 0.5, 0.022, 12),
  circle(0.5, 0.5, 0.008, 6),
  // the crown on top, the date window
  rect(0.47, 0.055, 0.06, 0.03),
  line([0.49, 0.05], [0.51, 0.05]),
  rect(0.58, 0.48, 0.07, 0.045),
  line([0.6, 0.49], [0.6, 0.515]),
  line([0.63, 0.49], [0.63, 0.515]),
];
const hourglass: Strokes = [
  // top and bottom plates with turned ends, the three posts
  line([0.2, 0.06], [0.8, 0.06], [0.8, 0.1], [0.2, 0.1], [0.2, 0.06]),
  line([0.2, 0.9], [0.8, 0.9], [0.8, 0.94], [0.2, 0.94], [0.2, 0.9]),
  line([0.24, 0.1], [0.24, 0.9]),
  line([0.26, 0.1], [0.26, 0.9]),
  line([0.74, 0.1], [0.74, 0.9]),
  line([0.76, 0.1], [0.76, 0.9]),
  circle(0.25, 0.14, 0.012, 8),
  circle(0.75, 0.14, 0.012, 8),
  circle(0.25, 0.86, 0.012, 8),
  circle(0.75, 0.86, 0.012, 8),
  // the glass: outer walls and an inner highlight line each side
  line([0.3, 0.1], [0.32, 0.3], [0.48, 0.47], [0.48, 0.53], [0.32, 0.7], [0.3, 0.9]),
  line([0.7, 0.1], [0.68, 0.3], [0.52, 0.47], [0.52, 0.53], [0.68, 0.7], [0.7, 0.9]),
  line([0.34, 0.14], [0.355, 0.3], [0.46, 0.42]),
  line([0.66, 0.74], [0.645, 0.86]),
  // the neck's collar
  ellipse(0.5, 0.5, 0.045, 0.012, 12),
  // sand above: a heap with a dip in the middle, grains
  line([0.36, 0.33], [0.64, 0.33], [0.56, 0.4], [0.5, 0.46], [0.44, 0.4], [0.36, 0.33]),
  line([0.42, 0.33], [0.5, 0.3], [0.58, 0.33]),
  ...[[0.4, 0.36], [0.46, 0.37], [0.54, 0.37], [0.6, 0.36], [0.5, 0.4]].map(([x, y]): Pt[] => circle(x, y, 0.004, 4)),
  // the stream
  line([0.5, 0.53], [0.5, 0.72]),
  line([0.495, 0.58], [0.495, 0.64]),
  // sand below: a cone with grains at the base, and the splash
  line([0.33, 0.88], [0.67, 0.88], [0.5, 0.7], [0.33, 0.88]),
  line([0.38, 0.88], [0.5, 0.76], [0.62, 0.88]),
  ...[[0.42, 0.84], [0.5, 0.82], [0.58, 0.84], [0.46, 0.86], [0.54, 0.86]].map(([x, y]): Pt[] => circle(x, y, 0.004, 4)),
  line([0.46, 0.74], [0.44, 0.72]),
  line([0.54, 0.74], [0.56, 0.72]),
];
const journal: Strokes = [
  // the notebook: cover, spiral rings down the left, a bookmark ribbon
  rrect(0.2, 0.1, 0.58, 0.8, 0.02),
  line([0.26, 0.1], [0.26, 0.9]),
  ...[0.16, 0.26, 0.36, 0.46, 0.56, 0.66, 0.76, 0.86].flatMap((y): Pt[][] => [ellipse(0.2, y, 0.03, 0.02, 10), line([0.2, y - 0.02], [0.16, y - 0.03])]),
  line([0.62, 0.1], [0.62, 0.3], [0.66, 0.26], [0.7, 0.3], [0.7, 0.1]),
  // ruled lines, a title line, a checklist with ticks
  line([0.32, 0.2], [0.6, 0.2]),
  line([0.32, 0.225], [0.52, 0.225]),
  ...[0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8].map((y): Pt[] => line([0.32, y], [0.72, y])),
  rect(0.33, 0.345, 0.03, 0.03),
  line([0.335, 0.36], [0.345, 0.37], [0.36, 0.35]),
  rect(0.33, 0.425, 0.03, 0.03),
  line([0.335, 0.44], [0.345, 0.45], [0.36, 0.43]),
  rect(0.33, 0.505, 0.03, 0.03),
  line([0.38, 0.36], [0.56, 0.36]),
  line([0.38, 0.44], [0.62, 0.44]),
  line([0.38, 0.52], [0.5, 0.52]),
  // a small P&L sketch: a tiny chart on the lower half
  line([0.38, 0.76], [0.38, 0.62], [0.66, 0.62]),
  line([0.4, 0.72], [0.46, 0.68], [0.52, 0.7], [0.58, 0.64], [0.64, 0.66]),
  // the pen across the corner: barrel, cap with clip, nib
  ...bar([0.8, 0.9], [0.9, 0.3], 0.03),
  line([0.8, 0.9], [0.78, 0.96], [0.83, 0.905]),
  line([0.884, 0.4], [0.914, 0.405]),
  line([0.9, 0.3], [0.905, 0.27], [0.925, 0.275], [0.918, 0.31]),
  line([0.908, 0.3], [0.93, 0.42]),
  line([0.868, 0.5], [0.898, 0.505]),
];
const calculator: Strokes = [
  // body and a bevel, the display with a frame and digits as seven-segment-like marks
  rrect(0.24, 0.06, 0.52, 0.88, 0.03),
  rrect(0.27, 0.09, 0.46, 0.82, 0.02),
  rrect(0.3, 0.12, 0.4, 0.15, 0.01),
  ...[0.38, 0.46, 0.54, 0.62].flatMap((x): Pt[][] => [line([x, 0.16], [x + 0.05, 0.16]), line([x + 0.05, 0.16], [x + 0.05, 0.19]), line([x + 0.05, 0.19], [x + 0.05, 0.22]), line([x, 0.22], [x + 0.05, 0.22]), line([x, 0.19], [x + 0.05, 0.19])]),
  circle(0.45, 0.225, 0.004, 4),
  // a solar strip
  rect(0.3, 0.29, 0.16, 0.03),
  line([0.34, 0.29], [0.34, 0.32]),
  line([0.38, 0.29], [0.38, 0.32]),
  line([0.42, 0.29], [0.42, 0.32]),
  // four columns of keys: digits left, operators right, the wide equals at the bottom
  ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c): Pt[] => rrect(0.3 + c * 0.105, 0.36 + r * 0.115, 0.085, 0.085, 0.012))),
  ...[0, 1, 2].map((r): Pt[] => rrect(0.615, 0.36 + r * 0.115, 0.085, 0.085, 0.012)),
  rrect(0.615, 0.705, 0.085, 0.2, 0.012),
  // operator marks: ÷ × − and the = on the tall key, a decimal dot and a 0 on the bottom row
  circle(0.6575, 0.385, 0.004, 4),
  line([0.635, 0.4025], [0.68, 0.4025]),
  circle(0.6575, 0.42, 0.004, 4),
  line([0.64, 0.5], [0.675, 0.535]),
  line([0.675, 0.5], [0.64, 0.535]),
  line([0.635, 0.6325], [0.68, 0.6325]),
  line([0.635, 0.795], [0.68, 0.795]),
  line([0.635, 0.815], [0.68, 0.815]),
  // digit marks on a few keys
  line([0.3425, 0.39], [0.3425, 0.42]),
  line([0.43, 0.39], [0.46, 0.39], [0.46, 0.405], [0.43, 0.405], [0.43, 0.42], [0.46, 0.42]),
  line([0.535, 0.39], [0.565, 0.39], [0.565, 0.42], [0.535, 0.42], [0.535, 0.39]),
  circle(0.447, 0.735, 0.004, 4),
];

// ---------------------------------------------------------------------------
// lens
// ---------------------------------------------------------------------------
/** Aperture blades: n chords inside a ring, each starting where the last one ends. */
const blades = (cx: number, cy: number, r: number, n: number, twist: number): Pt[][] =>
  Array.from({ length: n }, (_, i): Pt[] => {
    const a0 = (i / n) * TAU + twist;
    const a1 = ((i + 1.6) / n) * TAU + twist;
    return line([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [cx + Math.cos(a1) * r * 0.55, cy + Math.sin(a1) * r * 0.55]);
  });
const camera: Strokes = [
  // body: the shell, the grip, the pentaprism hump, the hot shoe
  rrect(0.06, 0.32, 0.88, 0.46, 0.05),
  line([0.06, 0.42], [0.2, 0.42], [0.2, 0.78]),
  line([0.1, 0.46], [0.18, 0.46]),
  line([0.1, 0.52], [0.18, 0.52]),
  line([0.1, 0.58], [0.18, 0.58]),
  line([0.1, 0.64], [0.18, 0.64]),
  line([0.3, 0.32], [0.33, 0.21], [0.51, 0.21], [0.54, 0.32]),
  rect(0.37, 0.17, 0.1, 0.04),
  line([0.39, 0.17], [0.39, 0.21]),
  line([0.45, 0.17], [0.45, 0.21]),
  // the lens: mount ring, barrel rings, focus ring with its grip, front glass with reflections and blades
  circle(0.6, 0.56, 0.22, 40),
  circle(0.6, 0.56, 0.19, 36),
  circle(0.6, 0.56, 0.155, 32),
  ...ticks(0.6, 0.56, 0.16, 0.185, 28),
  circle(0.6, 0.56, 0.11, 28),
  circle(0.6, 0.56, 0.085, 24),
  ...blades(0.6, 0.56, 0.085, 7, 0.4),
  arc(0.6, 0.56, 0.06, Math.PI * 1.1, Math.PI * 1.45, 8),
  arc(0.6, 0.56, 0.04, Math.PI * 1.15, Math.PI * 1.35, 6),
  // the lens release button and the red index dot
  circle(0.37, 0.6, 0.016, 10),
  circle(0.6, 0.345, 0.006, 6),
  // the mode dial on the right shoulder, with ticks and a pointer
  circle(0.82, 0.3, 0.055, 18),
  circle(0.82, 0.3, 0.04, 14),
  ...ticks(0.82, 0.3, 0.042, 0.055, 9, -Math.PI, Math.PI),
  line([0.82, 0.24], [0.82, 0.255]),
  // the shutter button on its collar, the power lever
  circle(0.2, 0.3, 0.024, 12),
  circle(0.2, 0.3, 0.012, 8),
  line([0.14, 0.32], [0.14, 0.29], [0.26, 0.29], [0.26, 0.32]),
  arc(0.2, 0.3, 0.035, Math.PI * 1.1, Math.PI * 1.6, 6),
  // the flash window, the AF lamp, the microphone holes, the brand plate
  rrect(0.3, 0.37, 0.12, 0.05, 0.008),
  line([0.32, 0.395], [0.4, 0.395]),
  circle(0.47, 0.395, 0.012, 8),
  ...[0.84, 0.87, 0.9].map((x): Pt[] => circle(x, 0.4, 0.005, 4)),
  rect(0.84, 0.56, 0.08, 0.035),
  line([0.855, 0.5775], [0.905, 0.5775]),
  // the strap lugs
  circle(0.07, 0.38, 0.014, 8),
  circle(0.93, 0.38, 0.014, 8),
  // the base plate and tripod socket
  line([0.1, 0.78], [0.1, 0.81], [0.9, 0.81], [0.9, 0.78]),
  circle(0.5, 0.795, 0.01, 6),
];
const goldenRatio: Strokes = [
  // the frame and the golden subdivision, then the spiral
  rect(0.04, 0.215, 0.92, 0.57),
  line([0.61, 0.215], [0.61, 0.785]),
  line([0.61, 0.565], [0.96, 0.565]),
  line([0.74, 0.565], [0.74, 0.785]),
  line([0.61, 0.655], [0.74, 0.655]),
  line([0.69, 0.655], [0.69, 0.785]),
  line([0.69, 0.705], [0.74, 0.705]),
  line([0.71, 0.705], [0.71, 0.655]),
  arc(0.61, 0.785, 0.57, Math.PI, Math.PI * 1.5, 24),
  arc(0.61, 0.565, 0.35, Math.PI * 1.5, Math.PI * 2, 18),
  arc(0.74, 0.565, 0.22, 0, Math.PI * 0.5, 14),
  arc(0.74, 0.655, 0.13, Math.PI * 0.5, Math.PI, 10),
  arc(0.69, 0.655, 0.08, Math.PI, Math.PI * 1.5, 8),
  arc(0.69, 0.705, 0.05, Math.PI * 1.5, Math.PI * 2, 6),
  arc(0.71, 0.705, 0.03, 0, Math.PI * 0.5, 5),
  // the diagonal guides of the large square
  line([0.04, 0.215], [0.61, 0.785]),
  line([0.04, 0.785], [0.61, 0.215]),
  // the subject at the spiral's eye and the ratio mark
  circle(0.71, 0.69, 0.014, 8),
  line([0.1, 0.16], [0.14, 0.12], [0.1, 0.08]),
  line([0.17, 0.16], [0.17, 0.08]),
  line([0.2, 0.08], [0.26, 0.16]),
  line([0.26, 0.08], [0.2, 0.16]),
  // ratio bar: 1 : 1.618
  line([0.04, 0.86], [0.61, 0.86]),
  line([0.61, 0.86], [0.96, 0.86]),
  line([0.04, 0.84], [0.04, 0.88]),
  line([0.61, 0.84], [0.61, 0.88]),
  line([0.96, 0.84], [0.96, 0.88]),
];
const thirds: Strokes = [
  // the frame, the thirds grid, corner brackets
  rect(0.06, 0.2, 0.88, 0.6),
  line([0.353, 0.2], [0.353, 0.8]),
  line([0.647, 0.2], [0.647, 0.8]),
  line([0.06, 0.4], [0.94, 0.4]),
  line([0.06, 0.6], [0.94, 0.6]),
  line([0.02, 0.26], [0.02, 0.16], [0.12, 0.16]),
  line([0.88, 0.16], [0.98, 0.16], [0.98, 0.26]),
  line([0.98, 0.74], [0.98, 0.84], [0.88, 0.84]),
  line([0.12, 0.84], [0.02, 0.84], [0.02, 0.74]),
  // the scene: a sun on the upper-left crossing, hills on the lower line, a tree on the right crossing
  circle(0.353, 0.4, 0.05, 18),
  ...ticks(0.353, 0.4, 0.065, 0.085, 8),
  line([0.06, 0.64], [0.18, 0.56], [0.3, 0.62], [0.44, 0.52], [0.56, 0.6], [0.7, 0.54], [0.82, 0.6], [0.94, 0.56]),
  line([0.06, 0.72], [0.24, 0.66], [0.4, 0.7], [0.6, 0.66], [0.78, 0.7], [0.94, 0.68]),
  line([0.647, 0.6], [0.647, 0.46]),
  circle(0.647, 0.4, 0.07, 18),
  circle(0.62, 0.36, 0.04, 12),
  circle(0.68, 0.37, 0.035, 12),
  // birds and the AF point on the tree
  line([0.46, 0.3], [0.48, 0.28], [0.5, 0.3]),
  line([0.52, 0.34], [0.54, 0.32], [0.56, 0.34]),
  rect(0.617, 0.37, 0.06, 0.06),
  // a reflection of the sun in the foreground water
  line([0.32, 0.74], [0.39, 0.74]),
  line([0.33, 0.77], [0.38, 0.77]),
];
const phoneBack: Strokes = [
  // body with its frame line, the antenna breaks, buttons on the sides
  rrect(0.3, 0.04, 0.4, 0.92, 0.08),
  rrect(0.32, 0.06, 0.36, 0.88, 0.07),
  line([0.3, 0.2], [0.32, 0.2]),
  line([0.3, 0.8], [0.32, 0.8]),
  line([0.68, 0.2], [0.7, 0.2]),
  line([0.68, 0.8], [0.7, 0.8]),
  line([0.7, 0.28], [0.715, 0.28], [0.715, 0.34], [0.7, 0.34]),
  line([0.7, 0.4], [0.715, 0.4], [0.715, 0.52], [0.7, 0.52]),
  line([0.3, 0.34], [0.285, 0.34], [0.285, 0.4], [0.3, 0.4]),
  // the camera island: three lenses, each with rings and a glint, the flash, the LiDAR, the mic
  rrect(0.34, 0.1, 0.32, 0.3, 0.06),
  circle(0.43, 0.18, 0.055, 18),
  circle(0.43, 0.18, 0.04, 14),
  circle(0.43, 0.18, 0.02, 10),
  arc(0.43, 0.18, 0.03, Math.PI * 1.1, Math.PI * 1.4, 5),
  circle(0.57, 0.18, 0.055, 18),
  circle(0.57, 0.18, 0.04, 14),
  circle(0.57, 0.18, 0.02, 10),
  arc(0.57, 0.18, 0.03, Math.PI * 1.1, Math.PI * 1.4, 5),
  circle(0.43, 0.32, 0.055, 18),
  circle(0.43, 0.32, 0.04, 14),
  circle(0.43, 0.32, 0.02, 10),
  arc(0.43, 0.32, 0.03, Math.PI * 1.1, Math.PI * 1.4, 5),
  circle(0.57, 0.3, 0.022, 10),
  circle(0.57, 0.3, 0.01, 6),
  circle(0.6, 0.355, 0.012, 8),
  circle(0.54, 0.355, 0.005, 4),
  // the brand mark on the back, a reflection streak
  circle(0.5, 0.62, 0.035, 14),
  line([0.5, 0.585], [0.5, 0.655]),
  line([0.465, 0.62], [0.535, 0.62]),
  line([0.36, 0.5], [0.36, 0.88]),
  // the bottom: speaker holes, the port
  ...[0.4, 0.43, 0.46].map((x): Pt[] => circle(x, 0.9, 0.005, 4)),
  rrect(0.48, 0.89, 0.06, 0.016, 0.006),
  ...[0.58, 0.61, 0.64].map((x): Pt[] => circle(x, 0.9, 0.005, 4)),
];
const tripod: Strokes = [
  // the head: plate, the ball housing, the pan handle, the knobs
  rrect(0.4, 0.06, 0.2, 0.05, 0.012),
  line([0.44, 0.06], [0.44, 0.11]),
  line([0.56, 0.06], [0.56, 0.11]),
  line([0.42, 0.11], [0.58, 0.11], [0.56, 0.17], [0.44, 0.17], [0.42, 0.11]),
  circle(0.5, 0.21, 0.045, 16),
  circle(0.5, 0.21, 0.02, 10),
  line([0.545, 0.2], [0.68, 0.14]),
  rrect(0.67, 0.1, 0.06, 0.03, 0.008),
  circle(0.455, 0.235, 0.012, 8),
  // the centre column with its crank and the hook
  line([0.49, 0.25], [0.49, 0.5]),
  line([0.51, 0.25], [0.51, 0.5]),
  line([0.49, 0.3], [0.51, 0.3]),
  line([0.49, 0.5], [0.51, 0.5]),
  line([0.5, 0.5], [0.5, 0.56]),
  arc(0.5, 0.585, 0.025, -Math.PI / 2, Math.PI, 8),
  // the collar the legs hang from
  rrect(0.42, 0.26, 0.16, 0.05, 0.01),
  // three legs, each in two sections with a lock collar, the middle one foreshortened
  ...bar([0.44, 0.31], [0.33, 0.6], 0.028),
  rrect(0.305, 0.58, 0.07, 0.05, 0.01),
  ...bar([0.33, 0.63], [0.2, 0.92], 0.02),
  line([0.17, 0.92], [0.24, 0.92]),
  ...bar([0.56, 0.31], [0.67, 0.6], 0.028),
  rrect(0.625, 0.58, 0.07, 0.05, 0.01),
  ...bar([0.67, 0.63], [0.8, 0.92], 0.02),
  line([0.76, 0.92], [0.83, 0.92]),
  ...bar([0.5, 0.31], [0.52, 0.62], 0.026),
  rrect(0.49, 0.6, 0.06, 0.05, 0.01),
  ...bar([0.52, 0.65], [0.55, 0.92], 0.018),
  line([0.51, 0.92], [0.59, 0.92]),
  // the spreader between the legs
  line([0.36, 0.52], [0.5, 0.48], [0.64, 0.52]),
  line([0.5, 0.48], [0.515, 0.55]),
  // a ground line
  line([0.1, 0.95], [0.9, 0.95]),
];
const lens: Strokes = [
  // the barrel from the front: filter ring with its thread, the name ring, the glass
  circle(0.5, 0.5, 0.42, 48),
  circle(0.5, 0.5, 0.39, 44),
  ...ticks(0.5, 0.5, 0.39, 0.42, 48),
  circle(0.5, 0.5, 0.33, 40),
  ...ticks(0.5, 0.5, 0.34, 0.36, 10, -Math.PI * 0.95, Math.PI * 0.9),
  circle(0.5, 0.5, 0.27, 36),
  circle(0.5, 0.5, 0.22, 32),
  // aperture: seven blades, the opening in the middle
  ...blades(0.5, 0.5, 0.22, 7, 0.2),
  circle(0.5, 0.5, 0.1, 20),
  // reflections on the glass: two arcs and a small ellipse
  arc(0.5, 0.5, 0.17, Math.PI * 1.1, Math.PI * 1.45, 8),
  arc(0.5, 0.5, 0.13, Math.PI * 1.15, Math.PI * 1.4, 6),
  ellipse(0.58, 0.6, 0.03, 0.015, 10),
  // the distance scale on the barrel's visible edge
  ...ticks(0.5, 0.5, 0.28, 0.3, 7, Math.PI * 0.1, Math.PI * 0.4),
  // a lens cap string lug at the bottom
  circle(0.5, 0.9, 0.012, 8),
  line([0.5, 0.912], [0.5, 0.95]),
];
const softbox: Strokes = [
  // the box: outer and inner face, the diffusion grid, the recessed edges to the speedring
  rect(0.16, 0.04, 0.68, 0.44),
  rect(0.2, 0.08, 0.6, 0.36),
  ...grid(0.2, 0.08, 0.6, 0.36, 5, 3),
  line([0.2, 0.08], [0.42, 0.52]),
  line([0.8, 0.08], [0.58, 0.52]),
  line([0.2, 0.44], [0.42, 0.56]),
  line([0.8, 0.44], [0.58, 0.56]),
  // the speedring and the flash head with its dial
  circle(0.5, 0.56, 0.06, 18),
  circle(0.5, 0.56, 0.035, 12),
  rect(0.44, 0.58, 0.12, 0.08),
  circle(0.53, 0.62, 0.012, 8),
  line([0.46, 0.6], [0.5, 0.6]),
  line([0.46, 0.63], [0.5, 0.63]),
  // the tilt bracket and the stand: column with a lock, three legs with feet
  line([0.5, 0.66], [0.5, 0.72]),
  circle(0.5, 0.72, 0.02, 10),
  ...bar([0.5, 0.74], [0.5, 0.86], 0.02),
  rrect(0.48, 0.78, 0.04, 0.03, 0.006),
  line([0.5, 0.86], [0.3, 0.96]),
  line([0.5, 0.86], [0.7, 0.96]),
  line([0.5, 0.86], [0.53, 0.98]),
  line([0.27, 0.97], [0.33, 0.95]),
  line([0.67, 0.95], [0.73, 0.97]),
  // the power cable
  line([0.56, 0.64], [0.66, 0.7], [0.7, 0.8], [0.66, 0.9], [0.78, 0.96]),
  // light rays off the face
  line([0.1, 0.12], [0.04, 0.08]),
  line([0.1, 0.26], [0.03, 0.26]),
  line([0.1, 0.4], [0.04, 0.44]),
  line([0.9, 0.12], [0.96, 0.08]),
  line([0.9, 0.26], [0.97, 0.26]),
  line([0.9, 0.4], [0.96, 0.44]),
];
const sdCard: Strokes = [
  // the card with its notch and the write lock, the label area, the contacts
  line([0.34, 0.08], [0.66, 0.08], [0.66, 0.92], [0.34, 0.92], [0.34, 0.34], [0.38, 0.28], [0.34, 0.22], [0.34, 0.08]),
  line([0.64, 0.4], [0.68, 0.4], [0.68, 0.5], [0.64, 0.5]),
  rrect(0.38, 0.4, 0.24, 0.34, 0.015),
  line([0.41, 0.46], [0.59, 0.46]),
  line([0.41, 0.5], [0.52, 0.5]),
  line([0.41, 0.58], [0.59, 0.58]),
  line([0.41, 0.62], [0.49, 0.62]),
  line([0.41, 0.69], [0.5, 0.69]),
  rect(0.53, 0.65, 0.06, 0.06),
  // speed class marks
  circle(0.42, 0.82, 0.02, 10),
  line([0.42, 0.81], [0.42, 0.83]),
  rect(0.47, 0.8, 0.05, 0.04),
  line([0.55, 0.8], [0.6, 0.8], [0.6, 0.84], [0.55, 0.84]),
  // contact pins along the top
  ...[0.38, 0.42, 0.46, 0.5, 0.54, 0.58, 0.62].map((x): Pt[] => rect(x - 0.012, 0.1, 0.024, 0.1)),
  // a corner cut
  line([0.6, 0.08], [0.66, 0.14]),
];

// ---------------------------------------------------------------------------
// art
// ---------------------------------------------------------------------------
/** A pencil along p→q: hex barrel (three lines), a ferrule band, the sharpened tip. */
const pencil = (p: Pt, q: Pt, w: number): Pt[][] => {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy;
  const ny = ux;
  const tipLen = w * 2.2;
  const b: Pt = [q[0] - ux * tipLen, q[1] - uy * tipLen];
  const edge = (k: number): Pt[] => line([p[0] + nx * w * k, p[1] + ny * w * k], [b[0] + nx * w * k, b[1] + ny * w * k]);
  return [edge(0.5), edge(-0.5), edge(0.17), line([b[0] + nx * w * 0.5, b[1] + ny * w * 0.5], q, [b[0] - nx * w * 0.5, b[1] - ny * w * 0.5]), line([p[0] + nx * w * 0.5, p[1] + ny * w * 0.5], [p[0] - nx * w * 0.5, p[1] - ny * w * 0.5]), line([b[0] + nx * w * 0.5 - ux * w * 0.6, b[1] + ny * w * 0.5 - uy * w * 0.6], [b[0] - nx * w * 0.5 - ux * w * 0.6, b[1] - ny * w * 0.5 - uy * w * 0.6])];
};
/** A brush along p→q: handle, ferrule with two bands, the bristles tapering to a point. */
const brush = (p: Pt, q: Pt, w: number): Pt[][] => {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy;
  const ny = ux;
  const f0: Pt = [p[0] + ux * l * 0.6, p[1] + uy * l * 0.6];
  const f1: Pt = [p[0] + ux * l * 0.76, p[1] + uy * l * 0.76];
  const off = (pt: Pt, k: number): Pt => [pt[0] + nx * w * k, pt[1] + ny * w * k];
  return [
    line(off(p, 0.4), off(f0, 0.45)),
    line(off(p, -0.4), off(f0, -0.45)),
    line(off(p, 0.4), off(p, -0.4)),
    line(off(f0, 0.55), off(f1, 0.55), off(f1, -0.55), off(f0, -0.55), off(f0, 0.55)),
    line(off([f0[0] + ux * l * 0.05, f0[1] + uy * l * 0.05], 0.55), off([f0[0] + ux * l * 0.05, f0[1] + uy * l * 0.05], -0.55)),
    line(off(f1, 0.5), q, off(f1, -0.5)),
    line(off(f1, 0.2), [q[0] - ux * l * 0.06, q[1] - uy * l * 0.06]),
  ];
};
const canvasEasel: Strokes = [
  // the A-frame: two front legs, the back leg, the crossbar, the ledge with its lip
  line([0.16, 0.98], [0.253, 0.72]),
  line([0.84, 0.98], [0.747, 0.72]),
  line([0.44, 0.2], [0.5, 0.04], [0.56, 0.2]),
  line([0.5, 0.72], [0.56, 0.98]),
  rect(0.24, 0.72, 0.52, 0.035),
  line([0.24, 0.755], [0.24, 0.775], [0.76, 0.775], [0.76, 0.755]),
  line([0.3, 0.6], [0.7, 0.6]),
  circle(0.47, 0.09, 0.012, 8),
  circle(0.53, 0.09, 0.012, 8),
  // the canvas on the ledge: stretcher, the painting's border
  rect(0.14, 0.2, 0.72, 0.52),
  rect(0.17, 0.23, 0.66, 0.46),
  line([0.14, 0.2], [0.17, 0.23]),
  line([0.86, 0.2], [0.83, 0.23]),
  // the picture: hills, a lake, a sun, a tree; half the sky still hatched in
  line([0.17, 0.5], [0.26, 0.42], [0.34, 0.47], [0.46, 0.36], [0.58, 0.45], [0.7, 0.4], [0.83, 0.46]),
  line([0.17, 0.56], [0.83, 0.56]),
  line([0.2, 0.6], [0.34, 0.59], [0.5, 0.61], [0.66, 0.59], [0.8, 0.6]),
  circle(0.66, 0.31, 0.04, 14),
  ...ticks(0.66, 0.31, 0.05, 0.065, 8),
  line([0.3, 0.56], [0.3, 0.46]),
  circle(0.3, 0.42, 0.045, 14),
  circle(0.27, 0.4, 0.025, 10),
  ...[0.26, 0.3, 0.34].map((y): Pt[] => line([0.19, y], [0.42, y + 0.02])),
  line([0.19, 0.38], [0.3, 0.39]),
  // brush strokes left on the sky
  line([0.46, 0.27], [0.56, 0.26]),
  line([0.5, 0.3], [0.6, 0.29]),
  // the clip at the top holding the canvas
  rect(0.46, 0.17, 0.08, 0.04),
  line([0.5, 0.17], [0.5, 0.13]),
  // a rag over the ledge and a brush resting on it
  line([0.6, 0.755], [0.62, 0.82], [0.7, 0.84], [0.72, 0.775]),
  ...brush([0.26, 0.75], [0.5, 0.73], 0.02),
];
const palette: Strokes = [
  // the kidney shape with its thumb hole and a second edge line
  line([0.12, 0.5], [0.14, 0.38], [0.24, 0.26], [0.4, 0.2], [0.56, 0.2], [0.7, 0.26], [0.84, 0.38], [0.88, 0.52], [0.84, 0.66], [0.72, 0.76], [0.56, 0.8], [0.4, 0.78], [0.26, 0.7], [0.14, 0.6], [0.12, 0.5]),
  line([0.17, 0.5], [0.19, 0.4], [0.28, 0.3], [0.42, 0.25]),
  ellipse(0.7, 0.52, 0.055, 0.045, 16),
  ellipse(0.7, 0.52, 0.04, 0.03, 12),
  // the paint dabs, each with a highlight, and a smear between two
  ...[[0.3, 0.38], [0.42, 0.3], [0.56, 0.3], [0.66, 0.36], [0.24, 0.52], [0.34, 0.64], [0.48, 0.68], [0.6, 0.66]].flatMap(([x, y]): Pt[][] => [
    ellipse(x, y, 0.045, 0.038, 16).map(([px, py], i): Pt => [px + (i % 3 === 0 ? 0.004 : 0), py + (i % 4 === 0 ? -0.004 : 0)]),
    arc(x, y, 0.02, Math.PI * 1.1, Math.PI * 1.5, 4),
  ]),
  line([0.36, 0.44], [0.44, 0.48], [0.5, 0.46], [0.56, 0.5]),
  line([0.4, 0.5], [0.46, 0.53], [0.52, 0.52]),
  // two brushes through the thumb hole
  ...brush([0.3, 0.92], [0.86, 0.42], 0.028),
  ...brush([0.4, 0.96], [0.8, 0.5], 0.024),
];
const watercolors: Strokes = [
  // the tin: lid open with its hinge, mixing wells in the lid
  rrect(0.06, 0.06, 0.88, 0.24, 0.02),
  line([0.08, 0.3], [0.92, 0.3]),
  ellipse(0.2, 0.18, 0.085, 0.06, 18),
  ellipse(0.5, 0.18, 0.085, 0.06, 18),
  ellipse(0.8, 0.18, 0.085, 0.06, 18),
  arc(0.2, 0.18, 0.05, Math.PI * 1.1, Math.PI * 1.6, 6),
  arc(0.5, 0.18, 0.05, Math.PI * 1.1, Math.PI * 1.6, 6),
  arc(0.8, 0.18, 0.05, Math.PI * 1.1, Math.PI * 1.6, 6),
  // the base with two rows of pans, each pan with a worn dip
  rrect(0.06, 0.32, 0.88, 0.44, 0.02),
  ...[0, 1, 2, 3, 4, 5].flatMap((i): Pt[][] => [rect(0.1 + i * 0.14, 0.36, 0.1, 0.14), ellipse(0.15 + i * 0.14, 0.43, 0.03, 0.03, 10)]),
  ...[0, 1, 2, 3, 4, 5].flatMap((i): Pt[][] => [rect(0.1 + i * 0.14, 0.54, 0.1, 0.14), ellipse(0.15 + i * 0.14, 0.61, 0.03, 0.03, 10)]),
  line([0.1, 0.72], [0.9, 0.72]),
  // the lid's clasp, water drops
  rect(0.47, 0.76, 0.06, 0.03),
  line([0.3, 0.52], [0.31, 0.5], [0.32, 0.52], [0.31, 0.535], [0.3, 0.52]),
  // a brush across the front
  ...brush([0.12, 0.9], [0.9, 0.84], 0.028),
];
const brushJar: Strokes = [
  // the jar: walls, rim and base, the water line, a highlight
  line([0.28, 0.46], [0.28, 0.9], [0.32, 0.95], [0.68, 0.95], [0.72, 0.9], [0.72, 0.46]),
  ellipse(0.5, 0.46, 0.22, 0.05, 24),
  ellipse(0.5, 0.49, 0.2, 0.04, 20),
  ellipse(0.5, 0.66, 0.21, 0.035, 20),
  line([0.32, 0.56], [0.32, 0.86]),
  line([0.34, 0.86], [0.34, 0.9]),
  // four brushes: flat, round, fan, rigger — handles out of the jar, bristles down in the water
  ...brush([0.3, 0.1], [0.44, 0.84], 0.028),
  ...brush([0.46, 0.0], [0.5, 0.86], 0.024),
  ...brush([0.66, 0.08], [0.56, 0.86], 0.03),
  ...brush([0.84, 0.26], [0.62, 0.8], 0.02),
  // a palette knife leaning on the outside
  ...bar([0.86, 0.95], [0.78, 0.6], 0.016),
  line([0.78, 0.6], [0.76, 0.5], [0.72, 0.44], [0.7, 0.52], [0.78, 0.6]),
  // the ring of paint water at the rim, a drop
  line([0.4, 0.48], [0.44, 0.47], [0.48, 0.48]),
  line([0.2, 0.9], [0.21, 0.88], [0.22, 0.9], [0.21, 0.915], [0.2, 0.9]),
];
const pencilCup: Strokes = [
  // the cup: walls, rim and foot, a band pattern
  line([0.3, 0.5], [0.32, 0.92], [0.68, 0.92], [0.7, 0.5]),
  ellipse(0.5, 0.5, 0.2, 0.05, 24),
  ellipse(0.5, 0.52, 0.18, 0.04, 20),
  ellipse(0.5, 0.92, 0.18, 0.03, 20),
  line([0.31, 0.62], [0.69, 0.62]),
  line([0.31, 0.7], [0.69, 0.7]),
  ...[0.36, 0.42, 0.48, 0.54, 0.6, 0.66].map((x): Pt[] => line([x, 0.62], [x + 0.03, 0.7])),
  // five pencils fanned out, a brush and a ruler among them
  ...pencil([0.4, 0.54], [0.26, 0.08], 0.03),
  ...pencil([0.47, 0.52], [0.43, 0.04], 0.03),
  ...pencil([0.54, 0.52], [0.6, 0.06], 0.03),
  ...pencil([0.6, 0.54], [0.78, 0.14], 0.03),
  ...brush([0.34, 0.6], [0.14, 0.2], 0.026),
  ...bar([0.64, 0.56], [0.9, 0.24], 0.04),
  ...[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((t): Pt[] => line([0.64 + (0.9 - 0.64) * t + 0.016 * 0.78, 0.56 + (0.24 - 0.56) * t + 0.016 * 0.63], [0.64 + (0.9 - 0.64) * t + 0.004 * 0.78, 0.56 + (0.24 - 0.56) * t + 0.004 * 0.63])),
  // shavings at the foot
  line([0.78, 0.9], [0.8, 0.86], [0.84, 0.88], [0.82, 0.92], [0.78, 0.9]),
];
const tablet: Strokes = [
  // the tablet: body, bevel, the drawing area with a sketch and its toolbar, express keys and the dial
  rrect(0.04, 0.18, 0.92, 0.62, 0.04),
  rrect(0.06, 0.2, 0.88, 0.58, 0.035),
  rect(0.2, 0.25, 0.7, 0.48),
  line([0.2, 0.3], [0.9, 0.3]),
  ...[0.23, 0.27, 0.31, 0.35, 0.39].map((x): Pt[] => rect(x, 0.262, 0.025, 0.025)),
  // the sketch: a face in profile
  line([0.5, 0.36], [0.48, 0.42], [0.5, 0.48], [0.47, 0.52], [0.5, 0.56], [0.48, 0.6], [0.52, 0.66]),
  line([0.5, 0.36], [0.6, 0.33], [0.7, 0.38], [0.72, 0.5], [0.66, 0.64], [0.56, 0.68]),
  line([0.49, 0.5], [0.46, 0.5]),
  line([0.62, 0.44], [0.66, 0.46]),
  line([0.6, 0.36], [0.64, 0.33]),
  // layers panel on the right
  line([0.84, 0.3], [0.84, 0.73]),
  ...[0.36, 0.42, 0.48, 0.54].map((y): Pt[] => rect(0.855, y, 0.035, 0.04)),
  // express keys and the dial on the left strip
  ...[0.3, 0.38, 0.46, 0.54].map((y): Pt[] => rrect(0.09, y, 0.07, 0.055, 0.01)),
  circle(0.125, 0.67, 0.04, 14),
  circle(0.125, 0.67, 0.012, 8),
  // the stylus laid across the corner: barrel, two side buttons, the nib, the eraser end
  ...bar([0.54, 0.95], [0.94, 0.5], 0.028),
  line([0.54, 0.95], [0.5, 0.99], [0.56, 0.96]),
  line([0.94, 0.5], [0.96, 0.46], [0.955, 0.455], [0.925, 0.49]),
  line([0.74, 0.74], [0.77, 0.7]),
  line([0.78, 0.7], [0.81, 0.66]),
  // a cable off the top edge
  line([0.5, 0.18], [0.5, 0.12], [0.56, 0.08], [0.66, 0.06]),
];
const tubes: Strokes = [
  // three tubes, each: body, crimped tail, shoulder and cap with ridges, a label with a colour swatch
  ...[0.12, 0.4].flatMap((x): Pt[][] => [
    rrect(x, 0.3, 0.18, 0.5, 0.02),
    line([x, 0.8], [x + 0.03, 0.84], [x + 0.06, 0.8], [x + 0.09, 0.84], [x + 0.12, 0.8], [x + 0.15, 0.84], [x + 0.18, 0.8]),
    line([x + 0.02, 0.82], [x + 0.16, 0.82]),
    line([x + 0.02, 0.3], [x + 0.06, 0.24], [x + 0.12, 0.24], [x + 0.16, 0.3]),
    rect(x + 0.05, 0.16, 0.08, 0.08),
    line([x + 0.05, 0.19], [x + 0.13, 0.19]),
    line([x + 0.05, 0.215], [x + 0.13, 0.215]),
    rect(x + 0.03, 0.38, 0.12, 0.24),
    rect(x + 0.05, 0.4, 0.08, 0.08),
    line([x + 0.05, 0.52], [x + 0.13, 0.52]),
    line([x + 0.05, 0.56], [x + 0.11, 0.56]),
  ]),
  // the third tube lying down, squeezed, with paint coming out
  line([0.64, 0.84], [0.68, 0.5], [0.86, 0.46], [0.9, 0.8], [0.64, 0.84]),
  line([0.66, 0.76], [0.88, 0.72]),
  line([0.7, 0.5], [0.72, 0.42], [0.82, 0.4], [0.84, 0.47]),
  rect(0.73, 0.34, 0.08, 0.08),
  line([0.73, 0.37], [0.81, 0.37]),
  line([0.72, 0.56], [0.8, 0.55], [0.84, 0.64], [0.78, 0.68], [0.7, 0.66]),
  line([0.76, 0.34], [0.74, 0.28], [0.68, 0.26], [0.62, 0.3], [0.64, 0.36], [0.72, 0.36]),
  // a paint blob on the ground
  line([0.58, 0.9], [0.62, 0.86], [0.7, 0.88], [0.74, 0.94], [0.68, 0.97], [0.6, 0.95], [0.58, 0.9]),
];
const colorWheel: Strokes = [
  // outer and inner rings, twelve segments, the inner tint ring
  circle(0.5, 0.5, 0.42, 48),
  circle(0.5, 0.5, 0.32, 40),
  circle(0.5, 0.5, 0.22, 32),
  ...ticks(0.5, 0.5, 0.22, 0.42, 12),
  ...ticks(0.5, 0.5, 0.42, 0.45, 12, Math.PI / 12),
  // the primaries triangle and the secondaries triangle
  line([0.5, 0.28], [0.69, 0.61], [0.31, 0.61], [0.5, 0.28]),
  line([0.5, 0.72], [0.31, 0.39], [0.69, 0.39], [0.5, 0.72]),
  // the hue pointer and the hub
  line([0.5, 0.5], [0.72, 0.34]),
  line([0.72, 0.34], [0.69, 0.36]),
  line([0.72, 0.34], [0.71, 0.37]),
  circle(0.5, 0.5, 0.035, 12),
  circle(0.5, 0.5, 0.012, 6),
  // a shade mark in each of three segments
  arc(0.5, 0.5, 0.27, -Math.PI / 2 - 0.2, -Math.PI / 2 + 0.2, 4),
  arc(0.5, 0.5, 0.27, Math.PI / 6 - 0.2, Math.PI / 6 + 0.2, 4),
  arc(0.5, 0.5, 0.27, (5 * Math.PI) / 6 - 0.2, (5 * Math.PI) / 6 + 0.2, 4),
];

// ---------------------------------------------------------------------------
// ride
// ---------------------------------------------------------------------------
const helmet: Strokes = [
  // the shell: outer line, a second contour, the chin bar
  line([0.14, 0.56], [0.12, 0.44], [0.18, 0.3], [0.28, 0.2], [0.42, 0.13], [0.58, 0.12], [0.72, 0.17], [0.84, 0.28], [0.9, 0.42], [0.9, 0.56], [0.86, 0.68], [0.78, 0.76], [0.66, 0.8], [0.5, 0.82], [0.34, 0.84], [0.22, 0.78], [0.16, 0.68], [0.14, 0.56]),
  line([0.2, 0.3], [0.3, 0.22], [0.42, 0.17], [0.58, 0.16], [0.7, 0.2]),
  line([0.16, 0.68], [0.3, 0.7], [0.44, 0.7], [0.58, 0.7], [0.7, 0.72], [0.84, 0.68]),
  // the visor: frame, the glass with a reflection, the pivot screws
  line([0.2, 0.4], [0.3, 0.36], [0.54, 0.34], [0.7, 0.36], [0.8, 0.44], [0.8, 0.54], [0.72, 0.6], [0.5, 0.6], [0.3, 0.58], [0.2, 0.5], [0.2, 0.4]),
  line([0.24, 0.42], [0.32, 0.39], [0.54, 0.375], [0.68, 0.39], [0.76, 0.46], [0.76, 0.53], [0.7, 0.57], [0.5, 0.57], [0.32, 0.555], [0.24, 0.49], [0.24, 0.42]),
  line([0.3, 0.44], [0.4, 0.41], [0.52, 0.405]),
  line([0.34, 0.48], [0.44, 0.455]),
  circle(0.78, 0.5, 0.03, 12),
  circle(0.78, 0.5, 0.012, 6),
  circle(0.22, 0.47, 0.025, 10),
  // the top vents and the rear spoiler
  rect(0.44, 0.15, 0.12, 0.03),
  line([0.47, 0.15], [0.47, 0.18]),
  line([0.5, 0.15], [0.5, 0.18]),
  line([0.53, 0.15], [0.53, 0.18]),
  rect(0.3, 0.2, 0.06, 0.025),
  line([0.84, 0.28], [0.92, 0.26], [0.94, 0.34], [0.9, 0.4]),
  // the chin vent grille and the mouth guard lines
  ...[0.64, 0.68, 0.72, 0.76].map((y): Pt[] => line([0.26, y], [0.4, y - 0.01])),
  rect(0.46, 0.72, 0.12, 0.05),
  line([0.5, 0.72], [0.5, 0.77]),
  line([0.54, 0.72], [0.54, 0.77]),
  // the strap and its D-ring, a decal stripe
  line([0.5, 0.82], [0.5, 0.9]),
  circle(0.5, 0.93, 0.025, 10),
  line([0.46, 0.93], [0.54, 0.93]),
  line([0.6, 0.2], [0.64, 0.3], [0.66, 0.36]),
  line([0.66, 0.2], [0.7, 0.3], [0.72, 0.36]),
];
const finger = (x: number, w: number, top: number, bottom: number): Pt[] => [[x, bottom], [x, top + w / 2], ...arc(x + w / 2, top + w / 2, w / 2, Math.PI, TAU, 8), [x + w, bottom]];
const gloves: Strokes = [
  // the fingers with knuckle guards and the stitching down each
  finger(0.26, 0.1, 0.3, 0.52),
  finger(0.37, 0.1, 0.2, 0.52),
  finger(0.48, 0.1, 0.22, 0.52),
  finger(0.59, 0.1, 0.32, 0.52),
  ...[[0.31, 0.3], [0.42, 0.2], [0.53, 0.22], [0.64, 0.32]].flatMap(([x, t]): Pt[][] => [line([x, t + 0.12], [x, 0.5]), rrect(x - 0.035, t + 0.06, 0.07, 0.05, 0.01), line([x - 0.02, t + 0.2], [x + 0.02, t + 0.2]), line([x - 0.02, t + 0.26], [x + 0.02, t + 0.26])]),
  // the palm sides and the thumb with its guard
  line([0.26, 0.52], [0.26, 0.78]),
  line([0.69, 0.52], [0.69, 0.58], [0.84, 0.5], [0.88, 0.56], [0.76, 0.7], [0.69, 0.72], [0.69, 0.78]),
  line([0.72, 0.6], [0.82, 0.55], [0.84, 0.58], [0.76, 0.66]),
  // the knuckle plate across the back
  line([0.3, 0.56], [0.38, 0.52], [0.6, 0.52], [0.66, 0.56], [0.66, 0.64], [0.6, 0.68], [0.38, 0.68], [0.32, 0.64], [0.3, 0.56]),
  line([0.36, 0.57], [0.6, 0.57]),
  line([0.36, 0.63], [0.6, 0.63]),
  ...[0.4, 0.46, 0.52, 0.58].map((x): Pt[] => line([x, 0.57], [x, 0.63])),
  // the cuff with its strap, buckle and a tab
  line([0.24, 0.78], [0.72, 0.78], [0.76, 0.94], [0.2, 0.94], [0.24, 0.78]),
  rect(0.3, 0.83, 0.3, 0.05),
  rrect(0.6, 0.825, 0.08, 0.06, 0.01),
  line([0.64, 0.825], [0.64, 0.885]),
  line([0.22, 0.86], [0.74, 0.86]),
  ...[0.3, 0.38, 0.46, 0.54, 0.62].map((x): Pt[] => line([x, 0.9], [x + 0.03, 0.9])),
];
const boots: Strokes = [
  // the boot profile: shaft, ankle, the toe box and the heel
  line([0.3, 0.1], [0.62, 0.1], [0.64, 0.5], [0.7, 0.72], [0.88, 0.8], [0.9, 0.9], [0.2, 0.9], [0.2, 0.82], [0.28, 0.7], [0.3, 0.1]),
  // the sole with tread
  line([0.2, 0.84], [0.9, 0.84]),
  ...[0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82].map((x): Pt[] => line([x, 0.86], [x + 0.03, 0.9])),
  line([0.2, 0.9], [0.18, 0.94], [0.92, 0.94], [0.9, 0.9]),
  // the shin plate and the three buckles with their straps
  rrect(0.4, 0.14, 0.18, 0.5, 0.04),
  line([0.49, 0.18], [0.49, 0.6]),
  ...[0.24, 0.38, 0.52].flatMap((y): Pt[][] => [rect(0.3, y, 0.07, 0.06), line([0.33, y + 0.01], [0.33, y + 0.05]), line([0.37, y + 0.03], [0.63, y + 0.03]), line([0.37, y + 0.015], [0.63, y + 0.015])]),
  // the ankle guard disc with vents, the toe slider, the gear-shift pad
  circle(0.52, 0.72, 0.07, 18),
  circle(0.52, 0.72, 0.035, 10),
  ...ticks(0.52, 0.72, 0.04, 0.065, 8),
  rect(0.74, 0.76, 0.1, 0.05),
  line([0.76, 0.785], [0.82, 0.785]),
  line([0.64, 0.5], [0.7, 0.52], [0.72, 0.6], [0.68, 0.66]),
  // the top cuff and the pull tab
  line([0.3, 0.1], [0.3, 0.06], [0.62, 0.06], [0.62, 0.1]),
  rect(0.44, 0.02, 0.06, 0.04),
  line([0.3, 0.16], [0.62, 0.16]),
];
const road: Strokes = [
  // the horizon, the road's two edges meeting at the vanishing point, the centre dashes
  line([0.02, 0.3], [0.98, 0.3]),
  line([0.06, 0.94], [0.3, 0.66], [0.46, 0.5], [0.56, 0.38], [0.52, 0.3]),
  line([0.94, 0.94], [0.7, 0.66], [0.6, 0.5], [0.62, 0.38], [0.6, 0.3]),
  line([0.5, 0.94], [0.47, 0.82]),
  line([0.45, 0.74], [0.48, 0.65]),
  line([0.51, 0.59], [0.54, 0.52]),
  line([0.57, 0.47], [0.58, 0.42]),
  line([0.58, 0.37], [0.57, 0.33]),
  // the road's shoulder lines
  line([0.02, 0.94], [0.28, 0.68], [0.44, 0.52]),
  line([0.98, 0.94], [0.72, 0.68], [0.62, 0.52]),
  // the mountains on the horizon with snow caps
  line([0.02, 0.3], [0.12, 0.2], [0.18, 0.24], [0.26, 0.16], [0.36, 0.24], [0.42, 0.3]),
  line([0.22, 0.2], [0.26, 0.16], [0.3, 0.2]),
  line([0.6, 0.3], [0.7, 0.2], [0.78, 0.26], [0.86, 0.14], [0.98, 0.26]),
  line([0.82, 0.18], [0.86, 0.14], [0.9, 0.18]),
  // roadside posts with reflectors, a sign on the right
  line([0.2, 0.68], [0.2, 0.78]),
  circle(0.2, 0.68, 0.01, 6),
  line([0.12, 0.76], [0.12, 0.9]),
  circle(0.12, 0.76, 0.012, 6),
  line([0.8, 0.6], [0.8, 0.7]),
  circle(0.8, 0.6, 0.01, 6),
  rrect(0.84, 0.5, 0.1, 0.07, 0.01),
  line([0.89, 0.57], [0.89, 0.72]),
  line([0.86, 0.535], [0.92, 0.535]),
  // the sun low on the horizon with rays
  arc(0.5, 0.3, 0.06, Math.PI, TAU, 10),
  line([0.5, 0.2], [0.5, 0.16]),
  line([0.42, 0.24], [0.4, 0.21]),
  line([0.58, 0.24], [0.6, 0.21]),
  // a rider far ahead on the road
  line([0.54, 0.44], [0.54, 0.4]),
  circle(0.54, 0.385, 0.01, 6),
  line([0.525, 0.44], [0.555, 0.44]),
];
const mountains: Strokes = [
  // the ridge line, a second ridge behind, snow caps, the valley floor
  line([0.02, 0.8], [0.2, 0.46], [0.3, 0.58], [0.46, 0.18], [0.62, 0.5], [0.72, 0.36], [0.98, 0.8]),
  line([0.1, 0.8], [0.22, 0.64], [0.3, 0.7], [0.4, 0.56], [0.52, 0.72], [0.6, 0.62], [0.76, 0.8]),
  line([0.4, 0.32], [0.44, 0.27], [0.46, 0.3], [0.5, 0.26], [0.54, 0.3], [0.56, 0.36]),
  line([0.42, 0.34], [0.46, 0.38], [0.5, 0.34]),
  line([0.16, 0.54], [0.2, 0.5], [0.24, 0.54]),
  line([0.68, 0.44], [0.72, 0.4], [0.76, 0.44]),
  // slopes: shading lines on the shaded sides, a couloir
  line([0.46, 0.18], [0.5, 0.5]),
  line([0.3, 0.58], [0.36, 0.7]),
  ...[0.3, 0.38, 0.46].map((t): Pt[] => line([0.46 + (0.62 - 0.46) * t, 0.18 + (0.5 - 0.18) * t], [0.46 + (0.62 - 0.46) * t - 0.05, 0.18 + (0.5 - 0.18) * t + 0.1])),
  // pines along the valley floor, the road winding up
  ...[0.1, 0.17, 0.84, 0.9].flatMap((x): Pt[][] => [line([x - 0.03, 0.86], [x, 0.76], [x + 0.03, 0.86]), line([x - 0.02, 0.81], [x, 0.74], [x + 0.02, 0.81]), line([x, 0.86], [x, 0.9])]),
  line([0.3, 0.9], [0.4, 0.82], [0.56, 0.84], [0.66, 0.76], [0.6, 0.7], [0.5, 0.68]),
  line([0.02, 0.9], [0.98, 0.9]),
  // the sun and its rays, a bird
  circle(0.82, 0.26, 0.065, 18),
  ...ticks(0.82, 0.26, 0.09, 0.13, 7, -Math.PI * 0.95, Math.PI * 1.1),
  line([0.26, 0.26], [0.29, 0.23], [0.32, 0.26]),
  line([0.33, 0.3], [0.36, 0.28], [0.39, 0.3]),
];
const roadSign: Strokes = [
  // the post and its footing
  line([0.5, 0.94], [0.5, 0.58]),
  line([0.52, 0.94], [0.52, 0.6]),
  line([0.42, 0.94], [0.6, 0.94]),
  line([0.44, 0.97], [0.58, 0.97]),
  // the diamond sign with its inner border and bolts
  line([0.5, 0.58], [0.26, 0.34], [0.5, 0.1], [0.74, 0.34], [0.5, 0.58]),
  line([0.5, 0.53], [0.31, 0.34], [0.5, 0.15], [0.69, 0.34], [0.5, 0.53]),
  circle(0.5, 0.56, 0.01, 6),
  circle(0.5, 0.12, 0.01, 6),
  // the winding-road symbol with its arrowhead
  line([0.44, 0.48], [0.46, 0.42], [0.54, 0.4], [0.56, 0.34], [0.5, 0.28], [0.5, 0.22]),
  line([0.47, 0.25], [0.5, 0.22], [0.53, 0.25]),
  line([0.42, 0.48], [0.46, 0.48]),
  // a smaller plate below with a distance and a chevron
  rrect(0.4, 0.6, 0.2, 0.08, 0.01),
  line([0.44, 0.64], [0.52, 0.64]),
  line([0.54, 0.62], [0.57, 0.64], [0.54, 0.66]),
  // the sign's shadow on the ground
  line([0.54, 0.97], [0.76, 0.97]),
];
const jerryCan: Strokes = [
  // the body with its bevelled top, the X pressing, the welded seam
  rrect(0.2, 0.26, 0.6, 0.66, 0.04),
  rrect(0.22, 0.28, 0.56, 0.62, 0.035),
  rect(0.3, 0.4, 0.4, 0.42),
  line([0.3, 0.4], [0.7, 0.82]),
  line([0.7, 0.4], [0.3, 0.82]),
  circle(0.5, 0.61, 0.07, 18),
  // the three handles on top
  line([0.3, 0.26], [0.3, 0.16], [0.7, 0.16], [0.7, 0.26]),
  line([0.3, 0.2], [0.7, 0.2]),
  line([0.43, 0.26], [0.43, 0.16]),
  line([0.57, 0.26], [0.57, 0.16]),
  // the spout with its cap and the retaining chain
  rect(0.72, 0.12, 0.1, 0.14),
  rect(0.7, 0.08, 0.14, 0.04),
  line([0.74, 0.1], [0.8, 0.1]),
  line([0.84, 0.1], [0.88, 0.14], [0.86, 0.2], [0.84, 0.26]),
  // the label plate and the fuel-level marks down the side
  rect(0.36, 0.3, 0.28, 0.07),
  line([0.4, 0.335], [0.6, 0.335]),
  ...[0.5, 0.6, 0.7, 0.8].map((y): Pt[] => line([0.24, y], [0.27, y])),
  // the base rim
  line([0.22, 0.86], [0.78, 0.86]),
];

// ---------------------------------------------------------------------------
// play
// ---------------------------------------------------------------------------
const gameMonitor: Strokes = [
  // a curved ultrawide: outer shell, the bezel, the panel
  line([0.04, 0.2], [0.26, 0.165], [0.5, 0.155], [0.74, 0.165], [0.96, 0.2], [0.96, 0.68], [0.74, 0.715], [0.5, 0.725], [0.26, 0.715], [0.04, 0.68], [0.04, 0.2]),
  line([0.07, 0.225], [0.26, 0.195], [0.5, 0.185], [0.74, 0.195], [0.93, 0.225], [0.93, 0.655], [0.74, 0.685], [0.5, 0.695], [0.26, 0.685], [0.07, 0.655], [0.07, 0.225]),
  // on screen: a first-person view — the crosshair, a horizon with a ridge, a corridor's vanishing lines, the HUD
  circle(0.5, 0.44, 0.045, 16),
  line([0.5, 0.36], [0.5, 0.41]),
  line([0.5, 0.47], [0.5, 0.52]),
  line([0.42, 0.44], [0.47, 0.44]),
  line([0.53, 0.44], [0.58, 0.44]),
  circle(0.5, 0.44, 0.006, 4),
  line([0.1, 0.5], [0.26, 0.48], [0.38, 0.5], [0.5, 0.46], [0.62, 0.5], [0.74, 0.48], [0.9, 0.5]),
  line([0.1, 0.62], [0.36, 0.5]),
  line([0.9, 0.62], [0.64, 0.5]),
  line([0.12, 0.26], [0.36, 0.4]),
  line([0.88, 0.26], [0.64, 0.4]),
  // the health and ammo HUD, the minimap, a kill feed
  rrect(0.1, 0.6, 0.18, 0.03, 0.005),
  ...[0.13, 0.16, 0.19, 0.22].map((x): Pt[] => line([x, 0.6], [x, 0.63])),
  line([0.1, 0.56], [0.2, 0.56]),
  rrect(0.74, 0.58, 0.16, 0.05, 0.005),
  line([0.76, 0.605], [0.8, 0.605]),
  line([0.84, 0.595], [0.88, 0.595]),
  line([0.84, 0.615], [0.88, 0.615]),
  rrect(0.1, 0.24, 0.12, 0.1, 0.005),
  circle(0.16, 0.29, 0.01, 6),
  line([0.12, 0.26], [0.2, 0.32]),
  line([0.2, 0.26], [0.12, 0.32]),
  line([0.76, 0.25], [0.9, 0.25]),
  line([0.78, 0.28], [0.9, 0.28]),
  line([0.8, 0.31], [0.9, 0.31]),
  // the stand: neck, the V base, RGB strip on the back
  line([0.46, 0.725], [0.46, 0.82]),
  line([0.54, 0.725], [0.54, 0.82]),
  line([0.5, 0.82], [0.26, 0.9]),
  line([0.5, 0.82], [0.74, 0.9]),
  line([0.22, 0.9], [0.3, 0.9]),
  line([0.7, 0.9], [0.78, 0.9]),
  line([0.4, 0.82], [0.6, 0.82]),
  // a power LED and the OSD buttons under the bezel
  circle(0.9, 0.7, 0.006, 6),
  ...[0.8, 0.83, 0.86].map((x): Pt[] => line([x, 0.7], [x + 0.015, 0.7])),
];
const gameMouse: Strokes = [
  // the shell, the split between the buttons, the scroll wheel with its ridges
  line([0.5, 0.08], [0.34, 0.12], [0.26, 0.28], [0.24, 0.5], [0.28, 0.74], [0.4, 0.9], [0.6, 0.9], [0.72, 0.74], [0.76, 0.5], [0.74, 0.28], [0.66, 0.12], [0.5, 0.08]),
  line([0.5, 0.08], [0.5, 0.42]),
  line([0.265, 0.4], [0.38, 0.44], [0.5, 0.45], [0.62, 0.44], [0.735, 0.4]),
  rrect(0.47, 0.18, 0.06, 0.14, 0.03),
  ...[0.21, 0.24, 0.27, 0.3].map((y): Pt[] => line([0.47, y], [0.53, y])),
  // the DPI button, the side buttons, the thumb rest texture
  rrect(0.48, 0.5, 0.04, 0.03, 0.006),
  rrect(0.245, 0.46, 0.03, 0.08, 0.006),
  rrect(0.245, 0.56, 0.03, 0.08, 0.006),
  ...[0.66, 0.7, 0.74, 0.78].map((y): Pt[] => line([0.28, y], [0.33, y + 0.01])),
  // the logo and RGB ring, the palm's reflection line
  circle(0.5, 0.7, 0.055, 16),
  circle(0.5, 0.7, 0.035, 12),
  line([0.5, 0.675], [0.5, 0.725]),
  line([0.475, 0.7], [0.525, 0.7]),
  line([0.62, 0.3], [0.66, 0.5], [0.64, 0.7]),
  // the braided cable with its strain relief
  rrect(0.47, 0.03, 0.06, 0.05, 0.01),
  line([0.5, 0.03], [0.5, 0.0]),
  line([0.5, 0.0], [0.56, -0.02]),
  line([0.46, 0.055], [0.54, 0.055]),
];
const gameHeadset: Strokes = [
  // the headband: outer and inner arcs, the padding segments, the adjustable sliders
  arc(0.5, 0.5, 0.36, Math.PI, TAU, 24),
  arc(0.5, 0.5, 0.3, Math.PI, TAU, 22),
  ...[0.3, 0.4, 0.5, 0.6, 0.7].map((t): Pt[] => {
    const a = Math.PI + Math.PI * t;
    return line([0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3], [0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.36]);
  }),
  line([0.14, 0.5], [0.14, 0.62]),
  line([0.2, 0.5], [0.2, 0.62]),
  line([0.8, 0.5], [0.8, 0.62]),
  line([0.86, 0.5], [0.86, 0.62]),
  ...[0.53, 0.56, 0.59].flatMap((y): Pt[][] => [line([0.15, y], [0.19, y]), line([0.81, y], [0.85, y])]),
  // the ear cups: shells, the yokes, the cushions, the driver grille hint
  rrect(0.08, 0.58, 0.18, 0.3, 0.07),
  rrect(0.74, 0.58, 0.18, 0.3, 0.07),
  ellipse(0.17, 0.73, 0.05, 0.11, 18),
  ellipse(0.83, 0.73, 0.05, 0.11, 18),
  circle(0.17, 0.73, 0.03, 10),
  circle(0.83, 0.73, 0.03, 10),
  line([0.1, 0.62], [0.1, 0.84]),
  line([0.9, 0.62], [0.9, 0.84]),
  // the volume wheel and mute button on the left cup, the LED
  rrect(0.07, 0.68, 0.015, 0.06, 0.005),
  circle(0.075, 0.78, 0.008, 6),
  circle(0.85, 0.86, 0.006, 6),
  // the boom mic: arm, the hinge, the windscreen
  circle(0.21, 0.82, 0.016, 8),
  line([0.22, 0.83], [0.26, 0.88], [0.34, 0.93], [0.44, 0.94]),
  ellipse(0.48, 0.94, 0.04, 0.03, 12),
  line([0.46, 0.925], [0.5, 0.925]),
  line([0.46, 0.955], [0.5, 0.955]),
  // the cable
  line([0.17, 0.88], [0.17, 0.95], [0.22, 0.99]),
];
const gamepad: Strokes = [
  // the body with grips, the second contour on the grips
  line([0.14, 0.34], [0.3, 0.28], [0.7, 0.28], [0.86, 0.34], [0.94, 0.56], [0.9, 0.76], [0.82, 0.8], [0.72, 0.72], [0.64, 0.64], [0.36, 0.64], [0.28, 0.72], [0.18, 0.8], [0.1, 0.76], [0.06, 0.56], [0.14, 0.34]),
  line([0.12, 0.58], [0.16, 0.74]),
  line([0.88, 0.58], [0.84, 0.74]),
  // the left stick with its gate ring and textured cap, the right stick
  circle(0.28, 0.44, 0.07, 20),
  circle(0.28, 0.44, 0.05, 16),
  circle(0.28, 0.44, 0.03, 12),
  ...ticks(0.28, 0.44, 0.03, 0.045, 8),
  circle(0.62, 0.56, 0.06, 18),
  circle(0.62, 0.56, 0.042, 14),
  circle(0.62, 0.56, 0.025, 10),
  ...ticks(0.62, 0.56, 0.025, 0.038, 8),
  // the D-pad with arrow marks
  line([0.36, 0.52], [0.4, 0.52], [0.4, 0.48], [0.44, 0.48], [0.44, 0.52], [0.48, 0.52], [0.48, 0.56], [0.44, 0.56], [0.44, 0.6], [0.4, 0.6], [0.4, 0.56], [0.36, 0.56], [0.36, 0.52]),
  line([0.41, 0.5], [0.42, 0.49], [0.43, 0.5]),
  line([0.41, 0.58], [0.42, 0.59], [0.43, 0.58]),
  line([0.38, 0.53], [0.37, 0.54], [0.38, 0.55]),
  line([0.46, 0.53], [0.47, 0.54], [0.46, 0.55]),
  // the four face buttons with their glyphs
  circle(0.72, 0.36, 0.025, 10),
  circle(0.72, 0.48, 0.025, 10),
  circle(0.66, 0.42, 0.025, 10),
  circle(0.78, 0.42, 0.025, 10),
  line([0.72, 0.35], [0.712, 0.372], [0.728, 0.372], [0.72, 0.35]),
  line([0.712, 0.472], [0.728, 0.488]),
  line([0.728, 0.472], [0.712, 0.488]),
  rect(0.652, 0.412, 0.016, 0.016),
  circle(0.78, 0.42, 0.01, 6),
  // the centre: home button, the touchpad, start/select
  circle(0.5, 0.36, 0.028, 12),
  circle(0.5, 0.36, 0.012, 6),
  rrect(0.44, 0.44, 0.12, 0.08, 0.015),
  line([0.5, 0.44], [0.5, 0.52]),
  circle(0.42, 0.37, 0.012, 8),
  circle(0.58, 0.37, 0.012, 8),
  // the bumpers and the triggers above
  line([0.26, 0.28], [0.27, 0.23], [0.4, 0.22]),
  line([0.74, 0.28], [0.73, 0.23], [0.6, 0.22]),
  line([0.28, 0.23], [0.3, 0.17], [0.38, 0.16]),
  line([0.72, 0.23], [0.7, 0.17], [0.62, 0.16]),
  // the light bar
  line([0.44, 0.3], [0.56, 0.3]),
];
const gameKeyboard: Strokes = [
  // the deck with a slight bevel and the braided cable
  rrect(0.03, 0.28, 0.94, 0.46, 0.03),
  rrect(0.05, 0.3, 0.9, 0.42, 0.02),
  line([0.5, 0.28], [0.5, 0.2], [0.58, 0.14], [0.7, 0.12], [0.78, 0.14]),
  // the function row, four rows, then the bottom row
  ...Array.from({ length: 15 }, (_, i): Pt[] => rect(0.07 + i * 0.058, 0.325, 0.046, 0.03)),
  ...keys(0.07, 0.37, 14, 0.05, 0.012),
  ...keys(0.07, 0.432, 13, 0.05, 0.012),
  ...keys(0.085, 0.494, 12, 0.05, 0.012),
  ...keys(0.1, 0.556, 11, 0.05, 0.012),
  rect(0.07, 0.618, 0.1, 0.05),
  rect(0.18, 0.618, 0.06, 0.05),
  rect(0.25, 0.618, 0.06, 0.05),
  rect(0.32, 0.618, 0.33, 0.05),
  rect(0.66, 0.618, 0.06, 0.05),
  rect(0.73, 0.618, 0.06, 0.05),
  rect(0.85, 0.37, 0.09, 0.05),
  rect(0.07, 0.432, 0.06, 0.05),
  rect(0.07, 0.494, 0.078, 0.05),
  rect(0.07, 0.556, 0.094, 0.05),
  rect(0.83, 0.432, 0.12, 0.112),
  rect(0.782, 0.556, 0.168, 0.05),
  rect(0.806, 0.618, 0.044, 0.05),
  rect(0.856, 0.618, 0.044, 0.05),
  rect(0.906, 0.618, 0.044, 0.05),
  // W A S D lit: a second inner square and a glow tick under each
  rect(0.07 + 2 * 0.062 + 0.008, 0.44, 0.034, 0.034),
  rect(0.085 + 1 * 0.062 + 0.008, 0.502, 0.034, 0.034),
  rect(0.085 + 2 * 0.062 + 0.008, 0.502, 0.034, 0.034),
  rect(0.085 + 3 * 0.062 + 0.008, 0.502, 0.034, 0.034),
  line([0.202, 0.448], [0.209, 0.468], [0.216, 0.452], [0.223, 0.468], [0.23, 0.448]),
  line([0.157, 0.53], [0.167, 0.506], [0.177, 0.53]),
  line([0.236, 0.508], [0.218, 0.508], [0.218, 0.518], [0.236, 0.518], [0.236, 0.528], [0.218, 0.528]),
  line([0.28, 0.506], [0.28, 0.53], [0.292, 0.526], [0.296, 0.518], [0.292, 0.51], [0.28, 0.506]),
  // the RGB underglow strip along the front edge, the indicator LEDs
  line([0.08, 0.76], [0.92, 0.76]),
  ...[0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.84].map((x): Pt[] => line([x, 0.76], [x, 0.785])),
  circle(0.87, 0.34, 0.006, 6),
  circle(0.895, 0.34, 0.006, 6),
  circle(0.92, 0.34, 0.006, 6),
  // a volume knob on the top right
  circle(0.93, 0.26, 0.022, 12),
  line([0.93, 0.26], [0.945, 0.247]),
  // the wrist rest
  rrect(0.1, 0.8, 0.8, 0.1, 0.02),
  line([0.14, 0.85], [0.86, 0.85]),
];
const trophy: Strokes = [
  // the cup: bowl with a lip and bands, the handles, the stem and the plinth with its plaque
  line([0.26, 0.14], [0.74, 0.14], [0.72, 0.3], [0.66, 0.46], [0.56, 0.56], [0.44, 0.56], [0.34, 0.46], [0.28, 0.3], [0.26, 0.14]),
  ellipse(0.5, 0.14, 0.24, 0.045, 24),
  ellipse(0.5, 0.15, 0.2, 0.03, 20),
  line([0.275, 0.24], [0.725, 0.24]),
  line([0.3, 0.38], [0.7, 0.38]),
  line([0.26, 0.2], [0.14, 0.22], [0.1, 0.34], [0.18, 0.44], [0.3, 0.44]),
  line([0.27, 0.25], [0.18, 0.26], [0.15, 0.34], [0.2, 0.4], [0.3, 0.4]),
  line([0.74, 0.2], [0.86, 0.22], [0.9, 0.34], [0.82, 0.44], [0.7, 0.44]),
  line([0.73, 0.25], [0.82, 0.26], [0.85, 0.34], [0.8, 0.4], [0.7, 0.4]),
  line([0.46, 0.56], [0.44, 0.66], [0.4, 0.7]),
  line([0.54, 0.56], [0.56, 0.66], [0.6, 0.7]),
  ellipse(0.5, 0.62, 0.05, 0.015, 12),
  rrect(0.3, 0.7, 0.4, 0.08, 0.015),
  rrect(0.24, 0.78, 0.52, 0.12, 0.015),
  rect(0.38, 0.81, 0.24, 0.06),
  line([0.41, 0.83], [0.59, 0.83]),
  line([0.41, 0.85], [0.53, 0.85]),
  // the star, a "1" and a laurel sprig each side of the bowl
  line([0.5, 0.26], [0.53, 0.32], [0.6, 0.33], [0.55, 0.37], [0.56, 0.44], [0.5, 0.4], [0.44, 0.44], [0.45, 0.37], [0.4, 0.33], [0.47, 0.32], [0.5, 0.26]),
  line([0.36, 0.3], [0.34, 0.34], [0.36, 0.38]),
  line([0.345, 0.34], [0.32, 0.33]),
  line([0.345, 0.34], [0.32, 0.36]),
  line([0.64, 0.3], [0.66, 0.34], [0.64, 0.38]),
  line([0.655, 0.34], [0.68, 0.33]),
  line([0.655, 0.34], [0.68, 0.36]),
  // sparkles
  line([0.2, 0.1], [0.2, 0.04]),
  line([0.17, 0.07], [0.23, 0.07]),
  line([0.82, 0.08], [0.82, 0.02]),
  line([0.79, 0.05], [0.85, 0.05]),
];
const pcTower: Strokes = [
  // the case with a tempered-glass side showing the build
  rrect(0.24, 0.05, 0.52, 0.9, 0.03),
  rect(0.28, 0.14, 0.44, 0.76),
  line([0.28, 0.1], [0.72, 0.1]),
  circle(0.5, 0.075, 0.012, 8),
  line([0.56, 0.075], [0.64, 0.075]),
  circle(0.36, 0.075, 0.006, 6),
  // three front fans
  ...[0.26, 0.47, 0.68].flatMap((y): Pt[][] => [circle(0.37, y, 0.07, 20), circle(0.37, y, 0.02, 8), ...Array.from({ length: 7 }, (_, i): Pt[] => arc(0.37, y, 0.05, (i / 7) * TAU, (i / 7) * TAU + 0.6, 4)), rect(0.3, y - 0.075, 0.14, 0.15)]),
  // the motherboard: CPU cooler block, RAM sticks, the GPU with its fans, the PSU shroud, cables
  rect(0.48, 0.2, 0.22, 0.62),
  rrect(0.52, 0.24, 0.12, 0.12, 0.01),
  ...grid(0.52, 0.24, 0.12, 0.12, 4, 4),
  rect(0.66, 0.22, 0.015, 0.14),
  rect(0.68, 0.22, 0.015, 0.14),
  rrect(0.48, 0.5, 0.22, 0.1, 0.01),
  circle(0.53, 0.55, 0.035, 12),
  circle(0.64, 0.55, 0.035, 12),
  line([0.5, 0.6], [0.5, 0.64]),
  line([0.68, 0.6], [0.68, 0.64]),
  rect(0.3, 0.78, 0.4, 0.1),
  ...[0.34, 0.4, 0.46, 0.52, 0.58, 0.64].map((x): Pt[] => line([x, 0.8], [x + 0.03, 0.86])),
  line([0.6, 0.36], [0.6, 0.44], [0.56, 0.5]),
  line([0.66, 0.36], [0.66, 0.5]),
  // the RGB strip along the top and the feet
  line([0.3, 0.17], [0.7, 0.17]),
  line([0.3, 0.9], [0.3, 0.95]),
  line([0.7, 0.9], [0.7, 0.95]),
  rect(0.26, 0.95, 0.08, 0.03),
  rect(0.66, 0.95, 0.08, 0.03),
];
const energyCan: Strokes = [
  // the can: body with its neck and rim, the pull tab, a second contour for the highlight
  rrect(0.34, 0.18, 0.32, 0.72, 0.04),
  ellipse(0.5, 0.18, 0.16, 0.045, 24),
  ellipse(0.5, 0.19, 0.11, 0.03, 16),
  line([0.47, 0.17], [0.5, 0.12], [0.55, 0.14], [0.53, 0.19]),
  circle(0.5, 0.185, 0.012, 6),
  line([0.38, 0.3], [0.38, 0.78]),
  // the bands and the label with a lightning bolt and lettering lines
  line([0.34, 0.3], [0.66, 0.3]),
  line([0.34, 0.33], [0.66, 0.33]),
  line([0.34, 0.76], [0.66, 0.76]),
  line([0.34, 0.79], [0.66, 0.79]),
  line([0.56, 0.38], [0.45, 0.56], [0.53, 0.56], [0.47, 0.72], [0.6, 0.5], [0.52, 0.5], [0.56, 0.38]),
  line([0.4, 0.42], [0.44, 0.42]),
  line([0.4, 0.46], [0.43, 0.46]),
  line([0.6, 0.62], [0.64, 0.62]),
  line([0.6, 0.66], [0.63, 0.66]),
  // the base rim and condensation drops
  ellipse(0.5, 0.9, 0.14, 0.03, 16),
  circle(0.42, 0.5, 0.006, 4),
  circle(0.62, 0.42, 0.006, 4),
  circle(0.6, 0.7, 0.005, 4),
  // a straw
  line([0.56, 0.17], [0.68, 0.0]),
  line([0.58, 0.18], [0.7, 0.02]),
];

// ---------------------------------------------------------------------------
// Per world: the ring around the display. x, y in display-widths from the display's centre.
// Eight stations, the same for every world so the eye learns them: a hero at top-left, a second
// large object bottom-right, the rest around.
// ---------------------------------------------------------------------------
const P = {
  hero: { x: -0.66, y: -0.3, size: 0.34, depth: 1 },
  topL: { x: -0.24, y: -0.47, size: 0.18, depth: 0.5 },
  topR: { x: 0.2, y: -0.47, size: 0.18, depth: 0.7 },
  right: { x: 0.6, y: -0.2, size: 0.16, depth: 0.6 },
  rightLo: { x: 0.6, y: 0.22, size: 0.16, depth: 0.4 },
  left: { x: -0.7, y: 0.14, size: 0.22, depth: 0.7 },
  botL: { x: -0.4, y: 0.48, size: 0.24, depth: 0.9 },
  botR: { x: 0.18, y: 0.5, size: 0.24, depth: 0.8 },
};
export const CONSTELLATIONS: Record<string, Placed[]> = {
  engineer: [
    { name: "laptop", strokes: laptop, place: P.hero },
    { name: "terminal", strokes: terminal, place: P.topL },
    { name: "monitors", strokes: monitors, place: { ...P.topR, size: 0.24 } },
    { name: "earbuds", strokes: earbuds, place: P.right },
    { name: "server", strokes: server, place: P.rightLo },
    { name: "coffee", strokes: coffee, place: P.left },
    { name: "gitBranch", strokes: gitBranch, place: P.botL },
    { name: "keyboard", strokes: keyboard, place: { ...P.botR, size: 0.28 } },
  ],
  trader: [
    { name: "candles", strokes: candles, place: P.hero },
    { name: "hourglass", strokes: hourglass, place: P.topL },
    { name: "clock", strokes: clock, place: P.topR },
    { name: "bitcoin", strokes: bitcoin, place: P.right },
    { name: "calculator", strokes: calculator, place: P.rightLo },
    { name: "brain", strokes: brain, place: P.left },
    { name: "dollars", strokes: dollars, place: P.botL },
    { name: "journal", strokes: journal, place: { ...P.botR, size: 0.22 } },
  ],
  photographer: [
    { name: "camera", strokes: camera, place: P.hero },
    { name: "thirds", strokes: thirds, place: { ...P.topL, size: 0.24 } },
    { name: "goldenRatio", strokes: goldenRatio, place: { ...P.topR, size: 0.26 } },
    { name: "lens", strokes: lens, place: P.right },
    { name: "sdCard", strokes: sdCard, place: { ...P.rightLo, size: 0.14 } },
    { name: "phoneBack", strokes: phoneBack, place: P.left },
    { name: "softbox", strokes: softbox, place: P.botL },
    { name: "tripod", strokes: tripod, place: P.botR },
  ],
  artist: [
    { name: "canvasEasel", strokes: canvasEasel, place: P.hero },
    { name: "colorWheel", strokes: colorWheel, place: { ...P.topL, size: 0.18 } },
    { name: "watercolors", strokes: watercolors, place: { ...P.topR, size: 0.24 } },
    { name: "tubes", strokes: tubes, place: P.right },
    { name: "pencilCup", strokes: pencilCup, place: P.rightLo },
    { name: "palette", strokes: palette, place: P.left },
    { name: "brushJar", strokes: brushJar, place: P.botL },
    { name: "tablet", strokes: tablet, place: P.botR },
  ],
  ride: [
    { name: "bike", strokes: BIKE_LINES, place: { ...P.hero, size: 0.46 } },
    { name: "roadSign", strokes: roadSign, place: { ...P.topL, size: 0.18 } },
    { name: "mountains", strokes: mountains, place: { ...P.topR, size: 0.24 } },
    { name: "helmet", strokes: helmet, place: P.right },
    { name: "jerryCan", strokes: jerryCan, place: { ...P.rightLo, size: 0.16 } },
    { name: "gloves", strokes: gloves, place: P.left },
    { name: "boots", strokes: boots, place: P.botL },
    { name: "road", strokes: road, place: { ...P.botR, size: 0.28 } },
  ],
  gamer: [
    { name: "gameMonitor", strokes: gameMonitor, place: P.hero },
    { name: "trophy", strokes: trophy, place: P.topL },
    { name: "pcTower", strokes: pcTower, place: { ...P.topR, size: 0.22 } },
    { name: "gameHeadset", strokes: gameHeadset, place: P.right },
    { name: "gameMouse", strokes: gameMouse, place: { ...P.rightLo, size: 0.15 } },
    { name: "gamepad", strokes: gamepad, place: P.left },
    { name: "gameKeyboard", strokes: gameKeyboard, place: { ...P.botL, size: 0.3 } },
    { name: "energyCan", strokes: energyCan, place: { ...P.botR, size: 0.18 } },
  ],
};

/**
 * Strokes an object up to `progress` (0…1) of its total length, in whatever transform the context
 * is in; returns where the pen is (null when finished).
 */
export function strokeObject(ctx: CanvasRenderingContext2D, strokes: Strokes, total: number, progress: number): Pt | null {
  let budget = total * progress;
  let pen: Pt | null = null;
  // One path, one stroke: with the detailed drawings (Round H) an object is a hundred polylines,
  // and a stroke per polyline under a shadow blur was the frame budget on phones.
  ctx.beginPath();
  for (const poly of strokes) {
    if (budget <= 0) break;
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1];
      const [bx, by] = poly[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (budget >= len) {
        ctx.lineTo(bx, by);
        budget -= len;
        pen = [bx, by];
      } else {
        const u = budget / len;
        pen = [ax + (bx - ax) * u, ay + (by - ay) * u];
        ctx.lineTo(pen[0], pen[1]);
        budget = 0;
        break;
      }
    }
  }
  ctx.stroke();
  return progress < 0.999 ? pen : null;
}

export const strokesLength = (s: Strokes) => s.reduce((n, poly) => n + poly.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - poly[i][0], p[1] - poly[i][1]), 0), 0);

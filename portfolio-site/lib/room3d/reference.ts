/**
 * Pure rules for the reference room's pieces (round 37e): how a bi-fold door stands at a given openness, the cells of a triangle
 * light-panel layout, the grid of keyboards on a pegboard. No three.js, no React: the kit and `scripts/room3d-check.mjs` share them.
 */

/** The most a bi-fold door's outer leaf swings from the closet's front (radians) when `open` is 1. */
export const FOLD_MAX = 1.3;

/**
 * One folding pair of leaves, each `a` wide, hinged at a jamb. The outer leaf turns by `outer` about the jamb; the inner leaf, hinged
 * to the outer one, turns back by twice that, so its free end stays on the track. `reach` is how far the pair's free end has slid
 * toward the jamb (the opening it uncovers is `2a - reach`), `out` how far the fold sticks out into the room.
 */
export function foldPose(open: number, a: number): { outer: number; inner: number; reach: number; out: number } {
  const o = Math.max(0, Math.min(1, open)) * FOLD_MAX;
  return { outer: o, inner: -2 * o, reach: 2 * a * Math.cos(o), out: a * Math.sin(o) };
}

/** The leaves of a closet: `doors` leaves in folding pairs; pair 0 is hinged at the left jamb, pair 1 (4 doors) at the right. */
export function closetPairs(doors: 2 | 4, w: number): Array<{ side: 1 | -1; a: number }> {
  const pairs = doors / 2;
  const a = w / pairs / 2;
  return Array.from({ length: pairs }, (_, i) => ({ side: (i === 0 ? 1 : -1) as 1 | -1, a }));
}

/** Where the doors stand: a click flips the data's openness (open stays open until clicked closed, closed opens fully). */
export const closetOpenness = (open: number, toggled: boolean): number => (toggled ? (open > 0.05 ? 0 : 1) : open);

export type PanelCell = { col: number; row: number };

/**
 * The cells of `count` triangles on a triangle grid (triangle `(col, row)` is point-up when `col + row` is even; its box starts at
 * `col * s / 2`, `row * h`). A `column` is a strip of triangles side by side (stood on end by the kit); a `cluster` grows from the
 * middle cell across shared edges (breadth first, in a fixed order), so it stays compact.
 */
export function panelCells(count: number, layout: "column" | "cluster"): PanelCell[] {
  if (layout === "column") return Array.from({ length: count }, (_, i) => ({ col: i, row: 0 }));
  const out: PanelCell[] = [];
  const seen = new Set<string>(["0,0"]);
  const queue: PanelCell[] = [{ col: 0, row: 0 }];
  while (queue.length && out.length < count) {
    const c = queue.shift()!;
    out.push(c);
    const up = (c.col + c.row) % 2 === 0;
    for (const n of [{ col: c.col + 1, row: c.row }, { col: c.col - 1, row: c.row }, { col: c.col, row: c.row + (up ? -1 : 1) }]) {
      const k = `${n.col},${n.row}`;
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return out;
}

/** The three corners of a cell for a triangle of side `s` (a height of `s * sqrt(3) / 2`). */
export function panelCorners(c: PanelCell, s: number): Array<[number, number]> {
  const h = (s * Math.sqrt(3)) / 2;
  const x0 = (c.col * s) / 2;
  const y0 = c.row * h;
  return (c.col + c.row) % 2 === 0
    ? [[x0, y0], [x0 + s, y0], [x0 + s / 2, y0 + h]]
    : [[x0, y0 + h], [x0 + s, y0 + h], [x0 + s / 2, y0]];
}

/** Rows and columns of a pegboard that hangs `items` keyboards (as square a grid as the board's shape allows, at most 4 across). */
export function pegGrid(items: number, w: number, h: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.min(4, items, Math.round(Math.sqrt((items * w) / Math.max(0.1, h)))));
  return { cols, rows: Math.ceil(items / cols) };
}

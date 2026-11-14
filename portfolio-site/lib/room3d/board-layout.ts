/**
 * Where each item sits on a content board (round 36). The board's canvas is drawn from these rectangles and a
 * click's texture coordinate is turned back into an item with the same ones, so a drawn tile and its hit area can
 * never drift apart. Rectangles are fractions of the board, origin top left. Pure.
 */
export type BoardStyle = "spines" | "frames" | "cards" | "rows";
export type Rect = { x: number; y: number; w: number; h: number };

/** The most items each style draws (more would be too small to read on a phone). */
export const BOARD_MAX: Record<BoardStyle, number> = { spines: 8, frames: 6, cards: 6, rows: 4 };

const pad = 0.035;

/** The tiles for `count` items on a board of the given width / height ratio. Never more than `BOARD_MAX[style]`. */
export function layoutBoard(style: BoardStyle, count: number, aspect: number): Rect[] {
  const n = Math.max(0, Math.min(count, BOARD_MAX[style]));
  if (n === 0) return [];
  if (style === "rows") {
    const gap = 0.025;
    // A short list keeps row-sized rows (one project is not one giant tile).
    const h = Math.min(0.3, (1 - pad * 2 - gap * (n - 1)) / n);
    return Array.from({ length: n }, (_, i) => ({ x: pad, y: pad + i * (h + gap), w: 1 - pad * 2, h }));
  }
  if (style === "spines") {
    const gap = 0.012;
    const w = (1 - pad * 1.2 - gap * (n - 1)) / n;
    // Deterministic heights (a shelf of different books), the tallest at 90% of the board.
    return Array.from({ length: n }, (_, i) => {
      const h = 0.9 - ((i * 37) % 5) * 0.045;
      return { x: pad * 0.6 + i * (w + gap), y: 1 - 0.05 - h, w, h };
    });
  }
  // frames and cards: a grid whose cells come closest to the style's own shape.
  const want = style === "frames" ? 1.25 : 0.95;
  let best = { cols: 1, err: Infinity };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cell = (aspect * rows) / cols;
    const err = Math.abs(Math.log(cell / want)) + (rows * cols - n) * 0.08;
    if (err < best.err) best = { cols, err };
  }
  const cols = best.cols;
  const rows = Math.ceil(n / cols);
  const gx = 0.03;
  const gy = 0.045;
  const w = (1 - pad * 2 - gx * (cols - 1)) / cols;
  const h = (1 - pad * 2 - gy * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    // A short last row is centred.
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const off = ((cols - inRow) * (w + gx)) / 2;
    return { x: pad + off + c * (w + gx), y: pad + r * (h + gy), w, h };
  });
}

/** The index of the tile at (u, v), u from the left and v from the top (a three.js uv has v from the bottom: pass `1 - uv.y`), or -1 between tiles. */
export function pickItem(rects: readonly Rect[], u: number, v: number): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (u >= r.x && u <= r.x + r.w && v >= r.y && v <= r.y + r.h) return i;
  }
  return -1;
}

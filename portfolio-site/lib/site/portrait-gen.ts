/**
 * The terminal's portrait, generated from the photo (17-persona-views.md §6.12). Change the image (or its crop)
 * in `TerminalData.portrait` and every mode changes with it. Client-only: the image is drawn to an offscreen
 * canvas and each mode turns the sampled pixels into rows of styled runs. Pure functions over `ImageData`,
 * plus a loader and a per-(source, mode, cols) cache.
 */

export const PORTRAIT_MODES = ["pixels", "braille", "ascii", "blocks", "matrix"] as const;
export type PortraitMode = (typeof PORTRAIT_MODES)[number];
export const isPortraitMode = (s: string): s is PortraitMode => (PORTRAIT_MODES as readonly string[]).includes(s);

export type PortraitConfig = { src: string; /** Fractions of the image: left, top, right, bottom. */ crop: readonly [number, number, number, number] };

/** One stretch of identical cells. No colour = the mode's own colour (the accent). */
export type PortraitRun = { t: string; c?: string; b?: string; bold?: boolean };
export type PortraitArt = { mode: PortraitMode; cols: number; rows: number; /** Glyph advance in em (the font draws them), for sizing. */ adv: number; lines: PortraitRun[][] };

/** The columns each mode draws at, on a wide screen and on a phone. */
export const PORTRAIT_COLS: Record<PortraitMode, { wide: number; narrow: number }> = {
  pixels: { wide: 132, narrow: 132 },
  braille: { wide: 66, narrow: 44 },
  ascii: { wide: 100, narrow: 64 },
  blocks: { wide: 100, narrow: 64 },
  matrix: { wide: 100, narrow: 64 },
};
const ADV: Record<PortraitMode, number> = { pixels: 0.6, braille: 0.76, ascii: 0.6, blocks: 0.6, matrix: 0.6 };

export const portraitAdv = (mode: PortraitMode) => ADV[mode];

/** Reads the cropped image at `w` x `h` pixels. */
export type Sampler = (w: number, h: number) => ImageData;

const lum = (d: Uint8ClampedArray, i: number) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

/** Luminance 0..1 per pixel, stretched so the 2nd..98th percentile fills the range (any photo reads in any mode), and flipped when the backdrop is light. */
function luminance(img: ImageData): Float32Array {
  const n = img.width * img.height;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = lum(img.data, i * 4);
  const sorted = Float32Array.from(out).sort();
  const lo = sorted[Math.floor(n * 0.02)];
  const hi = sorted[Math.min(n - 1, Math.floor(n * 0.98))];
  const span = Math.max(0.05, hi - lo);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, (out[i] - lo) / span));
  // Ink glows on a dark screen: a photo with a light backdrop is flipped so the subject is the bright part.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += out[i];
  if (mean / n > 0.5) for (let i = 0; i < n; i++) out[i] = 1 - out[i];
  return out;
}

/** Same row count for every mode: the cell's shape (advance x 1em) against the crop's aspect. */
export function portraitRows(mode: PortraitMode, cols: number, aspect: number): number {
  return Math.max(4, Math.round((cols * ADV[mode]) / aspect));
}

const q = (v: number) => (v >> 3) << 3;
const rgb = (d: Uint8ClampedArray, i: number) => `rgb(${q(d[i])},${q(d[i + 1])},${q(d[i + 2])})`;

/** Merges neighbouring runs that share a style. */
function pack(cells: PortraitRun[]): PortraitRun[] {
  const out: PortraitRun[] = [];
  for (const c of cells) {
    const last = out[out.length - 1];
    if (last && last.c === c.c && last.b === c.b && last.bold === c.bold) last.t += c.t;
    else out.push({ ...c });
  }
  return out;
}

/** Small deterministic generator, so the matrix rain looks the same every time the mode is drawn. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RAMP = " .:-=+*#%@";
const BLOCKS = " ░▒▓█";
const KANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";

/** Braille dot bits for the 2x4 cell: (dx, dy) -> bit. */
const DOT = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
];

export function renderPortrait(mode: PortraitMode, cols: number, aspect: number, sample: Sampler): PortraitArt {
  const rows = portraitRows(mode, cols, aspect);
  const adv = ADV[mode];
  const lines: PortraitRun[][] = [];

  if (mode === "pixels") {
    const img = sample(cols, rows * 2);
    const d = img.data;
    for (let y = 0; y < rows; y++) {
      const cells: PortraitRun[] = [];
      for (let x = 0; x < cols; x++) cells.push({ t: "▀", c: rgb(d, ((2 * y) * cols + x) * 4), b: rgb(d, ((2 * y + 1) * cols + x) * 4) });
      lines.push(pack(cells));
    }
  } else if (mode === "braille") {
    const w = cols * 2;
    const h = rows * 4;
    const L = luminance(sample(w, h));
    // Floyd–Steinberg: bright = a dot.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const old = L[i];
        const nv = old >= 0.5 ? 1 : 0;
        const err = old - nv;
        L[i] = nv;
        if (x + 1 < w) L[i + 1] += (err * 7) / 16;
        if (y + 1 < h) {
          if (x > 0) L[i + w - 1] += (err * 3) / 16;
          L[i + w] += (err * 5) / 16;
          if (x + 1 < w) L[i + w + 1] += (err * 1) / 16;
        }
      }
    }
    for (let cy = 0; cy < rows; cy++) {
      let s = "";
      for (let cx = 0; cx < cols; cx++) {
        let bits = 0;
        for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 4; dy++) if (L[(cy * 4 + dy) * w + cx * 2 + dx] > 0.5) bits |= DOT[dx][dy];
        s += String.fromCharCode(0x2800 + bits);
      }
      lines.push([{ t: s }]);
    }
  } else {
    const L = luminance(sample(cols, rows));
    const rand = rng(cols * 7919 + rows);
    for (let y = 0; y < rows; y++) {
      const cells: PortraitRun[] = [];
      for (let x = 0; x < cols; x++) {
        const v = L[y * cols + x];
        if (mode === "ascii") cells.push({ t: RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))] });
        else if (mode === "blocks") cells.push({ t: BLOCKS[Math.min(BLOCKS.length - 1, Math.floor(v * BLOCKS.length))] });
        else if (v < 0.1) cells.push({ t: " " });
        else {
          const g = KANA[Math.floor(rand() * KANA.length)];
          cells.push(v > 0.82 ? { t: g, c: "#b6ffc9", bold: true } : v > 0.5 ? { t: g, c: "#35c15f" } : { t: g, c: "#1b7a3a" });
        }
      }
      lines.push(pack(cells));
    }
  }
  return { mode, cols, rows, adv, lines };
}

let imageP: { src: string; p: Promise<HTMLImageElement> } | null = null;

/** Loads the source once (same origin). */
export function loadPortraitImage(src: string): Promise<HTMLImageElement> {
  if (imageP?.src === src) return imageP.p;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("portrait: image failed"));
    img.src = src;
  });
  imageP = { src, p };
  // A failure must not stick: the next try loads again.
  p.catch(() => {
    if (imageP?.p === p) imageP = null;
  });
  return p;
}

const cache = new Map<string, PortraitArt>();
const key = (cfg: PortraitConfig, mode: PortraitMode, cols: number) => `${cfg.src}|${cfg.crop.join(",")}|${mode}|${cols}`;

/** What `renderPortrait` already made for these arguments, if anything. */
export const cachedPortrait = (cfg: PortraitConfig, mode: PortraitMode, cols: number) => cache.get(key(cfg, mode, cols));

export async function generatePortrait(cfg: PortraitConfig, mode: PortraitMode, cols: number): Promise<PortraitArt> {
  const hit = cache.get(key(cfg, mode, cols));
  if (hit) return hit;
  const img = await loadPortraitImage(cfg.src);
  try {
    await img.decode();
  } catch {}
  const [l, t, r, b] = cfg.crop;
  const sx = l * img.naturalWidth;
  const sy = t * img.naturalHeight;
  const sw = (r - l) * img.naturalWidth;
  const sh = (b - t) * img.naturalHeight;
  const sample: Sampler = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("portrait: no canvas");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  };
  const art = renderPortrait(mode, cols, sw / sh, sample);
  cache.set(key(cfg, mode, cols), art);
  return art;
}

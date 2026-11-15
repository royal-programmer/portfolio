/**
 * Procedural textures for the 3D room (18-3d-room-plan.md P0): drawn on a canvas, 512 px at most, so the
 * room ships no image files. A small seeded random keeps every load identical.
 */
import * as THREE from "three";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number], aniso = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Wood planks with grain: long streaks, per-plank tone, dark seams. */
export function woodTexture(size: number, base = "#7a5233", repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const r = rng(7);
  const planks = 6;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const tone = (r() - 0.5) * 0.18;
    g.fillStyle = base;
    g.fillRect(p * pw, 0, pw, size);
    g.fillStyle = tone > 0 ? `rgba(255,220,170,${tone})` : `rgba(0,0,0,${-tone})`;
    g.fillRect(p * pw, 0, pw, size);
    for (let i = 0; i < 70; i++) {
      const x = p * pw + r() * pw;
      const w = 0.5 + r() * 1.6;
      const dark = r() < 0.6;
      g.strokeStyle = dark ? `rgba(40,20,8,${0.05 + r() * 0.12})` : `rgba(255,230,190,${0.03 + r() * 0.07})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, 0);
      const wob = (r() - 0.5) * 6;
      g.bezierCurveTo(x + wob, size * 0.3, x - wob, size * 0.7, x + wob * 0.5, size);
      g.stroke();
    }
    g.fillStyle = "rgba(20,10,4,0.55)";
    g.fillRect(p * pw, 0, 1.5, size);
  }
  return finish(c, true, repeat);
}

/**
 * Glossy ceramic floor tiles with light grout: the map covers 2 x 2 tiles (a tile is `TILE_M` metres, so a texture tile is twice that)
 * with a slight tone difference from tile to tile, and a roughness map that is smooth on the tile and rough in the grout.
 */
export const TILE_M = 0.45;
export function tileTextures(size: number, repeat: [number, number]): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const half = size / 2;
  const grout = Math.max(1.5, size / 170);
  const r = rng(53);
  const col = canvas(size);
  const g = col.getContext("2d")!;
  g.fillStyle = "#b9bdc6";
  g.fillRect(0, 0, size, size);
  const ro = canvas(size);
  const gr = ro.getContext("2d")!;
  gr.fillStyle = "#e6e6e6";
  gr.fillRect(0, 0, size, size);
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      const tone = 244 + Math.round((r() - 0.5) * 8);
      const x = i * half + grout / 2;
      const y = j * half + grout / 2;
      const grad = g.createLinearGradient(x, y, x + half, y + half);
      grad.addColorStop(0, `rgb(${tone},${tone},${tone + 3})`);
      grad.addColorStop(1, `rgb(${tone - 5},${tone - 5},${tone - 2})`);
      g.fillStyle = grad;
      g.fillRect(x, y, half - grout, half - grout);
      gr.fillStyle = "#2b2b2b";
      gr.fillRect(x, y, half - grout, half - grout);
    }
  }
  return { map: finish(col, true, repeat), rough: finish(ro, false, repeat) };
}

/** A woven fabric: crossing threads on a tinted ground. */
export function fabricTexture(size: number, base = "#3c4466", repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const r = rng(11);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const o = (x / step + y / step) % 2 === 0;
      g.fillStyle = o ? `rgba(255,255,255,${0.012 + r() * 0.014})` : `rgba(0,0,0,${0.018 + r() * 0.018})`;
      g.fillRect(x, y, step - 1, step - 1);
    }
  }
  return finish(c, true, repeat);
}

/**
 * A tileable value-noise height field in 0..1: one layer per `[cellsX, cellsY, amplitude]` (cells per tile, so a layer
 * with many cells across and few down is a streak). Grids wrap, so the tile repeats without a seam.
 */
function heightField(size: number, layers: Array<[number, number, number]>, seed: number): Float32Array {
  const h = new Float32Array(size * size);
  const r = rng(seed);
  const sm = (t: number) => t * t * (3 - 2 * t);
  let total = 0;
  for (const [cx, cy, amp] of layers) {
    const nx = Math.max(2, Math.min(cx, size / 2));
    const ny = Math.max(2, Math.min(cy, size / 2));
    total += amp;
    const G = Float32Array.from({ length: nx * ny }, () => r());
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * ny;
      const y0 = Math.floor(fy);
      const ty = sm(fy - y0);
      const y1 = (y0 + 1) % ny;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * nx;
        const x0 = Math.floor(fx);
        const tx = sm(fx - x0);
        const x1 = (x0 + 1) % nx;
        const a = G[y0 * nx + x0];
        const b = G[y0 * nx + x1];
        const c = G[y1 * nx + x0];
        const d = G[y1 * nx + x1];
        h[y * size + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      }
    }
  }
  for (let i = 0; i < h.length; i++) h[i] /= total;
  return h;
}

/** A height field as a tangent-space normal map (RGB), repeating at the tile edge. */
function normalFromHeight(h: Float32Array, size: number, strength: number, repeat: [number, number]): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
      const dy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
      const nx = -dx * strength * 8;
      const ny = -dy * strength * 8;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, false, repeat);
}

/** A height field as a grey roughness map (three reads the green channel and multiplies it with the material's roughness): `lo`..`hi` of the material's value. */
function roughnessFromHeight(h: Float32Array, size: number, lo: number, hi: number, repeat: [number, number]): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  let min = 1;
  let max = 0;
  for (let i = 0; i < h.length; i++) {
    if (h[i] < min) min = h[i];
    if (h[i] > max) max = h[i];
  }
  const span = Math.max(1e-6, max - min);
  for (let i = 0; i < h.length; i++) {
    const v = (lo + ((h[i] - min) / span) * (hi - lo)) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finish(c, false, repeat);
}

/** The surface kinds a material preset can ask for (see `Kit.mat`): the height field behind each, as a normal map and a roughness map. */
export type SurfaceKind = "plaster" | "streak" | "brushed" | "grain" | "weave" | "blotch" | "wrinkle" | "shag";

function surfaceHeight(kind: SurfaceKind, size: number): Float32Array {
  switch (kind) {
    case "plaster":
      // Fine and even, no big waves: the old three-scale noise (8 cells across) read as ripples on an 8 m wall.
      return heightField(size, [[48, 48, 0.2], [96, 96, 0.35], [192, 192, 0.45]], 23);
    case "streak":
      // Grain running down the tile.
      return heightField(size, [[40, 3, 0.5], [90, 5, 0.3], [160, 2, 0.2]], 31);
    case "brushed":
      // Fine streaks running across the tile.
      return heightField(size, [[3, 120, 0.6], [4, 220, 0.4]], 37);
    case "grain":
      return heightField(size, [[64, 64, 0.4], [128, 128, 0.6]], 41);
    case "weave": {
      const h = new Float32Array(size * size);
      const k = (Math.PI * 2) / Math.max(4, size / 24);
      const n = heightField(size, [[64, 64, 1]], 43);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = 0.7 * (0.5 + 0.5 * Math.sin(x * k) * Math.sin(y * k)) + 0.3 * n[y * size + x];
      return h;
    }
    case "blotch":
      return heightField(size, [[6, 6, 0.5], [18, 18, 0.3], [48, 48, 0.2]], 47);
    case "wrinkle":
      // Soft folds of a duvet: a few long low waves and a little cloth grain, nothing sharp.
      return heightField(size, [[3, 2, 0.5], [6, 4, 0.3], [12, 9, 0.15], [64, 64, 0.05]], 53);
    case "shag":
      // Long pile seen from a distance: fine, dense, uneven.
      return heightField(size, [[64, 64, 0.3], [128, 128, 0.4], [256, 256, 0.3]], 59);
  }
}

/** A normal map for a surface kind (a subtle one: `strength` is small for grain and fabric, larger for plaster). */
export function surfaceNormal(kind: SurfaceKind, size: number, strength: number, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  return normalFromHeight(surfaceHeight(kind, size), size, strength, repeat);
}

/** A roughness map for a surface kind: the material's roughness times a value between `lo` and `hi` (1 = unchanged). */
export function surfaceRoughness(kind: SurfaceKind, size: number, lo: number, hi: number, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  return roughnessFromHeight(surfaceHeight(kind, size), size, lo, hi, repeat);
}

/** A soft plaster/noise height field, as a tangent-space normal map (a subtle surface, not bumps). Kept for the lab scene. */
export function noiseNormal(size: number, strength = 1.2, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  return normalFromHeight(heightField(size, [[8, 8, 0.55], [32, 32, 0.3], [128, 128, 0.15]], 23), size, strength, repeat);
}

/** A code-editor look for a monitor: dark ground, coloured token runs, a status bar. */
export function screenTexture(w: number, h: number, accent = "#7aa2ff"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const r = rng(3);
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#0c1020");
  grd.addColorStop(1, "#141a33");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#0a0d1a";
  g.fillRect(0, 0, w * 0.12, h);
  g.fillRect(0, h - 18, w, 18);
  g.fillStyle = accent;
  g.fillRect(0, h - 18, w * 0.2, 18);
  const colours = ["#7aa2ff", "#c792ea", "#89ddff", "#c3e88d", "#f78c6c", "#9aa5ce"];
  for (let line = 0; line < 22; line++) {
    let x = w * 0.15 + (line % 5 === 0 ? 0 : (line % 3) * 14);
    const y = 14 + line * 11;
    for (let run = 0; run < 3 + Math.floor(r() * 4); run++) {
      const len = 12 + r() * 60;
      g.fillStyle = colours[Math.floor(r() * colours.length)];
      g.globalAlpha = 0.85;
      g.fillRect(x, y, len, 4);
      x += len + 6;
    }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A blank picture with a title (an image field with no picture yet, or a picture that could not load). */
export function labelTexture(text: string, w = 256, h = 256, bg = "#1c1f2b", fg = "#9aa5ce", note?: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.globalAlpha = 0.35;
  g.lineWidth = 3;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.globalAlpha = 1;
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const size = Math.max(14, Math.min(h / 7, (w - 40) / Math.max(4, text.length) * 1.6));
  g.font = `600 ${size}px system-ui, sans-serif`;
  g.fillText(text, w / 2, h / 2 - (note ? size * 0.5 : 0), w - 30);
  if (note) {
    g.font = `${size * 0.55}px system-ui, sans-serif`;
    g.fillStyle = "#ff8a8a";
    g.fillText(note, w / 2, h / 2 + size * 0.7, w - 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The console's home screen: one tile per world (the stage's worlds), a dark ground. */
export function homeScreenTexture(tiles: Array<{ label: string; color: string }>, w = 512, h = 288): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, "#0a1030");
  gr.addColorStop(1, "#1a0f33");
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  const cols = 3;
  const tw = (w - 60) / cols;
  const th = (h - 90) / 2;
  tiles.slice(0, 6).forEach((t, i) => {
    const x = 20 + (i % cols) * (tw + 10);
    const y = 50 + Math.floor(i / cols) * (th + 10);
    g.fillStyle = t.color;
    g.globalAlpha = 0.85;
    g.fillRect(x, y, tw, th);
    g.globalAlpha = 1;
    g.fillStyle = "#ffffff";
    g.font = "600 20px system-ui, sans-serif";
    g.textBaseline = "bottom";
    g.fillText(t.label, x + 10, y + th - 8);
  });
  g.fillStyle = "#cfd6f2";
  g.font = "600 18px system-ui, sans-serif";
  g.textBaseline = "top";
  g.fillText("Home", 22, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A clock face: ticks and numerals on a light disc (the hands are meshes). */
export function clockFaceTexture(size = 256): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const r = size / 2;
  g.fillStyle = "#f1ece2";
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#1c1e26";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    g.lineWidth = long ? 5 : 2;
    g.beginPath();
    g.moveTo(r + Math.sin(a) * r * (long ? 0.8 : 0.88), r - Math.cos(a) * r * (long ? 0.8 : 0.88));
    g.lineTo(r + Math.sin(a) * r * 0.94, r - Math.cos(a) * r * 0.94);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * A door's panels as a normal map: `cols` x `rows` recessed panels with a soft bevel on a flat frame (the grooves are in
 * the map, not the geometry). Tangent space, so it works on the front face of a box.
 */
export function panelNormal(size: number, cols: number, rows: number, strength = 1): THREE.CanvasTexture {
  const h = new Float32Array(size * size);
  const m = 0.1; // frame margin, as a fraction of the door
  const bevel = 0.02;
  const ramp = (v: number) => Math.max(0, Math.min(1, v));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let depth = 1;
      const cw = (1 - 2 * m - (cols - 1) * m) / cols;
      const rh = (1 - 2 * m - (rows - 1) * m) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x0 = m + c * (cw + m);
          const y0 = m + r * (rh + m);
          const d = Math.min(u - x0, x0 + cw - u, v - y0, y0 + rh - v);
          if (d > 0) depth = Math.min(depth, 1 - ramp(d / bevel));
        }
      }
      h[y * size + x] = depth;
    }
  }
  return normalFromHeight(h, size, strength * 0.8, [1, 1]);
}

/** A pegboard: white with a grid of dark holes (the holes are colour, the board is flat); `holes` per tile side. */
export function pegTexture(size: number, holes = 8): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4f5f8";
  g.fillRect(0, 0, size, size);
  const step = size / holes;
  g.fillStyle = "#9096a6";
  for (let j = 0; j < holes; j++)
    for (let i = 0; i < holes; i++) {
      g.beginPath();
      g.arc((i + 0.5) * step, (j + 0.5) * step, Math.max(1.2, step * 0.11), 0, Math.PI * 2);
      g.fill();
    }
  return finish(c, true, [1, 1]);
}

/** White horizontal blinds as one picture: a stripe per slat with a lit top edge and a shaded underside (no per-slat meshes). */
export function blindsTexture(slats: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  const g = c.getContext("2d")!;
  const step = 256 / slats;
  for (let i = 0; i < slats; i++) {
    const y = i * step;
    const gr = g.createLinearGradient(0, y, 0, y + step);
    gr.addColorStop(0, "#fbfcff");
    gr.addColorStop(0.7, "#e4e7ee");
    gr.addColorStop(1, "#a9aebb");
    g.fillStyle = gr;
    g.fillRect(0, y, 8, step);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

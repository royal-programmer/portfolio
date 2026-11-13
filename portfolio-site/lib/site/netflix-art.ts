/**
 * Generated key art for the Netflix view (17-persona-views.md §21, C1). Pure and seeded: the same id always
 * draws the same poster. A spec is a handful of paths and dots (a grid, rays, rings, circuit traces), picked
 * by branch; colour comes from the page (`currentColor` and the card's `--b`), so no ids, no defs, no images.
 */

export type ArtShape = "wide" | "tall";
/** What the layers are for a tone: episodes by branch, then the item kinds. */
export type ArtPath = { d: string; kind: "fill" | "line" | "dots"; opacity: number; width?: number };
export type ArtCircle = { cx: number; cy: number; r: number; opacity: number; width: number };
export type ArtSpec = { w: number; h: number; paths: ArtPath[]; circles: ArtCircle[]; /** A colour mixed into the card's own tone so a row is not one blue. */ tint: string };
type Layer = "grid" | "rays" | "rings" | "traces" | "dots" | "waves" | "bars" | "diamonds" | "stripes" | "arcs";

/**
 * Which layers each tone draws, in paint order: several families per tone, and the seed picks one, so neighbours differ
 * in geometry as well as in placement. Data: change a row to change a branch's look.
 */
export const ART_LAYERS: Record<string, ReadonlyArray<ReadonlyArray<Layer>>> = {
  main: [["grid", "rays", "rings"], ["stripes", "arcs"], ["rays", "diamonds"]],
  learn: [["dots", "rings", "grid"], ["waves", "dots"], ["bars", "dots"]],
  side: [["grid", "traces"], ["diamonds", "traces"], ["stripes", "dots", "traces"]],
  life: [["rings", "dots"], ["waves", "rings"], ["arcs", "dots"]],
  project: [["grid", "traces", "rings"], ["bars", "traces"], ["diamonds", "grid", "arcs"]],
  post: [["rays", "dots"], ["waves", "stripes"], ["stripes", "arcs"]],
  skill: [["grid", "rings"], ["diamonds", "dots"], ["bars", "rings"]],
  cert: [["rings", "arcs"], ["diamonds", "rings"], ["stripes", "rings"]],
};

/** A small palette per tone: the seed picks a tint that is mixed into the card colour (about a third). */
export const ART_TINTS: Record<string, ReadonlyArray<string>> = {
  main: ["#4f6dff", "#9a5cff", "#18b8d8"],
  learn: ["#14b8a6", "#3fc27a", "#2aa7e0"],
  side: ["#a35cf0", "#e052a8", "#5b6cf0"],
  life: ["#8f8fa0", "#b79a7a", "#7a9ab0"],
  project: ["#e0713a", "#d9a21f", "#e24d6a"],
  post: ["#f0a22c", "#e66a4a", "#d6c04a"],
  skill: ["#3aa0e8", "#7a6cf0", "#2fc4a0"],
  cert: ["#e8b23a", "#d9822b", "#e0c46a"],
};

const SIZE: Record<ArtShape, [number, number]> = { wide: [320, 180], tall: [200, 300] };

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;

const cache = new Map<string, ArtSpec>();

/** The art for `seed` (an item id) in `tone`, drawn on a 320x180 (wide) or 200x300 (tall) sheet that is cropped to fit. */
export function artFor(seed: string, tone: string, shape: ArtShape): ArtSpec {
  const key = `${seed}|${tone}|${shape}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [w, h] = SIZE[shape];
  const r = rng(hash(key));
  const paths: ArtPath[] = [];
  const circles: ArtCircle[] = [];
  // One anchor per poster, so the layers agree: rays fan from it, rings centre on it, traces start near it.
  const ox = w * (0.55 + r() * 0.4);
  const oy = h * (0.55 + r() * 0.5);

  const families = ART_LAYERS[tone] ?? ART_LAYERS.main;
  const tints = ART_TINTS[tone] ?? ART_TINTS.main;
  const family = families[Math.floor(r() * families.length)];
  const tint = tints[Math.floor(r() * tints.length)];

  for (const layer of family) {
    if (layer === "grid") {
      const step = 16 + Math.floor(r() * 3) * 4;
      let d = "";
      for (let x = step / 2; x < w; x += step) d += `M${f(x)} 0V${h}`;
      for (let y = step / 2; y < h; y += step) d += `M0 ${f(y)}H${w}`;
      paths.push({ d, kind: "line", opacity: 0.1, width: 0.6 });
    } else if (layer === "rays") {
      const n = 9 + Math.floor(r() * 6);
      const reach = Math.hypot(w, h) * 1.2;
      let d = "";
      for (let i = 0; i < n; i++) {
        const a = -Math.PI + (i / n) * Math.PI + (r() - 0.5) * 0.12;
        const half = 0.03 + r() * 0.05;
        d += `M${f(ox)} ${f(oy)}L${f(ox + Math.cos(a - half) * reach)} ${f(oy + Math.sin(a - half) * reach)}L${f(ox + Math.cos(a + half) * reach)} ${f(oy + Math.sin(a + half) * reach)}Z`;
      }
      paths.push({ d, kind: "fill", opacity: 0.1 + r() * 0.06 });
    } else if (layer === "rings") {
      const n = 3 + Math.floor(r() * 3);
      const gap = Math.min(w, h) * (0.16 + r() * 0.08);
      for (let i = 1; i <= n; i++) circles.push({ cx: f(ox), cy: f(oy), r: f(gap * i), opacity: 0.28 - i * 0.035, width: 1.2 });
    } else if (layer === "dots") {
      const step = 14;
      let d = "";
      for (let y = step; y < h; y += step) for (let x = step; x < w; x += step) if (r() > 0.45) d += `M${x} ${y}h0`;
      paths.push({ d, kind: "dots", opacity: 0.32, width: 2 });
    } else if (layer === "waves") {
      const n = 5 + Math.floor(r() * 3);
      const amp = h * (0.05 + r() * 0.05);
      const len = w / (1.5 + r() * 1.5);
      let d = "";
      for (let i = 0; i < n; i++) {
        const y0 = (h * (i + 0.5)) / n;
        d += `M0 ${f(y0)}`;
        for (let x = 0; x < w; x += len) d += `q${f(len / 4)} ${f(-amp)} ${f(len / 2)} 0t${f(len / 2)} 0`;
      }
      paths.push({ d, kind: "line", opacity: 0.3, width: 1.4 });
    } else if (layer === "bars") {
      const n = 7 + Math.floor(r() * 5);
      const bw = w / n;
      let d = "";
      for (let i = 0; i < n; i++) {
        const bh = h * (0.2 + r() * 0.6);
        d += `M${f(i * bw + bw * 0.15)} ${h}h${f(bw * 0.7)}V${f(h - bh)}h${f(-bw * 0.7)}Z`;
      }
      paths.push({ d, kind: "fill", opacity: 0.14 + r() * 0.06 });
    } else if (layer === "diamonds") {
      const step = 26 + Math.floor(r() * 3) * 6;
      let d = "";
      for (let y = 0; y < h + step; y += step) for (let x = ((y / step) % 2) * (step / 2); x < w + step; x += step) d += `M${f(x)} ${f(y - step / 2)}l${f(step / 2)} ${f(step / 2)}l${f(-step / 2)} ${f(step / 2)}l${f(-step / 2)} ${f(-step / 2)}Z`;
      paths.push({ d, kind: "line", opacity: 0.16, width: 0.8 });
    } else if (layer === "stripes") {
      const gap = 12 + Math.floor(r() * 4) * 4;
      const slant = r() > 0.5 ? 1 : -1;
      let d = "";
      for (let x = -h; x < w + h; x += gap) d += `M${f(x)} 0L${f(x + slant * h)} ${h}`;
      paths.push({ d, kind: "line", opacity: 0.14, width: 3 + r() * 3 });
    } else if (layer === "arcs") {
      const n = 4 + Math.floor(r() * 3);
      const gap = Math.min(w, h) * 0.18;
      const a0 = r() * Math.PI * 2;
      let d = "";
      for (let i = 1; i <= n; i++) {
        const rr = gap * i;
        const a1 = a0 + Math.PI * (0.5 + r() * 0.7);
        d += `M${f(ox + Math.cos(a0) * rr)} ${f(oy + Math.sin(a0) * rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(ox + Math.cos(a1) * rr)} ${f(oy + Math.sin(a1) * rr)}`;
      }
      paths.push({ d, kind: "line", opacity: 0.4, width: 2.2 });
    } else {
      // Circuit traces: orthogonal runs with 45-degree joints on a 10-unit snap, each ending in a node.
      const runs = 5 + Math.floor(r() * 3);
      let lines = "";
      let nodes = "";
      for (let k = 0; k < runs; k++) {
        let x = Math.round((ox + (r() - 0.5) * w * 0.9) / 10) * 10;
        let y = Math.round((r() * h) / 10) * 10;
        lines += `M${x} ${y}`;
        nodes += `M${x} ${y}h0`;
        const segs = 3 + Math.floor(r() * 3);
        for (let s = 0; s < segs; s++) {
          const len = (1 + Math.floor(r() * 4)) * 10;
          const dir = Math.floor(r() * 4);
          if (dir === 0) x += len;
          else if (dir === 1) x -= len;
          else if (dir === 2) y += len;
          else y -= len;
          if (s % 2 === 1) {
            x += r() > 0.5 ? 10 : -10;
            y += r() > 0.5 ? 10 : -10;
          }
          lines += `L${x} ${y}`;
        }
        nodes += `M${x} ${y}h0`;
      }
      paths.push({ d: lines, kind: "line", opacity: 0.36, width: 1.2 });
      paths.push({ d: nodes, kind: "dots", opacity: 0.55, width: 5 });
    }
  }
  const spec = { w, h, paths, circles, tint };
  cache.set(key, spec);
  return spec;
}

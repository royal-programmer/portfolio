/**
 * Generated key art for the Netflix view (17-persona-views.md §21, C1). Pure and seeded: the same id always
 * draws the same poster. A spec is a handful of paths and dots (a grid, rays, rings, circuit traces), picked
 * by branch; colour comes from the page (`currentColor` and the card's `--b`), so no ids, no defs, no images.
 */

export type ArtShape = "wide" | "tall";
/** What the layers are for a tone: episodes by branch, then the item kinds. */
export type ArtPath = { d: string; kind: "fill" | "line" | "dots"; opacity: number; width?: number };
export type ArtCircle = { cx: number; cy: number; r: number; opacity: number; width: number };
export type ArtSpec = { w: number; h: number; paths: ArtPath[]; circles: ArtCircle[] };

/** Which layers each tone draws, in paint order. Data: change a row to change a branch's look. */
export const ART_LAYERS: Record<string, ReadonlyArray<"grid" | "rays" | "rings" | "traces" | "dots">> = {
  main: ["grid", "rays", "rings"],
  learn: ["dots", "rings", "grid"],
  side: ["grid", "traces"],
  life: ["rings", "dots"],
  project: ["grid", "traces", "rings"],
  post: ["rays", "dots"],
  skill: ["grid", "rings"],
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

  for (const layer of ART_LAYERS[tone] ?? ART_LAYERS.main) {
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
  const spec = { w, h, paths, circles };
  cache.set(key, spec);
  return spec;
}

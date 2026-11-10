/**
 * `arch`: the systems as box-and-arrow diagrams, drawn in box-drawing characters. Pure: data in, rows of
 * tagged runs out (the terminal colours them by kind and brightens the ones that touch a hovered node).
 * Layout is layered: a node's column is its longest-path depth, rows follow the data order; edges run
 * between neighbouring columns, with one vertical lane each where the rows differ.
 */

export type ArchKind = "ui" | "api" | "db" | "queue" | "ext" | "job";
export type ArchNode = { id: string; label: string; kind: ArchKind };
export type ArchDiagram = {
  id: string;
  title: string;
  /** One line for the `arch` list. */
  line?: string;
  nodes: ArchNode[];
  edges: Array<[string, string, string?]>;
  notes: string[];
};

export const ARCH_GLYPH: Record<ArchKind, string> = { ui: "▣", api: "⚙", db: "▤", queue: "≋", ext: "⇄", job: "⏱" };
export const ARCH_KINDS = Object.keys(ARCH_GLYPH) as ArchKind[];

/** One stretch of identical styling. `node`: part of that node's box. `edges`: indices into the diagram's edges. */
export type ArchRun = { t: string; kind?: ArchKind; node?: string; edges?: number[] };
export type ArchLayout = { wide: boolean; lines: ArchRun[][]; width: number; /** Edges the picture could not draw (they skip a column). */ skipped: number[] };

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const JOIN = [" ", "│", "─", "└", "│", "│", "┌", "├", "─", "┘", "─", "┴", "┐", "┤", "┬", "┼"];

type Cell = { mask: number; ch?: string; node?: string; kind?: ArchKind; edges: number[] };

/** Longest-path column per node, ignoring an edge that would close a loop. */
function depths(d: ArchDiagram): Map<string, number> {
  const ids = new Set(d.nodes.map((n) => n.id));
  const out = new Map<string, string[]>();
  for (const [a, b] of d.edges) if (ids.has(a) && ids.has(b)) out.set(a, [...(out.get(a) ?? []), b]);
  const dep = new Map<string, number>(d.nodes.map((n) => [n.id, 0]));
  const stack = new Set<string>();
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    stack.add(id);
    for (const t of out.get(id) ?? []) {
      if (stack.has(t)) continue;
      dep.set(t, Math.max(dep.get(t) ?? 0, (dep.get(id) ?? 0) + 1));
      seen.delete(t);
      walk(t);
    }
    stack.delete(id);
  };
  const hasIn = new Set(d.edges.map((e) => e[1]));
  for (const n of d.nodes) if (!hasIn.has(n.id)) walk(n.id);
  for (const n of d.nodes) walk(n.id);
  return dep;
}

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, Math.max(1, n - 1))}…` : t);

function pack(cells: Cell[]): ArchRun[] {
  const runs: ArchRun[] = [];
  let key = "";
  for (const c of cells) {
    const ch = c.ch ?? JOIN[c.mask];
    const k = `${c.node ?? ""}|${c.kind ?? ""}|${c.edges.join(",")}`;
    const last = runs[runs.length - 1];
    if (last && k === key) last.t += ch;
    else {
      runs.push({ t: ch, node: c.node, kind: c.kind, edges: c.edges.length ? [...c.edges] : undefined });
      key = k;
    }
  }
  return runs;
}

/** Draws `d` for a line of `cols` characters: the wide canvas when it fits, else one block per column. */
export function layoutArch(d: ArchDiagram, cols: number): ArchLayout {
  const dep = depths(d);
  const layers: ArchNode[][] = [];
  for (const n of d.nodes) (layers[dep.get(n.id) ?? 0] ??= []).push(n);
  for (let i = 0; i < layers.length; i++) layers[i] ??= [];
  const col = new Map<string, number>();
  layers.forEach((l, i) => l.forEach((n) => col.set(n.id, i)));
  const skipped: number[] = [];
  const byGutter: number[][] = layers.map(() => []);
  d.edges.forEach(([a, b], i) => {
    const ca = col.get(a);
    const cb = col.get(b);
    if (ca === undefined || cb === undefined) return;
    if (cb === ca + 1) byGutter[ca].push(i);
    else skipped.push(i);
  });
  const label = (n: ArchNode) => `${ARCH_GLYPH[n.kind]} ${n.label}`;

  // Wide: node boxes (3 rows) in columns, a gutter per neighbouring pair.
  const widths = layers.map((l) => Math.max(0, ...l.map((n) => label(n).length + 4)));
  const maxRows = Math.max(1, ...layers.map((l) => l.length));
  const top = (c: number, k: number) => Math.round(((maxRows - layers[c].length) * 4) / 2) + k * 4;
  function rowMid(e: number, target = false) {
    const id = d.edges[e][target ? 1 : 0];
    const c = col.get(id) ?? 0;
    return top(c, layers[c].findIndex((n) => n.id === id)) + 1;
  }
  const gut = layers.map((_, i) => {
    const es = byGutter[i];
    if (!es.length || i === layers.length - 1) return 0;
    const lab = Math.max(0, ...es.map((e) => (d.edges[e][2] ?? "").length));
    const moves = es.filter((e) => rowMid(e) !== rowMid(e, true)).length;
    return Math.max(7, lab + 2 * moves + 5);
  });
  const width = widths.reduce((a, b) => a + b, 0) + gut.reduce((a, b) => a + b, 0);

  if (width <= cols && !skipped.length) {
    const height = maxRows * 4 - 1;
    const grid: Cell[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ mask: 0, edges: [] })));
    const xs: number[] = [];
    let x = 0;
    layers.forEach((_, i) => {
      xs.push(x);
      x += widths[i] + gut[i];
    });
    const put = (r: number, c: number, p: Partial<Cell>) => Object.assign(grid[r][c], p);
    layers.forEach((l, ci) =>
      l.forEach((n, k) => {
        const y = top(ci, k);
        const x0 = xs[ci];
        const w = widths[ci];
        const text = label(n);
        const inner = w - 2;
        const rows = [`┌${"─".repeat(inner)}┐`, `│ ${text.padEnd(inner - 1)}│`, `└${"─".repeat(inner)}┘`];
        rows.forEach((s, ry) => [...s].forEach((ch, cx) => put(y + ry, x0 + cx, { ch, node: n.id, kind: n.kind })));
      }),
    );
    layers.forEach((_, ci) => {
      const g = gut[ci];
      if (!g) return;
      const x0 = xs[ci] + widths[ci];
      let lane = 0;
      const labelled = new Set<string>();
      for (const e of byGutter[ci]) {
        const ya = rowMid(e);
        const yb = rowMid(e, true);
        const lab = d.edges[e][2] ?? "";
        const tag = (r: number, c: number, m: number) => {
          const cell = grid[r][c];
          cell.mask |= m;
          if (!cell.edges.includes(e)) cell.edges.push(e);
        };
        if (ya === yb) {
          for (let c = 0; c < g; c++) tag(ya, x0 + c, (c > 0 ? W : 0) | (c < g - 1 ? E : 0));
        } else {
          const lx = x0 + 2 + 2 * lane++;
          for (let c = 0; c < lx - x0; c++) tag(ya, x0 + c, (c > 0 ? W : 0) | E);
          const [lo, hi] = ya < yb ? [ya, yb] : [yb, ya];
          for (let r = lo; r <= hi; r++) tag(r, lx, (r > lo ? N : 0) | (r < hi ? S : 0));
          // The corner turns: from the source row into the lane, and from the lane to the target row.
          tag(ya, lx, W | (yb > ya ? S : N));
          tag(yb, lx, (ya < yb ? N : S) | E);
          for (let c = lx - x0 + 1; c < g; c++) tag(yb, x0 + c, W | (c < g - 1 ? E : 0));
        }
        // Arrowhead and label on the target row's last run.
        const cell = grid[yb][x0 + g - 1];
        cell.ch = "▶";
        const slot = `${ci}:${yb}`;
        // Edges that arrive at one box share its last run: the first label stays, the others are left out.
        if (lab && !labelled.has(slot)) {
          labelled.add(slot);
          const start = ya === yb ? x0 + 1 : x0 + 2 + 2 * (lane - 1) + 2;
          const room = x0 + g - 1 - start;
          if (room >= lab.length + 2) {
            const s0 = start + Math.floor((room - lab.length) / 2);
            [...lab].forEach((ch, i) => {
              const c = grid[yb][s0 + i];
              c.ch = ch;
              if (!c.edges.includes(e)) c.edges.push(e);
            });
          }
        }
      }
    });
    return { wide: true, lines: grid.map(pack), width, skipped };
  }

  // Narrow: one block per column, the box then the edges that leave it as `↓` lines.
  const lines: ArchRun[][] = [];
  const room = Math.max(12, cols - 2);
  layers.forEach((l) => {
    l.forEach((n) => {
      const text = clip(label(n), room - 4);
      const inner = text.length + 2;
      const tag = (t: string): ArchRun[] => [{ t, node: n.id, kind: n.kind }];
      lines.push(tag(`┌${"─".repeat(inner)}┐`), tag(`│ ${text} │`), tag(`└${"─".repeat(inner)}┘`));
    });
    const here = new Set(l.map((n) => n.id));
    d.edges.forEach(([a, b, lab], i) => {
      if (!here.has(a) || col.get(b) === undefined) return;
      const t = clip(`↓ ${a} → ${b}${lab ? ` · ${lab}` : ""}`, room);
      lines.push([{ t: ` ${t}`, edges: [i] }]);
    });
  });
  return { wide: false, lines, width: 0, skipped: [] };
}

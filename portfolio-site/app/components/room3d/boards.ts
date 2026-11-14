/**
 * Content boards (round 36): the faces the room draws from the content layer on a 2D canvas, one canvas texture per
 * object that shows content: a `board` object (skill spines, certificate frames, key-moment cards), a monitor whose
 * screen is `projects` (a carousel of rows) and a TV in `reel` mode (the project clips' posters, one after another).
 * Layout comes from lib/room3d/board-layout.ts, the same rectangles a click is resolved with. Nothing here is a
 * record: every word comes from `RoomContent`. A board set owns its textures and disposes them.
 */
import * as THREE from "three";
import type { Room, RoomObject } from "@/lib/room3d/schema";
import { BOARD_MAX, layoutBoard, pickItem, type BoardStyle, type Rect } from "@/lib/room3d/board-layout";
import { boardItems, type BoardItem, type RoomContent } from "@/lib/room3d/content";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

type Ctx = CanvasRenderingContext2D;

/** Wrap `text` to `maxW` pixels in at most `lines` lines (an ellipsis when it is cut). */
function wrap(g: Ctx, text: string, maxW: number, lines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (g.measureText(next).width <= maxW || !cur) cur = next;
    else {
      out.push(cur);
      cur = words[i];
      if (out.length === lines) break;
    }
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(" ") !== out.join(" ")) {
    let last = out[lines - 1];
    while (last.length > 1 && g.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    out[lines - 1] = `${last.replace(/[\s,.;:]+$/, "")}…`;
  }
  return out;
}

const hsl = (i: number, s: number, l: number) => `hsl(${Math.round(((i * 47 + 205) % 360 + 360) % 360)} ${s}% ${l}%)`;
const STATUS_COLOR: Record<string, string> = { live: "#4ade80", "live, still building": "#fbbf24", "in development": "#94a3b8" };

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Where the rows start on a projects screen, as a fraction of its height (the header line sits above). */
export const ROWS_TOP = 54 / 440;

/** The row under a point `v` (from the top, 0..1) on a projects screen, or -1. */
export function pickRow(rects: readonly Rect[], v: number): number {
  return pickItem(rects, 0.5, (v - ROWS_TOP) / (1 - ROWS_TOP));
}

/** The projects carousel on the upper monitor: a terminal listing, the highlighted row marked. */
function drawRows(g: Ctx, W: number, H: number, items: BoardItem[], rects: Rect[], accent: string, hi: number) {
  g.fillStyle = "#0d1017";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  const u = H / 440;
  g.fillStyle = accent;
  g.font = `600 ${Math.round(22 * u)}px ${MONO}`;
  g.textBaseline = "top";
  g.fillText("$ ls projects/", Math.round(30 * u), Math.round(16 * u));
  if (items.length === 0) {
    g.fillStyle = "#6b7390";
    g.fillText("(nothing public yet)", Math.round(30 * u), Math.round(70 * u));
    return;
  }
  const top = Math.round(ROWS_TOP * H);
  const span = H - top;
  items.forEach((it, i) => {
    const r = rects[i];
    const y = top + r.y * span;
    const h = r.h * span;
    const x = r.x * W;
    const w = r.w * W;
    const on = i === hi;
    g.fillStyle = on ? "rgba(122,162,255,0.16)" : "rgba(255,255,255,0.04)";
    roundRect(g, x, y, w, h, 8 * u);
    g.fill();
    if (on) {
      g.fillStyle = accent;
      g.fillRect(x, y + h * 0.15, 4 * u, h * 0.7);
    }
    g.fillStyle = on ? "#ffffff" : "#d6dbee";
    g.font = `700 ${Math.round(26 * u)}px ${SANS}`;
    g.fillText(it.title, x + 20 * u, y + h * 0.14, w * 0.62);
    // status chip, right aligned
    g.font = `600 ${Math.round(16 * u)}px ${MONO}`;
    const tw = g.measureText(it.tag).width;
    const col = STATUS_COLOR[it.tag] ?? "#94a3b8";
    g.fillStyle = `${col}33`;
    roundRect(g, x + w - tw - 40 * u, y + h * 0.14, tw + 24 * u, 28 * u, 14 * u);
    g.fill();
    g.fillStyle = col;
    g.fillText(it.tag, x + w - tw - 28 * u, y + h * 0.14 + 5 * u);
    g.fillStyle = "#8c94b3";
    g.font = `${Math.round(18 * u)}px ${SANS}`;
    const lines = wrap(g, it.sub, w - 40 * u, h > 90 * u ? 2 : 1);
    lines.forEach((ln, k) => g.fillText(ln, x + 20 * u, y + h * 0.5 + k * 24 * u, w - 40 * u));
  });
}

/** Certificates and education: framed prints on a wall. */
function drawFrames(g: Ctx, W: number, H: number, items: BoardItem[], rects: Rect[]) {
  g.fillStyle = "#e9e2d3";
  g.fillRect(0, 0, W, H);
  items.forEach((it, i) => {
    const r = rects[i];
    const x = r.x * W;
    const y = r.y * H;
    const w = r.w * W;
    const h = r.h * H;
    g.save();
    g.shadowColor = "rgba(0,0,0,0.35)";
    g.shadowBlur = 10;
    g.shadowOffsetY = 4;
    g.fillStyle = "#2b2118";
    g.fillRect(x, y, w, h);
    g.restore();
    const b = Math.max(6, w * 0.035);
    g.fillStyle = "#f7f3ea";
    g.fillRect(x + b, y + b, w - b * 2, h - b * 2);
    const pad = Math.max(10, w * 0.07);
    const ix = x + b + pad;
    const iw = w - (b + pad) * 2;
    const edu = it.tag !== "verify" && it.tag !== "certificate";
    g.fillStyle = edu ? "#7a5a2b" : "#3b5b8c";
    g.font = `600 ${Math.round(Math.max(11, w * 0.065))}px ${MONO}`;
    g.textBaseline = "top";
    g.fillText(edu && /^\d/.test(it.tag) ? `EDUCATION · ${it.tag}` : edu ? "EDUCATION" : "CERTIFICATE", ix, y + b + pad * 0.8, iw);
    g.fillStyle = "#1d1a15";
    const ts = Math.round(Math.max(14, Math.min(w * 0.098, h * 0.14)));
    g.font = `700 ${ts}px ${SANS}`;
    const tl = wrap(g, it.title, iw, 3);
    tl.forEach((ln, k) => g.fillText(ln, ix, y + b + pad * 0.8 + ts * 1.5 + k * ts * 1.2, iw));
    g.fillStyle = "#6a6458";
    const ss = Math.round(Math.max(11, ts * 0.72));
    g.font = `${ss}px ${SANS}`;
    const sl = wrap(g, it.sub, iw, 2);
    sl.forEach((ln, k) => g.fillText(ln, ix, y + h - b - pad * 0.7 - (sl.length - k) * ss * 1.25, iw));
    if (it.tag === "verify") {
      g.fillStyle = "#2f7d4f";
      g.font = `700 ${Math.round(ss * 0.95)}px ${MONO}`;
      g.fillText("✓ verify", x + w - b - pad - g.measureText("✓ verify").width, y + b + pad * 0.8);
    }
  });
}

/** Key moments: polaroid-like cards, a coloured strip on top. */
function drawCards(g: Ctx, W: number, H: number, items: BoardItem[], rects: Rect[], accent: string) {
  g.fillStyle = "#cfc6b3";
  g.fillRect(0, 0, W, H);
  items.forEach((it, i) => {
    const r = rects[i];
    const x = r.x * W;
    const y = r.y * H;
    const w = r.w * W;
    const h = r.h * H;
    g.save();
    g.shadowColor = "rgba(0,0,0,0.3)";
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    g.fillStyle = "#faf7f0";
    g.fillRect(x, y, w, h);
    g.restore();
    g.fillStyle = i % 3 === 0 ? accent : hsl(i, 55, 52);
    g.fillRect(x, y, w, h * 0.09);
    const pad = Math.max(8, w * 0.07);
    g.textBaseline = "top";
    g.fillStyle = "#6a6458";
    g.font = `600 ${Math.round(Math.max(11, w * 0.085))}px ${MONO}`;
    g.fillText(it.sub, x + pad, y + h * 0.09 + pad * 0.6, w - pad * 2);
    g.fillStyle = "#1d1a15";
    const ts = Math.round(Math.max(13, Math.min(w * 0.1, h * 0.12)));
    g.font = `700 ${ts}px ${SANS}`;
    wrap(g, it.title, w - pad * 2, 4).forEach((ln, k) => g.fillText(ln, x + pad, y + h * 0.09 + pad * 0.6 + ts * 1.5 + k * ts * 1.18, w - pad * 2));
    if (it.tag) {
      g.fillStyle = "#2f7d4f";
      g.font = `700 ${Math.round(ts * 0.8)}px ${MONO}`;
      g.fillText(it.tag, x + pad, y + h - pad - ts * 0.8, w - pad * 2);
    }
  });
}

/** Skills as the spines of books on a shelf: the group's name reads up the spine, the count sits at its foot. */
function drawSpines(g: Ctx, W: number, H: number, items: BoardItem[], rects: Rect[]) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#241b14");
  bg.addColorStop(1, "#18120d");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  items.forEach((it, i) => {
    const r = rects[i];
    const x = r.x * W;
    const y = r.y * H;
    const w = r.w * W;
    const h = r.h * H;
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, hsl(i, 48, 30));
    grad.addColorStop(0.5, hsl(i, 52, 38));
    grad.addColorStop(1, hsl(i, 48, 27));
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillRect(x + w * 0.1, y + h * 0.06, w * 0.8, 3);
    g.fillRect(x + w * 0.1, y + h * 0.06 + 9, w * 0.8, 1.5);
    g.fillRect(x + w * 0.1, y + h * 0.9, w * 0.8, 3);
    g.save();
    g.translate(x + w / 2, y + h * 0.86);
    g.rotate(-Math.PI / 2);
    g.fillStyle = "#fff8e8";
    const fs = Math.round(Math.max(14, Math.min(w * 0.3, 54)));
    g.font = `700 ${fs}px ${SANS}`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    let label = it.title;
    const room = h * 0.74;
    while (label.length > 3 && g.measureText(label).width > room) label = `${label.slice(0, -2)}…`;
    g.fillText(label, 0, 0);
    g.restore();
    g.fillStyle = "rgba(255,248,232,0.8)";
    g.font = `600 ${Math.round(Math.max(11, w * 0.17))}px ${MONO}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(it.tag, x + w / 2, y + h * 0.955);
    g.textAlign = "left";
  });
}

type Reel = { title: string; label: string; poster: string };

function drawReel(g: Ctx, W: number, H: number, clips: Reel[], at: number, imgs: Map<string, HTMLImageElement>, accent: string) {
  g.fillStyle = "#07080c";
  g.fillRect(0, 0, W, H);
  const c = clips[at % clips.length];
  const img = imgs.get(c.poster);
  if (img && img.complete && img.naturalWidth > 0) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    g.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, "#161a28");
    gr.addColorStop(1, "#0b0d15");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  const bar = g.createLinearGradient(0, H * 0.62, 0, H);
  bar.addColorStop(0, "rgba(0,0,0,0)");
  bar.addColorStop(1, "rgba(0,0,0,0.82)");
  g.fillStyle = bar;
  g.fillRect(0, H * 0.62, W, H * 0.38);
  g.textBaseline = "bottom";
  g.fillStyle = "#ffffff";
  g.font = `700 ${Math.round(H * 0.075)}px ${SANS}`;
  g.fillText(c.title, W * 0.05, H * 0.86, W * 0.9);
  g.fillStyle = "#cfd6f2";
  g.font = `${Math.round(H * 0.045)}px ${SANS}`;
  g.fillText(c.label, W * 0.05, H * 0.93, W * 0.9);
  g.fillStyle = accent;
  g.font = `700 ${Math.round(H * 0.04)}px ${MONO}`;
  g.textBaseline = "top";
  g.fillText("PROJECT REEL", W * 0.05, H * 0.05);
  clips.forEach((_, i) => {
    g.fillStyle = i === at % clips.length ? "#ffffff" : "rgba(255,255,255,0.35)";
    g.beginPath();
    g.arc(W * 0.95 - (clips.length - 1 - i) * H * 0.04, H * 0.07, H * 0.013, 0, Math.PI * 2);
    g.fill();
  });
}

export type BoardSpec = { id: string; style: BoardStyle; source: "skills" | "credentials" | "moments" | "projects"; aspect: number };

/** Which objects of a room show content, and how (the data the sets are built from). */
export function boardSpecs(room: Room): BoardSpec[] {
  const out: BoardSpec[] = [];
  for (const o of room.objects as RoomObject[]) {
    if (o.kind === "board") out.push({ id: o.id, style: o.params.style, source: o.params.source, aspect: o.params.w / o.params.h });
    else if (o.kind === "monitor" && o.params.screen === "projects") out.push({ id: o.id, style: "rows", source: "projects", aspect: o.params.aspect });
  }
  return out;
}

/** The TV objects that show the reel. */
export const reelIds = (room: Room): string[] => (room.objects as RoomObject[]).filter((o) => o.kind === "tv" && o.params.mode === "reel").map((o) => o.id);

export type BoardSet = {
  textures: Record<string, THREE.CanvasTexture>;
  /** The item tiles of a board (for picking a click). */
  rects: Record<string, Rect[]>;
  items: Record<string, BoardItem[]>;
  /** Advance the carousel and the reel (call about every 250 ms); redraws only what changed. */
  tick: (nowMs: number) => void;
  dispose: () => void;
};

/**
 * Build a board's texture for every content object in the room. `scale` is the tier's texture size over 512
 * (a phone draws at half the resolution of a desktop on High); `hold` is how long the carousel and the reel stay on
 * one entry, in ms (0 = static, for reduced motion).
 */
export function createBoards(room: Room, content: RoomContent, o: { scale: number; accent: string; holdMs: number }): BoardSet {
  const textures: Record<string, THREE.CanvasTexture> = {};
  const rects: Record<string, Rect[]> = {};
  const items: Record<string, BoardItem[]> = {};
  const draws: Record<string, (step: number) => void> = {};
  const base = Math.round(1024 * Math.min(1, Math.max(0.5, o.scale)));
  const mk = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { c, t, g: c.getContext("2d")! };
  };
  for (const s of boardSpecs(room)) {
    const W = base;
    const H = Math.max(128, Math.round(base / s.aspect));
    const list = boardItems(content, s.source, BOARD_MAX[s.style]);
    const rs = layoutBoard(s.style, list.length, s.aspect);
    const { t, g } = mk(W, H);
    textures[s.id] = t;
    rects[s.id] = rs;
    items[s.id] = list;
    const draw = (step: number) => {
      if (s.style === "rows") drawRows(g, W, H, list, rs, o.accent, list.length ? step % list.length : -1);
      else if (s.style === "frames") drawFrames(g, W, H, list, rs);
      else if (s.style === "cards") drawCards(g, W, H, list, rs, o.accent);
      else drawSpines(g, W, H, list, rs);
      t.needsUpdate = true;
    };
    draw(0);
    if (s.style === "rows") draws[s.id] = draw;
  }
  // The TV's reel: the posters of every project's clips, in order; none, no reel (the TV then shows the worlds).
  const clips: Reel[] = content.projects.flatMap((p) => p.clips.map((c) => ({ title: p.title, label: c.label, poster: c.poster })));
  const imgs = new Map<string, HTMLImageElement>();
  let live = true;
  let lastStep = 0;
  let t0 = -1;
  if (clips.length > 0) {
    for (const id of reelIds(room)) {
      const W = Math.round(base * 0.94);
      const H = Math.round((W * 9) / 16);
      const { t, g } = mk(W, H);
      textures[id] = t;
      draws[id] = (step: number) => {
        drawReel(g, W, H, clips, step, imgs, o.accent);
        t.needsUpdate = true;
      };
      draws[id](0);
    }
    for (const c of clips) {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        // A poster arrived: redraw the frame that is showing.
        if (live) for (const id of reelIds(room)) draws[id]?.(lastStep);
      };
      im.src = c.poster;
      imgs.set(c.poster, im);
    }
  }
  return {
    textures,
    rects,
    items,
    tick: (now) => {
      if (o.holdMs <= 0) return;
      if (t0 < 0) t0 = now;
      const step = Math.floor((now - t0) / o.holdMs);
      if (step === lastStep) return;
      lastStep = step;
      for (const id of Object.keys(draws)) draws[id](step);
    },
    dispose: () => {
      live = false;
      for (const t of Object.values(textures)) t.dispose();
    },
  };
}

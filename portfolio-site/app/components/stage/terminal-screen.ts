/**
 * The laptop's screen on the Stage: the live terminal, drawn on a 2D canvas that becomes a texture.
 * It shows the boot banner, then types `portfolio` and prints the first lines of the real output
 * (the same pure shell the terminal and the preview image run). The canvas is redrawn at most 6
 * times a second and only when its content changed (a new typed character, a new line, a new theme).
 */
import * as THREE from "three";
import type { OgLine, OgTone } from "@/lib/site/og-lines";
import type { ThemePalette } from "@/lib/site/terminal-themes";

export const SCREEN_PX = { w: 1024, h: 640 } as const;
/** Redraw budget: one frame per this many milliseconds, at most. */
const DEFAULT_STEP_MS = 1000 / 6;
const FONT_PX = 16;
const ROW_PX = 24;
const PAD_X = 28;
const TOP = 52;
const OUTPUT_ROWS = 8;
const BANNER_ROWS = 3;
const COMMAND = "portfolio";

export type TerminalScreen = {
  texture: THREE.CanvasTexture;
  /** Advance the script (`seconds` since it started); redraws only if something changed. Returns true when it drew. */
  tick: (seconds: number, nowMs: number) => boolean;
  setPalette: (p: ThemePalette) => void;
  /** The most redraws a second (the performance tier's). */
  setFps: (fps: number) => void;
  /** True once the first frame has been drawn into the texture. */
  drawn: () => boolean;
  dispose: () => void;
};

const toneOf = (p: ThemePalette, tone: OgTone | undefined) => {
  switch (tone) {
    case "accent":
      return p.accent;
    case "dim":
      return p.dim;
    case "ok":
      return p.ok;
    case "violet":
      return p.violet;
    default:
      return p.ink;
  }
};

/** Steps of the script: banner rows appear one per step, then the command types (2 chars a step), then output rows. */
function stepFor(seconds: number, bannerRows: number, outputRows: number) {
  const s = Math.max(0, seconds);
  const banner = Math.min(bannerRows, Math.floor(s / 0.12) + 1);
  const typeStart = 0.12 * bannerRows + 0.35;
  const typed = Math.min(COMMAND.length, Math.max(0, Math.floor((s - typeStart) / 0.12) * 2));
  const outStart = typeStart + 0.12 * Math.ceil(COMMAND.length / 2) + 0.3;
  const out = Math.min(outputRows, Math.max(0, Math.floor((s - outStart) / 0.14) + (s >= outStart ? 1 : 0)));
  return { banner, typed, out };
}

export function createTerminalScreen(opts: { banner: OgLine[]; output: OgLine[]; palette: ThemePalette; host: string }): TerminalScreen {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_PX.w;
  canvas.height = SCREEN_PX.h;
  const g = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const banner = opts.banner.slice(0, BANNER_ROWS);
  const output = opts.output.slice(0, OUTPUT_ROWS);
  let palette = opts.palette;
  let key = "";
  let last = -1e9;
  let drawnOnce = false;
  let font = `${FONT_PX}px ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace`;
  try {
    const fam = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim();
    if (fam) font = `${FONT_PX}px ${fam}, ui-monospace, Consolas, monospace`;
  } catch {}

  const draw = (st: { banner: number; typed: number; out: number }, cursor: boolean) => {
    if (!g) return;
    g.fillStyle = palette.bg;
    g.fillRect(0, 0, SCREEN_PX.w, SCREEN_PX.h);
    // Title bar.
    g.fillStyle = palette.void;
    g.fillRect(0, 0, SCREEN_PX.w, 34);
    const dots = [palette.faint, palette.faint, palette.accent];
    dots.forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(20 + i * 18, 17, 5, 0, Math.PI * 2);
      g.fill();
    });
    g.font = `13px ${font.split("px ")[1]}`;
    g.fillStyle = palette.dim;
    g.textBaseline = "middle";
    g.fillText(opts.host, SCREEN_PX.w / 2 - 70, 18);
    g.font = font;
    g.textBaseline = "alphabetic";
    let y = TOP;
    const charW = g.measureText("M").width;
    const run = (line: OgLine) => {
      let x = PAD_X;
      for (const r of line) {
        g.fillStyle = toneOf(palette, r.tone);
        g.fillText(r.t, x, y);
        x += r.t.length * charW;
      }
      y += ROW_PX;
    };
    banner.slice(0, st.banner).forEach(run);
    y += ROW_PX * 0.5;
    // The prompt line.
    g.fillStyle = palette.ok;
    g.fillText("~ $", PAD_X, y);
    g.fillStyle = palette.ink;
    g.fillText(COMMAND.slice(0, st.typed), PAD_X + charW * 4, y);
    if (cursor && st.out === 0) {
      g.fillStyle = palette.accent;
      g.fillRect(PAD_X + charW * (4 + st.typed), y - FONT_PX + 2, charW * 0.6, FONT_PX);
    }
    y += ROW_PX;
    output.slice(0, st.out).forEach(run);
    texture.needsUpdate = true;
    drawnOnce = true;
  };

  let minStep = DEFAULT_STEP_MS;
  const self: TerminalScreen = {
    texture,
    tick(seconds, nowMs) {
      if (drawnOnce && nowMs - last < minStep) return false;
      const st = stepFor(seconds, banner.length, output.length);
      const cursor = Math.floor(seconds * 2) % 2 === 0 && st.out === 0;
      const k = `${st.banner}.${st.typed}.${st.out}.${cursor ? 1 : 0}.${palette.id}`;
      if (k === key) return false;
      key = k;
      last = nowMs;
      draw(st, cursor);
      return true;
    },
    setFps(fps) {
      minStep = 1000 / Math.max(1, fps);
    },
    setPalette(p) {
      palette = p;
      key = "";
    },
    drawn: () => drawnOnce,
    dispose: () => texture.dispose(),
  };
  return self;
}

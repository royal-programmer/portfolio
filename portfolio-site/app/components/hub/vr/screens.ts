/**
 * Screen content for the engineer's objects, drawn in code (D38 round B).
 *
 * The code on the screens is real: excerpts of this site's own source (the
 * fluid under the cursor, the climb, the sound). Nothing is lorem ipsum.
 * When Ratul's own editor screenshots land in `public/hub/engineer/`, the
 * laptop takes those instead (`LAPTOP_SCREEN_SRC`); the drifting slabs keep
 * the drawn code, which reads better small.
 */
import * as THREE from "three";
import { spectrumHue } from "@/lib/site/spectrum";

/** Optional real screenshot for the laptop (WebP/PNG under public/). `null` = drawn editor. */
export const LAPTOP_SCREEN_SRC: string | null = null;

// --- Real source, as it appears in this repo ---------------------------------
const FILES: Array<{ name: string; lang: "ts" | "glsl"; code: string }> = [
  {
    name: "fluid.ts",
    lang: "glsl",
    code: `// Semi-Lagrangian advection: look back along the flow.
vec2 back = vUv - here.rg * uDt * 2.0;
vec4 s = texture2D(tPrev, back);
vec2 v = s.rg;
float d = s.b;
float hue = s.a;

// Vorticity confinement: push the flow around the centres of
// rotation, so a stroke rolls up into eddies instead of fading.
float c0 = curlAt(vUv);
vec2 grad = vec2(
  abs(curlAt(vUv + vec2(uTexel.x, 0.0))) - abs(curlAt(vUv - vec2(uTexel.x, 0.0))),
  abs(curlAt(vUv + vec2(0.0, uTexel.y))) - abs(curlAt(vUv - vec2(0.0, uTexel.y))));
vec2 N = grad / (length(grad) + 1e-5);
v += vec2(N.y, -N.x) * c0 * 7.0 * uDt;

// Dissipate.
v *= exp(-uDt * 0.8);
d *= exp(-uDt * 0.75);

// Splat where the pointer moved: a narrow stroke, the flow spreads it.
vec2 dp = (vUv - uPointer) * vec2(uAspect, 1.0);
float g = exp(-dot(dp, dp) / 0.0012) * uStir;
v += uDelta * g * 2.4;
float add = length(uDelta) * g * 7.0;
hue = mix(hue, uHue, clamp(add * 2.0, 0.0, 1.0));
d = min(d + add, 1.6);
gl_FragColor = vec4(v, d, hue);`,
  },
  {
    name: "util.ts",
    lang: "ts",
    code: `/**
 * Where the camera is and where it looks at climb progress c
 * (page sections): a helix inside the cone, tilting from the
 * J's pitch back to level.
 */
export function climbPose(c: number, out: Pose = makePose()): Pose {
  const y = CLIMB_BASE_Y + c * WORLD.climbRise;
  const theta = c * WORLD.climbTurn;
  const rCone = coneRadius(y - WORLD.coneApex.y);
  // Stay well inside the cone: the rays are the view.
  const r = lerp(0.3, rCone * 0.22, smoothstep(c, 0, 0.7));
  out.pos.set(Math.sin(theta) * r, y, -Math.cos(theta) * r);
  out.pitch = WORLD.splitPitch * (1 - smoothstep(c, 0, 1.05));
  out.yaw = -Math.PI / 2 - theta; // along the tangent
  const cp = Math.cos(out.pitch);
  out.fwd.set(Math.sin(out.yaw) * cp, Math.sin(out.pitch), -Math.cos(out.yaw) * cp);
  out.right.set(Math.cos(out.yaw), 0, Math.sin(out.yaw));
  return out;
}`,
  },
  {
    name: "ambient-sound.ts",
    lang: "ts",
    code: `// Slowing time: pitch falls, the filter closes, a sub swells and
// a thin high shimmer appears — the "underwater" feeling.
timeScale(s: number) {
  if (!engine) return;
  const k = Math.min(1, Math.max(0, (s - 0.1) / 0.9)); // 1 normal … 0 slowed
  engine.scale = k;
  const now = engine.ctx.currentTime;
  const cents = (1 - k) * -700;
  for (const o of engine.oscs) o.detune.setTargetAtTime(cents, now, 0.3);
  engine.sub.gain.setTargetAtTime((1 - k) * 0.2, now, 0.35);
  engine.shimmer.gain.setTargetAtTime((1 - k) * 0.012, now, 0.5);
  applyFilter(engine);
},

// The strike: a sub drop under the chime.
impact() {
  if (!engine || engine.master.gain.value < 0.01) return;
  const { ctx, sub, subOsc, wind } = engine;
  const now = ctx.currentTime;
  subOsc.frequency.cancelScheduledValues(now);
  subOsc.frequency.setValueAtTime(90, now);
  subOsc.frequency.exponentialRampToValueAtTime(36, now + 1.4);
  sub.gain.cancelScheduledValues(now);
  sub.gain.setValueAtTime(0.5, now);
  sub.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  wind.gain.setTargetAtTime(0.025, now, 0.6);
  this.chime(1);
},`,
  },
  {
    name: "scene.tsx",
    lang: "ts",
    code: `// ---- Time ----
const canSlow = s.phase !== "gate" && s.phase !== "wear";
k.dt = dt;
k.scale = damp(k.scale, s.holding && canSlow ? 0.1 : 1, s.holding ? 3.5 : 2, dt);
k.t += dt * k.scale;
k.phaseT = s.phaseAt ? (now - s.phaseAt) / 1000 : 0;

// ---- Phase timeline ----
if (s.phase === "approach") {
  s.approach = Math.min(1, s.approach + dt * k.scale * approachSpeed(s.approach));
  if (s.approach >= 1) end("approach");
}

// The split, in three overlapping movements: the white pillar
// reaches up (impact), fans out (spread), and the colour
// separates inside it (chroma).
if (s.phase === "split") {
  const u = k.phaseT / PHASE_LENGTH.split;
  k.cone = 1;
  k.spread = easeInOut((u - 0.04) / 0.7);
  k.chroma = easeInOut((u - 0.2) / 0.72);
}`,
  },
];

const KEYWORDS = new Set(
  "const let var function return if else for of in new export import type class extends void this true false null undefined break continue async await uniform varying attribute float vec2 vec3 vec4 mat3 mat4 sampler2D precision highp".split(" "),
);

type Tok = { text: string; kind: "kw" | "str" | "com" | "num" | "fn" | "type" | "punct" | "id" | "ws" };

function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /(\/\/.*$)|(\/\*[\s\S]*?\*\/|\/\*.*$|^\s*\*.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1] || m[2]) out.push({ text: m[0], kind: "com" });
    else if (m[3]) out.push({ text: m[0], kind: "str" });
    else if (m[4]) out.push({ text: m[0], kind: "num" });
    else if (m[5]) {
      const w = m[0];
      const next = line[re.lastIndex];
      if (KEYWORDS.has(w)) out.push({ text: w, kind: "kw" });
      else if (next === "(") out.push({ text: w, kind: "fn" });
      else if (/^[A-Z]/.test(w)) out.push({ text: w, kind: "type" });
      else out.push({ text: w, kind: "id" });
    } else if (m[6]) out.push({ text: m[0], kind: "ws" });
    else out.push({ text: m[0], kind: "punct" });
  }
  return out;
}

/** Editor palette: our void, warm ink, colour only where the light would be. */
function palette(t: number) {
  const h = spectrumHue(t);
  return {
    bg: "#0b0b11",
    chrome: "#08080d",
    gutter: "rgba(243,241,236,0.22)",
    id: "#d9d6cf",
    punct: "rgba(243,241,236,0.55)",
    kw: `hsl(${h} 85% 70%)`,
    fn: `hsl(${(h + 300) % 360} 70% 72%)`,
    type: `hsl(${(h + 40) % 360} 70% 72%)`,
    str: "hsl(38 80% 68%)",
    num: "hsl(165 60% 64%)",
    com: "rgba(243,241,236,0.34)",
    accent: `hsl(${h} 90% 62%)`,
    line: `hsla(${h} 90% 62% / 0.08)`,
  };
}

/** The site's mono face (next/font gives it a private family name, read off the root). */
function monoFamily(): string {
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim();
  return `${v ? v + ", " : ""}"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
}
let MONO = "";

type EditorOpts = {
  file: number;
  /** First line shown. */
  from?: number;
  fontPx: number;
  t: number;
  /** Draw tab bar + status bar (the laptop); slabs are content only. */
  chrome?: boolean;
  /** Which line the caret sits on (relative to `from`). */
  caret?: number;
};

function drawEditor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: EditorOpts) {
  const P = palette(o.t);
  const f = FILES[o.file % FILES.length];
  const lines = f.code.split("\n");
  const from = o.from ?? 0;
  const lh = Math.round(o.fontPx * 1.55);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = P.bg;
  ctx.fillRect(x, y, w, h);

  let top = y;
  if (o.chrome) {
    // Tab bar.
    const tabH = Math.round(o.fontPx * 2.3);
    ctx.fillStyle = P.chrome;
    ctx.fillRect(x, y, w, tabH);
    ctx.font = `${o.fontPx * 0.92}px ${MONO}`;
    ctx.textBaseline = "middle";
    let tx = x + o.fontPx * 1.2;
    FILES.forEach((ff, i) => {
      const active = i === o.file % FILES.length;
      const tw = ctx.measureText(ff.name).width + o.fontPx * 2.2;
      if (active) {
        ctx.fillStyle = P.bg;
        ctx.fillRect(tx, y, tw, tabH);
        ctx.fillStyle = P.accent;
        ctx.fillRect(tx, y, tw, 2);
      }
      ctx.fillStyle = active ? P.id : P.com;
      ctx.fillText(ff.name, tx + o.fontPx * 1.1, y + tabH / 2);
      tx += tw;
    });
    top = y + tabH + lh * 0.5;
    // Status bar.
    const sbH = Math.round(o.fontPx * 1.7);
    ctx.fillStyle = P.chrome;
    ctx.fillRect(x, y + h - sbH, w, sbH);
    ctx.fillStyle = P.com;
    ctx.font = `${o.fontPx * 0.8}px ${MONO}`;
    ctx.fillText(`⎇ phase-0-content-engine     ${f.lang === "ts" ? "TypeScript" : "GLSL"}     UTF-8     Ln ${from + (o.caret ?? 6) + 1}, Col 1`, x + o.fontPx * 1.2, y + h - sbH / 2);
    h -= sbH;
  }

  const gutterW = Math.round(o.fontPx * 3.4);
  ctx.font = `${o.fontPx}px ${MONO}`;
  ctx.textBaseline = "alphabetic";
  const rows = Math.ceil((y + h - top) / lh) + 1;
  for (let r = 0; r < rows; r++) {
    const li = from + r;
    const ly = top + r * lh + o.fontPx;
    if (li >= lines.length) break;
    if (r === (o.caret ?? -1)) {
      ctx.fillStyle = P.line;
      ctx.fillRect(x, ly - o.fontPx * 1.15, w, lh);
    }
    ctx.fillStyle = P.gutter;
    ctx.textAlign = "right";
    ctx.fillText(String(li + 1), x + gutterW - o.fontPx * 0.8, ly);
    ctx.textAlign = "left";
    let cx = x + gutterW;
    for (const tok of tokenize(lines[li])) {
      if (tok.kind !== "ws") {
        ctx.fillStyle = P[tok.kind];
        ctx.fillText(tok.text, cx, ly);
      }
      cx += ctx.measureText(tok.text).width;
    }
  }
  if (o.chrome) {
    // Caret.
    const cy = top + (o.caret ?? 6) * lh;
    ctx.fillStyle = P.id;
    ctx.fillRect(x + gutterW, cy - o.fontPx * 0.1, 2, lh * 0.85);
  }
  ctx.restore();
}

const GLYPHS = ["{ }", "</>", "=>", "λ", "fn()", "0x1F", "&&", "#!"];

function drawGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glyph: string, t: number) {
  const P = palette(t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = P.bg;
  ctx.fillRect(x, y, w, h);
  ctx.font = `${h * 0.42}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = P.kw;
  ctx.fillText(glyph, x + w / 2, y + h / 2 + h * 0.02);
  ctx.restore();
}

/** A canvas texture that redraws itself once the web fonts are in (the first draw may be the fallback face). */
function makeTexture(canvas: HTMLCanvasElement, draw: () => void) {
  MONO = monoFamily();
  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (typeof document !== "undefined" && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      MONO = monoFamily();
      draw();
      tex.needsUpdate = true;
    });
  }
  return tex;
}

/** Tiles per side of every atlas; a tile's (col,row) → uv offset = (col, row) / ATLAS_N. */
export const ATLAS_N = 4;
/** Tile count: in each 2:1 atlas the first eight are "screens", the last eight "glyphs". */
export const ATLAS_TILES = ATLAS_N * ATLAS_N;

// --- Trader: charts and the numbers a journal keeps (illustrative, never currency) -----------
const TICKERS = ["+2.4%", "−0.8%", "1 : 3 R", "58% win", "0.5 R", "DD 4%", "+0.3 R ev", "4H"];

function drawChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, seed: number) {
  const P = palette(t);
  let a = (seed * 9301 + 49297) % 233280;
  const rnd = () => (a = (a * 9301 + 49297) % 233280) / 233280;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = P.bg;
  ctx.fillRect(x, y, w, h);
  // Grid: faint, few.
  ctx.strokeStyle = "rgba(243,241,236,0.07)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + (h * i) / 4);
    ctx.lineTo(x + w, y + (h * i) / 4);
    ctx.stroke();
  }
  // A random walk with drift, as candles on even tiles and a line on odd ones.
  const n = 48;
  const vals: number[] = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.47) * 0.08;
    v = Math.min(0.92, Math.max(0.08, v));
    vals.push(v);
  }
  const px = (i: number) => x + w * 0.06 + ((w * 0.88) / (n - 1)) * i;
  const py = (val: number) => y + h * 0.9 - val * h * 0.78;
  const col = P.accent;
  if (seed % 2 === 0) {
    const cw = (w * 0.88) / n;
    for (let i = 1; i < n; i++) {
      const o = vals[i - 1];
      const c = vals[i];
      const up = c >= o;
      const hi = Math.max(o, c) + rnd() * 0.03;
      const lo = Math.min(o, c) - rnd() * 0.03;
      ctx.strokeStyle = up ? col : "rgba(243,241,236,0.45)";
      ctx.fillStyle = up ? col : P.bg;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px(i), py(hi));
      ctx.lineTo(px(i), py(lo));
      ctx.stroke();
      ctx.fillRect(px(i) - cw * 0.3, py(Math.max(o, c)), cw * 0.6, Math.max(1, py(Math.min(o, c)) - py(Math.max(o, c))));
      if (!up) ctx.strokeRect(px(i) - cw * 0.3, py(Math.max(o, c)), cw * 0.6, Math.max(1, py(Math.min(o, c)) - py(Math.max(o, c))));
    }
  } else {
    ctx.beginPath();
    vals.forEach((val, i) => (i ? ctx.lineTo(px(i), py(val)) : ctx.moveTo(px(i), py(val))));
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineTo(px(n - 1), y + h);
    ctx.lineTo(px(0), y + h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, `hsla(${spectrumHue(t)} 90% 62% / 0.28)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fill();
  }
  // One number, the way a journal would note it.
  const last = vals[n - 1] - vals[0];
  ctx.font = `${Math.round(h * 0.11)}px ${MONO}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = P.com;
  ctx.fillText(seed % 2 === 0 ? "4H" : "1D", x + w * 0.06, y + h * 0.07);
  ctx.textAlign = "right";
  ctx.fillStyle = last >= 0 ? col : "rgba(243,241,236,0.6)";
  ctx.fillText(`${last >= 0 ? "+" : "−"}${(Math.abs(last) * 6).toFixed(1)}%`, x + w * 0.94, y + h * 0.07);
  ctx.restore();
}

/** Trader panes: eight charts, eight journal numbers. */
export function makeTraderAtlas(t: number): THREE.Texture {
  const TW = 512;
  const TH = 256;
  const canvas = document.createElement("canvas");
  canvas.width = TW * ATLAS_N;
  canvas.height = TH * ATLAS_N;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => {
    ctx.fillStyle = "#0b0b11";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < ATLAS_TILES; i++) {
      const x = (i % ATLAS_N) * TW;
      const y = Math.floor(i / ATLAS_N) * TH;
      if (i < 8) drawChart(ctx, x, y, TW, TH, t, i + 3);
      else drawGlyph(ctx, x, y, TW, TH, TICKERS[i - 8], t);
    }
  });
}

/**
 * Square tiles of tool / language logos from public/hub/icons (see scripts/hub-icons.mjs).
 * The texture starts blank and fills in as each SVG arrives.
 */
export function makeIconAtlas(files: string[]): THREE.Texture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S * ATLAS_N;
  canvas.height = S * ATLAS_N;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0b11";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  files.slice(0, ATLAS_TILES).forEach((file, i) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const x = (i % ATLAS_N) * S;
      const y = Math.floor(i / ATLAS_N) * S;
      const pad = S * 0.24;
      const box = S - pad * 2;
      const r = Math.min(box / img.width, box / img.height);
      const w = img.width * r;
      const h = img.height * r;
      ctx.drawImage(img, x + (S - w) / 2, y + (S - h) / 2, w, h);
      tex.needsUpdate = true;
    };
    img.src = `/hub/icons/${file}`;
  });
  return tex;
}

/** The engineer's tools, in the order they appear (max 16 per atlas). */
export const ENGINEER_ICONS = [
  "typescript.svg", "nextdotjs.svg", "react.svg", "nodedotjs.svg",
  "python.svg", "csharp.svg", "dotnet.svg", "java.svg",
  "vscode.svg", "cursor.svg", "claude.svg", "git.svg",
  "docker.svg", "postgresql.svg", "supabase.svg", "threedotjs.svg",
];

/** One 2048 × 1024 atlas of 16 tiles, 512 × 256 each (2:1, like the panes). */
export function makeSlabAtlas(t: number): THREE.Texture {
  const TW = 512;
  const TH = 256;
  const canvas = document.createElement("canvas");
  canvas.width = TW * ATLAS_N;
  canvas.height = TH * ATLAS_N;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => {
    ctx.fillStyle = "#0b0b11";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < ATLAS_TILES; i++) {
      const x = (i % ATLAS_N) * TW;
      const y = Math.floor(i / ATLAS_N) * TH;
      if (i < 8) drawEditor(ctx, x, y, TW, TH, { file: i % FILES.length, from: Math.floor(i / FILES.length) * 9, fontPx: 26, t });
      else drawGlyph(ctx, x, y, TW, TH, GLYPHS[i - 8], t);
    }
  });
}

/** The laptop's screen: a full editor with tabs and a status bar (16:10). */
export function makeLaptopScreen(t: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => drawEditor(ctx, 0, 0, 1280, 800, { file: 0, from: 0, fontPx: 24, t, chrome: true, caret: 12 }));
}

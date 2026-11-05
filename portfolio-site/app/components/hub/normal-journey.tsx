"use client";

/**
 * Normal mode (D38 round D): "the headset stays off" — the same story as a flat,
 * scroll-driven motion piece with no WebGL. A 2D canvas behind the page, drawn
 * in the poster's own 1600×900 space so it takes over from the still poster
 * without a seam:
 *
 *   hero → through   a white ray falls onto the prism; the spectrum fans open
 *   the climb        the view follows the light: it turns through the spectrum
 *                    so each persona's colour comes round in turn and washes the
 *                    sky; that persona's setup draws itself in light (one line
 *                    icon per world: laptop, desk, camera, easel, bike, tower),
 *                    lit while you are on its chapter, and lets go as you move on
 *   the ending       the colour drains; stars only
 *
 * Progress is the page's own section progress (`state.current.c`), the same
 * number the 3D scene climbs with. Reduced motion: it still follows the scroll,
 * only the breathing stops.
 */
import { useEffect, useRef, type MutableRefObject } from "react";
import { spectrumColor } from "@/lib/site/spectrum";
import { BIKE_LINES } from "./bike-lines";
import type { VrState, World } from "./vr/state";

type Props = { state: MutableRefObject<VrState>; worlds: World[]; sectionT: Array<number | null>; /** 0 → 1: the chapter's display is on, the drawing steps back behind it. */ recede?: MutableRefObject<number> };

// The poster's composition (refraction-poster.tsx).
const E = { x: 1034, y: 455 };
const A0 = 16;
const A1 = -40;
const R = 1100;
const WEDGES = 56;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number, a: number, b: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const rad = (deg: number) => (deg * Math.PI) / 180;
const angleOf = (t: number) => rad(A0 + (A1 - A0) * t);

type Pt = [number, number];
type Icon = Pt[][];
const circle = (cx: number, cy: number, r: number, n = 22): Pt[] => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);

/** Line icons in a unit box (y down): each world's setup, as strokes drawn in order. */
const ICONS: Record<string, Icon> = {
  engineer: [
    [[0.12, 0.74], [0.88, 0.74], [0.8, 0.82], [0.2, 0.82], [0.12, 0.74]],
    [[0.2, 0.72], [0.22, 0.22], [0.78, 0.22], [0.8, 0.72]],
    [[0.3, 0.34], [0.5, 0.34]],
    [[0.3, 0.42], [0.62, 0.42]],
    [[0.34, 0.5], [0.56, 0.5]],
    [[0.3, 0.58], [0.46, 0.58]],
  ],
  trader: [
    [[0.08, 0.84], [0.92, 0.84]],
    [[0.46, 0.84], [0.46, 0.7], [0.54, 0.7], [0.54, 0.84]],
    [[0.14, 0.7], [0.14, 0.2], [0.86, 0.2], [0.86, 0.7], [0.14, 0.7]],
    [[0.26, 0.6], [0.26, 0.44]],
    [[0.38, 0.56], [0.38, 0.36]],
    [[0.5, 0.52], [0.5, 0.3]],
    [[0.62, 0.46], [0.62, 0.26]],
    [[0.2, 0.62], [0.74, 0.3], [0.8, 0.3]],
  ],
  photographer: [
    [[0.14, 0.72], [0.14, 0.34], [0.32, 0.34], [0.38, 0.24], [0.62, 0.24], [0.68, 0.34], [0.86, 0.34], [0.86, 0.72], [0.14, 0.72]],
    circle(0.5, 0.53, 0.15),
    circle(0.5, 0.53, 0.07),
    [[0.72, 0.42], [0.78, 0.42]],
    [[0.22, 0.34], [0.22, 0.28], [0.3, 0.28]],
  ],
  artist: [
    // Easel, canvas, and on it a landscape: hills, a horizon, the sun, one cloud — and the brush.
    [[0.28, 0.96], [0.5, 0.16], [0.72, 0.96]],
    [[0.5, 0.74], [0.5, 0.96]],
    [[0.3, 0.74], [0.7, 0.74]],
    [[0.18, 0.26], [0.82, 0.26], [0.82, 0.7], [0.18, 0.7], [0.18, 0.26]],
    [[0.18, 0.58], [0.82, 0.58]],
    [[0.18, 0.58], [0.3, 0.44], [0.4, 0.52], [0.52, 0.36], [0.64, 0.5], [0.72, 0.44], [0.82, 0.54]],
    circle(0.68, 0.37, 0.045, 14),
    [[0.26, 0.34], [0.3, 0.31], [0.36, 0.32], [0.38, 0.35], [0.26, 0.35]],
    [[0.22, 0.64], [0.3, 0.63], [0.4, 0.65], [0.5, 0.63]],
    [[0.86, 0.82], [0.95, 0.48]],
    [[0.95, 0.48], [0.98, 0.42]],
  ],
  // The bike: traced from the real model (bike-lines.ts), so both modes show the same machine.
  ride: BIKE_LINES as unknown as Icon,
  gamer: [
    // A gamer's screen: the monitor, a crosshair, the rifle in first person, health and ammo.
    [[0.08, 0.16], [0.92, 0.16], [0.92, 0.7], [0.08, 0.7], [0.08, 0.16]],
    [[0.5, 0.7], [0.5, 0.82]],
    [[0.34, 0.84], [0.66, 0.84]],
    circle(0.5, 0.42, 0.085, 18),
    [[0.5, 0.26], [0.5, 0.35]],
    [[0.5, 0.49], [0.5, 0.58]],
    [[0.34, 0.42], [0.43, 0.42]],
    [[0.57, 0.42], [0.66, 0.42]],
    circle(0.5, 0.42, 0.012, 8),
    [[0.92, 0.7], [0.86, 0.7], [0.78, 0.62], [0.66, 0.54], [0.62, 0.5], [0.66, 0.47], [0.72, 0.52], [0.8, 0.58], [0.9, 0.6]],
    [[0.62, 0.5], [0.6, 0.45]],
    [[0.72, 0.52], [0.73, 0.47]],
    [[0.14, 0.62], [0.34, 0.62]],
    [[0.14, 0.6], [0.14, 0.64]],
    [[0.74, 0.66], [0.84, 0.66]],
  ],
};

const iconLength = (icon: Icon) => icon.reduce((n, poly) => n + poly.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - poly[i][0], p[1] - poly[i][1]), 0), 0);
const ICON_LENGTH: Record<string, number> = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, iconLength(v)]));

/** Strokes an icon up to `progress` (0…1) of its total length; returns where the pen is (null when finished). */
function strokeIcon(ctx: CanvasRenderingContext2D, icon: Icon, total: number, progress: number): Pt | null {
  let budget = total * progress;
  let pen: Pt | null = null;
  for (const poly of icon) {
    if (budget <= 0) break;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1];
      const [bx, by] = poly[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (budget >= len) {
        ctx.lineTo(bx, by);
        budget -= len;
        pen = [bx, by];
      } else {
        const u = budget / len;
        pen = [ax + (bx - ax) * u, ay + (by - ay) * u];
        ctx.lineTo(pen[0], pen[1]);
        budget = 0;
        break;
      }
    }
    ctx.stroke();
  }
  return progress < 0.999 ? pen : null;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function NormalJourney({ state, worlds, sectionT, recede }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rnd = seeded(7);
    const stars = Array.from({ length: 170 }, () => ({ x: rnd() * 1600, y: rnd() * 900, r: 0.6 + rnd() * 1.3, z: 0.3 + rnd() * 0.7, p: rnd() * Math.PI * 2 }));
    const panes = Array.from({ length: 22 }, () => ({ x: rnd(), y: rnd(), w: 60 + rnd() * 120, h: 36 + rnd() * 70, z: 0.4 + rnd() * 0.6, p: rnd() * Math.PI * 2 }));
    const lastC = worlds.length ? worlds[worlds.length - 1].c : 0;
    const endC = sectionT.length - 1;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let live = 0; // smoothed c
    let back = 0; // smoothed recede
    let raf = 0;
    let last = performance.now();
    let on = true;

    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = el.clientWidth;
      H = el.clientHeight;
      el.width = Math.round(W * dpr);
      el.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const vis = () => {
      on = document.visibilityState !== "hidden";
      if (on && !raf) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", vis);

    /** Where on the spectrum the light points at progress c (between the worlds it passes). */
    const focusT = (c: number) => {
      if (!worlds.length) return 0.5;
      if (c <= worlds[0].c) return worlds[0].t;
      for (let i = 0; i < worlds.length - 1; i++) {
        const a = worlds[i];
        const b = worlds[i + 1];
        if (c < b.c) return a.t + (b.t - a.t) * easeInOut(clamp01((c - a.c) / (b.c - a.c)));
      }
      return worlds[worlds.length - 1].t;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = state.current.c;
      live += (target - live) * (1 - Math.exp(-dt * 4));
      back += ((recede?.current ?? 0) - back) * (1 - Math.exp(-dt * 3));
      const c = live;
      const t = reduce ? 0 : now / 1000;

      // Fit the 1600×900 stage like the poster's "slice".
      const s = Math.max(W / 1600, H / 900);
      const ox = (W - 1600 * s) / 2;
      const oy = (H - 900 * s) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, W, H);
      ctx.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);

      const follow = easeInOut(clamp01((c - 0.45) / 1.1)); // 0 at the hero, 1 by the first chapter
      const ending = smooth(c, lastC + 0.45, Math.max(lastC + 0.5, endC - 0.05));
      const tF = focusT(c);
      // Strongest world right now.
      let world: World | null = null;
      let near = 0;
      for (const w of worlds) {
        const n = 1 - clamp01(Math.abs(c - w.c) / 0.5);
        if (n > near) {
          near = n;
          world = w;
        }
      }
      const washColor = world ? spectrumColor(world.t, 56) : "#fff";

      // ---- Stars (parallax with the climb) ----
      for (const st of stars) {
        const y = (((st.y - c * 90 * st.z) % 900) + 900) % 900;
        const tw = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 0.8 + st.p);
        ctx.globalAlpha = (0.35 + 0.45 * st.z) * tw;
        ctx.fillStyle = "#e8e2d6";
        ctx.beginPath();
        ctx.arc(st.x, y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ---- The colour wash of the current world ----
      if (world && near > 0) {
        const g = ctx.createRadialGradient(E.x + 260, E.y - 40, 40, E.x + 260, E.y - 40, 1050);
        g.addColorStop(0, washColor);
        g.addColorStop(1, "rgba(7,7,10,0)");
        ctx.globalAlpha = 0.34 * Math.pow(near, 1.3) * (1 - ending);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1600, 900);
        ctx.globalAlpha = 1;
      }

      // ---- Panes drifting past while the light is followed ----
      const drift = follow * (1 - ending);
      if (drift > 0.01) {
        ctx.lineWidth = 1;
        for (const p of panes) {
          const x = ((((p.x * 1600 - c * 140 * p.z) % 1600) + 1600) % 1600) - 100;
          const y = ((((p.y * 900 - c * 60 * p.z + Math.sin(t * 0.25 + p.p) * 14) % 900) + 900) % 900) - 50;
          ctx.globalAlpha = 0.16 * p.z * drift;
          ctx.strokeStyle = washColor;
          ctx.strokeRect(x, y, p.w * p.z, p.h * p.z);
          ctx.globalAlpha = 0.04 * p.z * drift;
          ctx.fillStyle = washColor;
          ctx.fillRect(x, y, p.w * p.z, p.h * p.z);
        }
        ctx.globalAlpha = 1;
      }

      // ---- The light: ray, prism, spectrum — the view turns to follow the light ----
      ctx.save();
      const breathe = reduce ? 1 : 1 + Math.sin(t * 0.35) * 0.012;
      const zoom = (1.18 - 0.18 * follow + follow * 1.1) * breathe;
      const ex = E.x - follow * 420;
      const ey = E.y + follow * 40;
      ctx.translate(ex, ey);
      ctx.rotate(-angleOf(tF) * follow);
      ctx.scale(zoom, zoom);
      ctx.translate(-E.x, -E.y);
      const spread = 0.35 + 0.65 * easeInOut(clamp01(c / 0.9));
      const fanAlpha = (1 - ending) * (0.85 + 0.15 * follow);
      // ---- The fan, as light: additive wedges fading out along their length, soft at the edges,
      //      and a glow at the apex. The lit world's band burns brighter and wider.
      ctx.globalCompositeOperation = "lighter";
      const litT = world ? world.t : -1;
      for (let i = 0; i < WEDGES; i++) {
        const t0 = i / WEDGES;
        const t1 = (i + 1) / WEDGES;
        const mid = (t0 + t1) / 2;
        const a0 = angleOf(0.5 + (t0 - 0.5) * spread) + 0.004;
        const a1 = angleOf(0.5 + (t1 - 0.5) * spread) - 0.004;
        const edge = Math.min(1, Math.min(t0, 1 - t1) * 10 + 0.12);
        let lit = 0;
        if (world) {
          const dd = (mid - litT) / 0.05;
          lit = near * Math.exp(-dd * dd);
        }
        const g = ctx.createRadialGradient(E.x, E.y, 0, E.x, E.y, R);
        const col = spectrumColor(mid, lit > 0.3 ? 60 : 52);
        g.addColorStop(0, col);
        g.addColorStop(0.08, col);
        g.addColorStop(0.55, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = (0.075 * edge + 0.38 * lit) * fanAlpha;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(E.x, E.y);
        ctx.lineTo(E.x + Math.cos(a0) * R, E.y - Math.sin(a0) * R);
        ctx.lineTo(E.x + Math.cos(a1) * R, E.y - Math.sin(a1) * R);
        ctx.closePath();
        ctx.fill();
      }
      // The apex: where white becomes colour.
      {
        const g = ctx.createRadialGradient(E.x, E.y, 0, E.x, E.y, 140);
        g.addColorStop(0, "rgba(255,255,255,0.9)");
        g.addColorStop(0.18, "rgba(255,255,255,0.35)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = (0.55 + 0.25 * Math.sin(t * 0.9)) * fanAlpha;
        ctx.fillStyle = g;
        ctx.fillRect(E.x - 140, E.y - 140, 280, 280);
      }
      // The lit band's field: a wide soft beam along the world's direction, the stage the display stands on.
      if (world && near > 0.01) {
        const a = angleOf(0.5 + (world.t - 0.5) * spread);
        ctx.save();
        ctx.translate(E.x, E.y);
        ctx.rotate(-a);
        const g = ctx.createLinearGradient(0, -260, 0, 260);
        const colA = spectrumColor(world.t, 58);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, colA);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.16 * near * (1 - ending);
        ctx.fillStyle = g;
        ctx.fillRect(0, -260, R, 520);
        ctx.restore();
      }
      // Motes streaming out along the fan while the view follows: light in motion, not a still fan.
      if (follow > 0.02 && !reduce) {
        ctx.lineCap = "round";
        for (let i = 0; i < 70; i++) {
          const bandT = 0.5 + (((i * 0.618) % 1) - 0.5) * spread * 0.98;
          const a = angleOf(bandT);
          const speed = 0.09 + (i % 5) * 0.025;
          const ph = (t * speed + i * 0.173) % 1;
          const r0 = 60 + ph * (R - 60);
          const len = 18 + 120 * ph * ph;
          const nearBand = world ? Math.exp(-Math.pow((bandT - world.t) / 0.07, 2)) : 0;
          const alpha = Math.sin(ph * Math.PI) * (0.18 + 0.5 * nearBand) * follow * fanAlpha;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = spectrumColor(bandT, 76);
          ctx.lineWidth = 0.8 + 1.6 * nearBand;
          ctx.beginPath();
          ctx.moveTo(E.x + Math.cos(a) * r0, E.y - Math.sin(a) * r0);
          ctx.lineTo(E.x + Math.cos(a) * (r0 + len), E.y - Math.sin(a) * (r0 + len));
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      // Persona bands: fine lines of each world's colour; the one you are at burns.
      ctx.globalCompositeOperation = "lighter";
      for (const w of worlds) {
        const a = angleOf(0.5 + (w.t - 0.5) * spread);
        const n = 1 - clamp01(Math.abs(c - w.c) / 0.5);
        ctx.globalAlpha = (0.22 + 0.6 * n) * fanAlpha;
        ctx.strokeStyle = spectrumColor(w.t, 70);
        ctx.lineWidth = 1 + 3.5 * n;
        ctx.beginPath();
        ctx.moveTo(E.x, E.y);
        ctx.lineTo(E.x + Math.cos(a) * R, E.y - Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      // The ray in, the prism.
      const prismAlpha = (1 - follow * 0.8) * (1 - ending);
      if (prismAlpha > 0.01) {
        const beam = ctx.createLinearGradient(380, 0, 910, 440);
        beam.addColorStop(0, "rgba(255,255,255,0)");
        beam.addColorStop(1, "rgba(255,255,255,1)");
        ctx.globalAlpha = prismAlpha;
        ctx.strokeStyle = beam;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(380, 0);
        ctx.lineTo(910, 440);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(910, 440);
        ctx.lineTo(E.x, E.y);
        ctx.stroke();
        ctx.fillStyle = "rgba(243,241,236,0.05)";
        ctx.strokeStyle = "rgba(243,241,236,0.55)";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(968, 330);
        ctx.lineTo(1060, 505);
        ctx.lineTo(876, 505);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // ---- The world's setup, drawn in light ----
      if (world && near > 0.02 && ending < 0.98) {
        const portrait = W / Math.max(1, H) < 1;
        const cx = portrait ? 800 : 1180;
        const cy = portrait ? 300 : 450;
        const size = (portrait ? 340 : 440) * (0.7 + 0.3 * near);
        const progress = easeInOut(clamp01((near - 0.15) / 0.65));
        const litNow = smooth(near, 0.8, 1);
        ctx.save();
        ctx.translate(cx - size / 2, cy - size / 2 + (1 - near) * 60 * (c < world.c ? 1 : -1));
        ctx.scale(size, size);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.2 / size;
        ctx.strokeStyle = spectrumColor(world.t, 72);
        // Under the display the drawing steps back: fainter, a touch smaller, no glow — a blueprint.
        ctx.globalAlpha = (0.35 + 0.65 * near) * (1 - ending) * (1 - back * 0.82);
        if (back > 0.01) {
          ctx.translate(0.5, 0.5);
          ctx.scale(1 - back * 0.08, 1 - back * 0.08);
          ctx.translate(-0.5, -0.5);
        }
        if (litNow > 0 && back < 0.5) {
          ctx.shadowColor = spectrumColor(world.t, 60);
          ctx.shadowBlur = 18 * litNow * s;
        }
        const pen = strokeIcon(ctx, ICONS[world.slug] ?? ICONS.engineer, ICON_LENGTH[world.slug] ?? ICON_LENGTH.engineer, progress);
        ctx.shadowBlur = 0;
        // The light that draws: a bright point at the head of the stroke, with a soft halo.
        if (pen && progress > 0.01) {
          const halo = ctx.createRadialGradient(pen[0], pen[1], 0, pen[0], pen[1], 0.09);
          halo.addColorStop(0, spectrumColor(world.t, 80));
          halo.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = 0.55 * (1 - ending);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(pen[0], pen[1], 0.09, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1 - ending;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(pen[0], pen[1], 0.009, 0, Math.PI * 2);
          ctx.fill();
        }
        // Lit: motes of its colour rise off the setup; a faint glow sits under it.
        if (litNow > 0.01 && back < 0.6) {
          const under = ctx.createRadialGradient(0.5, 0.62, 0, 0.5, 0.62, 0.7);
          under.addColorStop(0, spectrumColor(world.t, 58));
          under.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = 0.18 * litNow * (1 - ending);
          ctx.fillStyle = under;
          ctx.fillRect(-0.3, -0.3, 1.6, 1.6);
          ctx.fillStyle = spectrumColor(world.t, 78);
          for (let i = 0; i < 14; i++) {
            const ph = (t * (0.08 + (i % 5) * 0.015) + i * 0.37) % 1;
            const x = 0.1 + ((i * 0.618) % 1) * 0.8 + Math.sin(t * 0.7 + i) * 0.03;
            const y = 0.95 - ph * 1.1;
            ctx.globalAlpha = litNow * (1 - ending) * Math.sin(ph * Math.PI) * 0.8;
            ctx.beginPath();
            ctx.arc(x, y, 0.006 + (i % 3) * 0.003, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      if (on && !reduce) raf = requestAnimationFrame(frame);
      else if (on) {
        // Reduced motion: redraw only when the scroll moves.
        raf = requestAnimationFrame((n) => {
          if (Math.abs(state.current.c - live) > 0.002) frame(n);
          else raf = requestAnimationFrame(frame);
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [state, worlds, sectionT, recede]);

  return <canvas ref={canvas} aria-hidden className="normal-journey absolute inset-0 h-full w-full" />;
}

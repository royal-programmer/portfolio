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
import { CONSTELLATIONS, strokeObject, strokesLength } from "./constellations";
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



/**
 * Phones: the eight drawn things of a world, composed for the band above the chapter's words. Same
 * order as every world's list (hero, top-left, top-right, right, right-low, left, bottom-left,
 * bottom-right); the hero stands in the middle, the rest around it, balanced left and right.
 * Units: fractions of the band's width, y down.
 */
const PHONE_PLACES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: -0.33, y: -0.3 },
  { x: 0.31, y: -0.31 },
  { x: 0.41, y: 0.03 },
  { x: 0.33, y: 0.31 },
  { x: -0.41, y: 0.03 },
  { x: -0.3, y: 0.32 },
  { x: 0.03, y: 0.37 },
];
/** The band's height as a fraction of its width that the composition above needs. */
const PHONE_BAND_RATIO = 0.92;

/** Strokes in a unit box (y down), drawn in order. */
const CONSTELLATION_LENGTH: Record<string, number[]> = Object.fromEntries(Object.entries(CONSTELLATIONS).map(([k, objs]) => [k, objs.map((o) => strokesLength(o.strokes))]));

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

      // ---- The world's constellation: its things draw themselves around the display as the chapter
      //      arrives (complete at its midpoint), and undraw in reverse as it goes. They drift in from the
      //      light's direction and settle; depth gives parallax. The display's place is read off the
      //      same CSS the DOM uses (normal-display), so the ring always fits around it.
      if (world && near > 0.02 && ending < 0.98) {
        const portrait = W / Math.max(1, H) < 1;
        const objs = CONSTELLATIONS[world.slug] ?? [];
        // Display centre and width, in stage units.
        let dcx: number, dcy: number, dw: number;
        // Phones (Round H): the drawings have their own band above the words, so they gather there
        // in a composition of their own (PHONE_PLACES) instead of ringing the display. Where there
        // is no band (desktop, a phone on its side) the ring goes around the display, measured
        // off the DOM: the in-flow slot on tablets and sideways phones, the fixed window on desktop.
        const band = W < 1024 ? (document.getElementById(`${world.slug}-art`) as HTMLElement | null) : null;
        const bandRect = band?.getBoundingClientRect();
        const inBand = !!bandRect && bandRect.width > 0 && bandRect.height > 0;
        if (inBand) {
          dw = Math.min(bandRect.width, bandRect.height / PHONE_BAND_RATIO) / s;
          dcx = (bandRect.left + bandRect.width / 2 - ox) / s;
          dcy = (bandRect.top + bandRect.height / 2 - oy) / s;
        } else {
          const slotEl = (W < 1024 ? document.getElementById(`${world.slug}-display`) : document.querySelector(".normal-display-frame")) as HTMLElement | null;
          const rect = slotEl?.getBoundingClientRect();
          if (rect && rect.width > 0) {
            dw = rect.width / s;
            dcx = (rect.left + rect.width / 2 - ox) / s;
            dcy = (rect.top + rect.height / 2 - oy) / s;
          } else if (portrait) {
            dw = (0.92 * W) / s;
            dcx = (0.5 * W - ox) / s;
            dcy = (0.09 * H + 0.92 * W * (680 / 1100) * 0.5 - oy) / s;
          } else {
            dw = (Math.min(0.44 * W, 720)) / s;
            dcx = (W - 0.085 * W - dw * s * 0.5 - ox) / s;
            dcy = (0.5 * H - oy) / s;
          }
        }
        // Chapter progress 0 → 1 across the chapter; drawn fully at the midpoint. In the phone band
        // the drawing follows the band itself: it draws as the band rises into view and undraws as
        // the band leaves at the top, so it is whole while it is on screen.
        let draw: number;
        if (inBand) {
          const arrive = clamp01((H - bandRect.top) / (0.55 * H));
          const leave = clamp01((bandRect.bottom + 0.1 * H) / (0.45 * H));
          draw = easeInOut(Math.min(arrive, leave));
        } else {
          const u = clamp01((c - (world.c - 0.5)) / 1);
          draw = easeInOut(u < 0.5 ? u / 0.5 : (1 - u) / 0.5);
        }
        const lit = spectrumColor(world.t, 72);
        const bright = spectrumColor(world.t, 84);
        for (let i = 0; i < objs.length; i++) {
          const o = objs[i];
          const ring = !inBand && portrait;
          if (ring && (o.place.y > 0.45 || o.place.y < -0.5)) continue; // sideways phone: nothing under the display (the words) or far above it
          const home = inBand ? (PHONE_PLACES[i] ?? o.place) : o.place;
          const px = ring ? o.place.x * 0.8 : home.x;
          const py = ring ? o.place.y * 0.9 : home.y;
          const size = o.place.size * dw * (0.82 + 0.18 * o.place.depth) * (inBand ? 1.08 : 1);
          // Each object draws on its own slice of the chapter, staggered by its index, so the ring
          // grows outward rather than all at once; the undraw mirrors it.
          const lag = (i / Math.max(1, objs.length)) * 0.35;
          const own = clamp01((draw - lag) / (1 - lag));
          if (own <= 0.001) continue;
          // Home around the display: each object is drawn in place, from its own first point,
          // with nothing sliding in; depth gives a little parallax against the scroll.
          const hx = dcx + px * dw;
          const hy = dcy + py * dw + (inBand ? 0 : (c - world.c) * 120 * (1 - o.place.depth));
          ctx.save();
          ctx.translate(hx - size / 2, hy - size / 2);
          ctx.scale(size, size);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = (1.2 + 0.9 * o.place.depth) / size;
          ctx.strokeStyle = lit;
          ctx.globalAlpha = (0.3 + 0.7 * o.place.depth) * (1 - ending) * Math.min(1, own * 3);
          if (own > 0.98 && o.place.depth > 0.6) {
            ctx.shadowColor = spectrumColor(world.t, 60);
            ctx.shadowBlur = 10 * s;
          }
          const total = CONSTELLATION_LENGTH[world.slug]?.[i] ?? 1;
          const pen = strokeObject(ctx, o.strokes, total, own);
          ctx.shadowBlur = 0;
          if (pen) {
            // The light that draws: a point at the head of the stroke.
            ctx.globalAlpha = 1 - ending;
            ctx.fillStyle = bright;
            ctx.beginPath();
            ctx.arc(pen[0], pen[1], 0.012, 0, Math.PI * 2);
            ctx.fill();
            const halo = ctx.createRadialGradient(pen[0], pen[1], 0, pen[0], pen[1], 0.08);
            halo.addColorStop(0, spectrumColor(world.t, 78));
            halo.addColorStop(1, "rgba(255,255,255,0)");
            ctx.globalAlpha = 0.5 * (1 - ending);
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(pen[0], pen[1], 0.08, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        void back;
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

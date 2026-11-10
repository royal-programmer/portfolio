"use client";

/**
 * The world page's hero: the thing that stands for this world. Immersive mode gets the hub's 3D
 * setup, alive on its own stage; Normal mode gets the same object as the hub's line drawing,
 * drawing itself in. Everything under it is the same page in both modes.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { BlogPost, Entry } from "@/lib/content";
import type { PersonaSlug } from "@/lib/content/types";
import { StageSilhouette } from "./stage/silhouette";
import { STAGE_PROPS } from "@/lib/site/stage-data";
import { spectrumColor } from "@/lib/site/spectrum";
import { useExperience } from "../experience-provider";
import { CONSTELLATIONS, strokeObject, strokesLength } from "./hub/constellations";

const WorldStage3D = dynamic(() => import("./world-stage-3d"), { ssr: false });

/** The line drawing: the world's hero object strokes itself in, a light at the pen. */
function StageLines({ slug, t }: { slug: PersonaSlug; t: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const obj = CONSTELLATIONS[slug]?.[0];
    if (!obj) return;
    const total = strokesLength(obj.strokes);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lit = spectrumColor(t, 72);
    const bright = spectrumColor(t, 86);
    const glow = spectrumColor(t, 60);
    let raf = 0;
    let start = 0;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    });
    ro.observe(canvas);
    const frame = (now: number) => {
      if (!start) start = now;
      const sec = (now - start) / 1000;
      const progress = reduce ? 1 : Math.min(1, sec / 2.2);
      const eased = progress < 1 ? 1 - Math.pow(1 - progress, 2.2) : 1;
      px += (tx - px) * 0.08;
      py += (ty - py) * 0.08;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const size = Math.min(W * 0.62, H * 0.86);
      const cx = W / 2 + px * W * 0.02;
      const cy = H / 2 + py * H * 0.02;
      ctx.save();
      ctx.translate(cx - size / 2, cy - size / 2);
      ctx.scale(size, size);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.6 * (W / Math.max(1, canvas.clientWidth)) / size;
      ctx.strokeStyle = lit;
      ctx.shadowColor = glow;
      ctx.shadowBlur = (eased >= 1 ? 14 + 4 * Math.sin(sec * 1.4) : 8) * (W / Math.max(1, canvas.clientWidth));
      const pen = strokeObject(ctx, obj.strokes, total, eased);
      ctx.shadowBlur = 0;
      if (pen) {
        ctx.fillStyle = bright;
        ctx.beginPath();
        ctx.arc(pen[0], pen[1], 0.012, 0, Math.PI * 2);
        ctx.fill();
        const halo = ctx.createRadialGradient(pen[0], pen[1], 0, pen[0], pen[1], 0.09);
        halo.addColorStop(0, spectrumColor(t, 78));
        halo.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(pen[0], pen[1], 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (!reduce || progress < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [slug, t]);
  return <canvas ref={ref} aria-hidden className="h-full w-full" />;
}

export function WorldStage({ slug, t, entries, posts }: { slug: PersonaSlug; t: number; entries?: Entry[]; posts?: BlogPost[] }) {
  const { experience, ready } = useExperience();
  const c = spectrumColor(t, 60);
  const [framed, setFramed] = useState(false);
  const props = ready && experience === "immersive" && slug === "engineer";
  const send = (name: string, detail: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));
  return (
    <>
      <div
        className="world-stage relative h-[46svh] min-h-[260px] w-full overflow-hidden rounded-3xl border"
        style={{
          borderColor: "var(--surface-border)",
          background: `radial-gradient(ellipse at 50% 60%, color-mix(in srgb, ${c} 18%, #07070a), #07070a 72%)`,
          boxShadow: `0 30px 80px -30px color-mix(in srgb, ${c} 45%, transparent), var(--panel-shadow)`,
        }}
        aria-hidden
      >
        {/* Server-rendered first paint: the desk's outline, until the first WebGL frame (or the line drawing) takes over. */}
        {slug === "engineer" ? <StageSilhouette color={c} gone={framed || (ready && experience !== "immersive")} /> : null}
        {!ready ? null : experience === "immersive" ? <WorldStage3D slug={slug} t={t} entries={entries} posts={posts} onFirstFrame={() => setFramed(true)} /> : <StageLines slug={slug} t={t} />}
      </div>
      {/* The desk's props as text buttons, so keyboard and screen-reader users reach them; focus lights the prop. */}
      {props ? (
        <div className="stage-hud" style={{ ["--stage-c" as string]: c }} role="group" aria-label="On the desk: run a command">
          {STAGE_PROPS.map((p, i) => (
            <span key={p.id} className="inline-flex items-center">
              {i ? (
                <span aria-hidden className="mr-2.5">
                  ·
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => send("stage:run", p.id)}
                onFocus={() => send("stage:focus", p.id)}
                onBlur={() => send("stage:focus", null)}
                onPointerEnter={() => send("stage:focus", p.id)}
                onPointerLeave={() => send("stage:focus", null)}
              >
                {p.label}
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

"use client";

/**
 * The world page's hero: the thing that stands for this world. Immersive mode gets the hub's 3D
 * setup, alive on its own stage; Normal mode gets the same object as the hub's line drawing,
 * drawing itself in. Everything under it is the same page in both modes.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BlogPost, Entry } from "@/lib/content";
import type { PersonaSlug } from "@/lib/content/types";
import { StageSilhouette } from "./stage/silhouette";
import { StoryPanel, StoryRail } from "./stage/story";
import type { StoryState } from "./world-stage-3d";
import { shelfFromEntries, STAGE_PROPS, STAGE_STOPS, STAGE_TRAVEL } from "@/lib/site/stage-data";
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

/** Is the scroll story allowed here? Not with reduced motion, nor when the visitor asked to save data. */
function storyAllowed() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true || window.matchMedia("(prefers-reduced-data: reduce)").matches;
  return !reduce && !saveData;
}

export function WorldStage({ slug, t, entries, posts }: { slug: PersonaSlug; t: number; entries?: Entry[]; posts?: BlogPost[] }) {
  const { experience, ready } = useExperience();
  const c = spectrumColor(t, 60);
  const [framed, setFramed] = useState(false);
  const props = ready && experience === "immersive" && slug === "engineer";
  const cases = shelfFromEntries(entries);
  const send = (name: string, detail: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));

  // The scroll story: a tall container with the stage stuck to the top; the page's scroll position becomes the camera's stop.
  const [story, setStory] = useState(false);
  useEffect(() => {
    if (!props) return;
    const ok = () => queueMicrotask(() => setStory(storyAllowed()));
    ok();
    const mqs = [window.matchMedia("(prefers-reduced-motion: reduce)"), window.matchMedia("(prefers-reduced-data: reduce)")];
    mqs.forEach((m) => m.addEventListener("change", ok));
    return () => mqs.forEach((m) => m.removeEventListener("change", ok));
  }, [props]);
  const state = useRef<StoryState>({ p: 0, on: false });
  const wrap = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const panels = useRef<Array<HTMLDivElement | null>>([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const live = props && story;
  useEffect(() => {
    state.current.on = Boolean(live);
    if (!live) {
      state.current.p = 0;
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const w = wrap.current;
      const st = stick.current;
      if (!w || !st) return;
      const r = w.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(st).top) || 0;
      const range = Math.max(1, r.height - st.offsetHeight);
      const p = Math.min(1, Math.max(0, (top - r.top) / range)) * (STAGE_STOPS.length - 1);
      state.current.p = p;
      const inView = r.bottom > 0 && r.top < window.innerHeight;
      if (rail.current) {
        rail.current.style.opacity = inView ? "1" : "0";
        rail.current.style.pointerEvents = inView ? "auto" : "none";
      }
      // Each panel is fully there at its own stop and gone a stop away.
      panels.current.forEach((el, k) => {
        if (!el) return;
        const stop = k + 1;
        const wgt = Math.min(1, Math.max(0, 1 - Math.abs(p - stop) * 1.7));
        el.style.opacity = String(wgt);
        el.style.transform = `translateY(${(1 - wgt) * 14 * (p < stop ? 1 : -1)}px)`;
        el.style.pointerEvents = wgt > 0.5 ? "auto" : "none";
        el.style.visibility = wgt > 0.01 ? "visible" : "hidden";
      });
      const idx = Math.round(p);
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [live]);
  const goStop = useCallback((i: number) => {
    const w = wrap.current;
    const st = stick.current;
    if (!w || !st) return;
    const top = parseFloat(getComputedStyle(st).top) || 0;
    const range = Math.max(1, w.offsetHeight - st.offsetHeight);
    const y = w.getBoundingClientRect().top + window.scrollY + (i / (STAGE_STOPS.length - 1)) * range - top;
    window.scrollTo({ top: y, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);

  const box = (
    <div
      className={`world-stage relative w-full overflow-hidden rounded-3xl border ${live ? "stage-story-box" : "h-[46svh] min-h-[260px]"}`}
      style={{
        borderColor: "var(--surface-border)",
        background: `radial-gradient(ellipse at 50% 60%, color-mix(in srgb, ${c} 18%, #07070a), #07070a 72%)`,
        boxShadow: `0 30px 80px -30px color-mix(in srgb, ${c} 45%, transparent), var(--panel-shadow)`,
      }}
      aria-hidden
    >
      {/* Server-rendered first paint: the desk's outline, until the first WebGL frame (or the line drawing) takes over. */}
      {slug === "engineer" ? <StageSilhouette color={c} gone={framed || (ready && experience !== "immersive")} /> : null}
      {!ready ? null : experience === "immersive" ? <WorldStage3D slug={slug} t={t} entries={entries} posts={posts} story={state} onFirstFrame={() => setFramed(true)} /> : <StageLines slug={slug} t={t} />}
    </div>
  );
  // The desk's props as text buttons, so keyboard and screen-reader users reach them; focus lights the prop.
  const hud = props ? (
    <div className="stage-hud" style={{ ["--stage-c" as string]: c }} role="group" aria-label="On the desk: run a command; on the shelf: open a project">
      {STAGE_PROPS.map((p, i) => (
        <span key={p.id} className="inline-flex items-center">
          {i ? (
            <span aria-hidden className="mr-2.5">
              ·
            </span>
          ) : null}
          <button type="button" onClick={() => send("stage:run", p.id)} onFocus={() => send("stage:focus", p.id)} onBlur={() => send("stage:focus", null)} onPointerEnter={() => send("stage:focus", p.id)} onPointerLeave={() => send("stage:focus", null)}>
            {p.label}
          </button>
        </span>
      ))}
      {/* The project shelf's cases, as buttons: focus pulls the case out, Enter opens the project. */}
      <span aria-hidden className="mx-2.5">
        |
      </span>
      {cases.map((cs, i) => (
        <span key={cs.id} className="inline-flex items-center">
          {i ? (
            <span aria-hidden className="mr-2.5">
              ·
            </span>
          ) : null}
          <button type="button" onClick={() => send("stage:case", cs.id)} onFocus={() => send("stage:casefocus", cs.id)} onBlur={() => send("stage:casefocus", null)} onPointerEnter={() => send("stage:casefocus", cs.id)} onPointerLeave={() => send("stage:casefocus", null)}>
            {cs.title.toLowerCase()}
          </button>
        </span>
      ))}
    </div>
  ) : null;

  if (live) {
    return (
      <>
        <div ref={wrap} className="stage-story" style={{ ["--travel-d" as string]: STAGE_TRAVEL.desktop, ["--travel-p" as string]: STAGE_TRAVEL.phone, ["--stage-c" as string]: c }}>
          <div ref={stick} className="stage-story-stick">
            <div className="relative">
              {box}
              {/* Words beside the stops, over the stage; the page fades them with the scroll. */}
              <div className="stage-story-words">
                {([1, 2, 3] as const).map((k) => (
                  <StoryPanel key={k} stop={k} ref={(el) => void (panels.current[k - 1] = el)} />
                ))}
              </div>
            </div>
            {hud}
          </div>
        </div>
        <StoryRail ref={rail} active={active} color={c} onGo={goStop} />
      </>
    );
  }
  return (
    <>
      {box}
      {hud}
      {/* No camera travel (reduced motion, data saver): the three panels simply stack under the desk. */}
      {props ? (
        <div className="stage-static" style={{ ["--stage-c" as string]: c }}>
          {([1, 2, 3] as const).map((k) => (
            <StoryPanel key={k} stop={k} static />
          ))}
        </div>
      ) : null}
    </>
  );
}

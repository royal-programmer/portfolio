"use client";

/**
 * The hub (D38): the VR journey.
 *
 *   gate      a headset floats in the dark; device analysed, quality suggested
 *   wear      click it → it comes up to your face · blink · the night sky
 *   sky       one point of light far ahead · Press Space
 *   approach  the light comes at you, slow then fast (hold to slow time)
 *   impact    you are the prism · white
 *   split     the camera rides the J; the light opens into a cone of colour
 *   climb     scroll: spiral up through the cone (rounds B–D fill the worlds)
 *
 * HTML owns all content (screen readers, no-JS and Normal mode get the whole
 * story). Scroll is smoothed by Lenis; text is choreographed with GSAP.
 */
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import type { PersonaSlug } from "@/lib/content/types";
import { ambient } from "@/lib/site/ambient-sound";
import { DISPLAY_ROOT, HUB_COPY, personaIdentity } from "@/lib/site/brand";
import { analyseDevice, type DeviceReport } from "@/lib/site/device";
import type { Quality } from "@/lib/site/experience";
import { PersonaLink } from "@/lib/site/persona-link";
import { spectrumColor } from "@/lib/site/spectrum";
import { useExperience } from "../../experience-provider";
import { ModeSwitch, QualityMenu, QUALITY_LABEL, SoundToggle } from "../experience-controls";
import { HeadsetGate, type LoadStatus } from "./headset-gate";
import { LightCursor } from "./light-cursor";
import { RefractionPoster } from "./refraction-poster";
import { atLeast, createVrState, type Band, type Phase } from "./vr/state";

const VrScene = dynamic(() => import("./vr/scene"), { ssr: false });

gsap.registerPlugin(ScrollTrigger, SplitText);

export type HubChapter = { slug: PersonaSlug; t: number; body: string; points: string[] };
export type HubUpcoming = { slug: PersonaSlug; t: number };
type Props = { chapters: HubChapter[]; upcoming: HubUpcoming[] };

type SectionKind =
  | { kind: "hero" }
  | { kind: "through" }
  | { kind: "persona"; t: number; slug: PersonaSlug }
  | { kind: "more" }
  | { kind: "end" };

const GATE_SESSION_KEY = "xp-gate";
const NEXT_PHASE: Partial<Record<Phase, Phase>> = { wear: "blink", blink: "sky", approach: "impact", impact: "split", split: "climb" };
const NEXT_LOWER: Record<Quality, Quality> = { best: "balanced", balanced: "performance", performance: "performance" };

function sessionFlag(set?: boolean): boolean {
  try {
    if (set) sessionStorage.setItem(GATE_SESSION_KEY, "1");
    return sessionStorage.getItem(GATE_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Catches scene/chunk failures so the page falls back instead of breaking. */
class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HubExperience({ chapters, upcoming }: Props) {
  const xp = useExperience();
  const { experience, ready, chosen, setExperience, setQuality, sound } = xp;

  const [device, setDevice] = useState<DeviceReport | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [startedAt, setStartedAt] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("gate");
  const [gate, setGate] = useState<"full" | "returning" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [struggling, setStruggling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [touch, setTouch] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  /** False until the page knows how it will open — a void cover hides everything until then. */
  const [decided, setDecided] = useState(false);

  const vr = useRef(createVrState());
  const lenisRef = useRef<Lenis | null>(null);
  const anchors = useRef<number[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const eyeRef = useRef<SVGEllipseElement>(null);
  const heldOnce = useRef(false);

  // ---- Story structure ---------------------------------------------------
  const sections: SectionKind[] = useMemo(
    () => [
      { kind: "hero" },
      { kind: "through" },
      ...chapters.map((c) => ({ kind: "persona" as const, t: c.t, slug: c.slug })),
      ...(upcoming.length ? [{ kind: "more" as const }] : []),
      { kind: "end" },
    ],
    [chapters, upcoming],
  );
  const sectionT = useMemo(() => sections.map((s) => (s.kind === "persona" ? s.t : null)), [sections]);
  const bands: Band[] = useMemo(
    () =>
      [...chapters.map((c) => ({ t: c.t, lit: true, slug: c.slug })), ...upcoming.map((u) => ({ t: u.t, lit: false, slug: u.slug }))].sort(
        (a, b) => a.t - b.t,
      ),
    [chapters, upcoming],
  );
  const quality: Quality = xp.quality ?? device?.suggested ?? "balanced";

  const setPhase = useCallback((p: Phase) => {
    vr.current.phase = p;
    vr.current.phaseAt = performance.now();
    document.documentElement.dataset.vrPhase = p;
    setPhaseState(p);
  }, []);

  // ---- First mount: analyse, decide how to open ---------------------------
  useEffect(() => {
    if (!ready) return;
    const report = analyseDevice();
    const seen = sessionFlag();
    queueMicrotask(() => {
      setDevice(report);
      setTouch(!window.matchMedia("(pointer: fine)").matches);
      setStartedAt(performance.now());
      if (!report.webgl) setStatus("unsupported");
      if (!chosen || !seen) setGate("full");
      else if (experience === "immersive" && report.webgl) setGate("returning");
      setDecided(true);
    });
    // Run once when the provider is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const sceneWanted = !!device?.webgl && status !== "failed" && (gate !== null || experience === "immersive");
  const immersiveLive = experience === "immersive" && status !== "failed" && atLeast(phase, "wear");
  const introDone = phase === "climb";

  // ---- Phase transitions ------------------------------------------------------
  const land = useCallback(() => {
    // Straight onto the climb: no flash, cone open, scroll free.
    vr.current.skipped = true;
    vr.current.approach = 1;
    setPhase("climb");
    setBlink(false);
    setHint(null);
    setGate(null);
    setLeaving(false);
  }, [setPhase]);

  const wear = useCallback(() => {
    if (status !== "ready") return;
    sessionFlag(true);
    setExperience("immersive");
    setLeaving(true);
    window.scrollTo(0, 0);
    vr.current.skipped = false;
    vr.current.approach = 0;
    setPhase("wear");
    if (sound) ambient.start();
    window.setTimeout(() => setGate(null), 900);
    // The lenses close over the eyes just before the headset settles.
    window.setTimeout(() => {
      if (vr.current.phase === "wear") setBlink(true);
    }, 1000);
  }, [status, setExperience, setPhase, sound]);

  const startLight = useCallback(() => {
    if (vr.current.phase !== "sky") return;
    setPhase("approach");
    setHint(null);
  }, [setPhase]);

  const skip = useCallback(() => {
    sessionFlag(true);
    land();
  }, [land]);

  const onPhaseEnd = useCallback(
    (ended: Phase) => {
      if (vr.current.phase !== ended) return;
      const next = NEXT_PHASE[ended];
      if (!next) return;
      setPhase(next);
      if (next === "sky") setHint(touch ? "Tap to call the light" : "Press Space");
      if (next === "impact") {
        ambient.chime(1);
        const f = flashRef.current;
        if (f) gsap.fromTo(f, { opacity: 1 }, { opacity: 0, duration: 1.6, ease: "power2.out" });
      }
    },
    [setPhase, touch],
  );

  const goNormal = useCallback(() => {
    sessionFlag(true);
    setExperience("normal");
    setLeaving(true);
    setPhase("gate");
    setBlink(false);
    setHint(null);
    ambient.stop();
    window.setTimeout(() => {
      setGate(null);
      setLeaving(false);
    }, 500);
  }, [setExperience, setPhase]);

  // Returning in the same session: land once ready.
  useEffect(() => {
    if (gate === "returning" && status === "ready") queueMicrotask(land);
  }, [gate, status, land]);

  // Mode switched from the top bar.
  useEffect(() => {
    if (!device || gate) return;
    if (experience === "immersive" && phase === "gate" && device.webgl) {
      queueMicrotask(() => {
        setStatus((s) => (s === "failed" ? "loading" : s));
        setStartedAt(performance.now());
        setGate("full");
      });
    }
    if (experience === "normal" && phase !== "gate") {
      queueMicrotask(() => {
        setPhase("gate");
        setStruggling(false);
        ambient.stop();
      });
    }
  }, [experience, phase, gate, device, setPhase]);

  // The blink: black, then the eyes open onto the sky.
  useEffect(() => {
    if (phase !== "blink" || !eyeRef.current) return;
    const tl = gsap.timeline();
    tl.fromTo(eyeRef.current, { attr: { rx: 0, ry: 0 } }, { attr: { rx: 95, ry: 14 }, duration: 0.55, ease: "power2.inOut", delay: 0.3 });
    tl.to(eyeRef.current, { attr: { rx: 160, ry: 160 }, duration: 0.7, ease: "power3.in" });
    return () => {
      tl.kill();
    };
  }, [phase]);
  useEffect(() => {
    // Once the eyes are open the overlay goes, whatever happens next.
    if (phase === "sky") window.setTimeout(() => setBlink(false), 400);
  }, [phase]);

  // Hint while the light approaches; sound follows the light.
  useEffect(() => {
    if (phase !== "approach") return;
    const id = window.setInterval(() => {
      const p = vr.current.approach;
      ambient.depth(p);
      if (!heldOnce.current && p > 0.28 && p < 0.9) setHint(touch ? "Touch and hold to slow it down" : "Click and hold to slow it down");
      else setHint(null);
    }, 120);
    return () => window.clearInterval(id);
  }, [phase, touch]);

  const onSceneReady = useCallback(() => setStatus("ready"), []);
  const onSceneFail = useCallback(() => {
    setStatus("failed");
    setPhase("gate");
  }, [setPhase]);
  const onStepDown = useCallback(() => {
    const next = NEXT_LOWER[quality];
    setQuality(next);
    setToast(`Quality lowered to ${QUALITY_LABEL[next]} to keep it smooth`);
  }, [quality, setQuality]);
  const onStruggle = useCallback(() => setStruggling(true), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ---- Sound follows the toggle (the toggle click is the user gesture) -----
  useEffect(() => {
    if (!immersiveLive) return;
    if (sound) ambient.start();
    else ambient.stop();
  }, [sound, immersiveLive]);

  // ---- Keyboard ---------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const typing = document.activeElement && document.activeElement !== document.body && document.activeElement.tagName !== "BUTTON";
      if (typing) return;
      const p = vr.current.phase;
      if (e.key === " " || e.key === "Enter") {
        if (gate === "full" && p === "gate" && status === "ready") {
          e.preventDefault();
          wear();
        } else if (p === "sky") {
          e.preventDefault();
          startLight();
        } else if (p !== "climb" && p !== "gate") {
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gate, status, wear, startLight]);

  // ---- Smooth scroll + scroll → climb progress ---------------------------------
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduce ? null : new Lenis({ lerp: 0.14, wheelMultiplier: 0.9 });
    lenisRef.current = lenis;

    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      anchors.current = els.map((el) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        return Math.min(max, Math.max(0, top + el.offsetHeight / 2 - vh / 2));
      });
    };
    const progress = (y: number) => {
      const a = anchors.current;
      if (a.length < 2 || y <= a[0]) return 0;
      for (let i = 0; i < a.length - 1; i++) {
        if (y < a[i + 1]) return i + (y - a[i]) / Math.max(1, a[i + 1] - a[i]);
      }
      return a.length - 1;
    };
    let lastActive = -1;
    const onScroll = () => {
      const c = progress(window.scrollY);
      vr.current.c = c;
      const idx = Math.round(c);
      if (idx !== lastActive) {
        lastActive = idx;
        setActive(idx);
      }
      if (vr.current.phase === "climb") ambient.depth(0.4 + (0.6 * c) / Math.max(1, anchors.current.length - 1));
    };

    measure();
    onScroll();
    const ro = new ResizeObserver(() => {
      measure();
      onScroll();
      ScrollTrigger.refresh();
    });
    ro.observe(document.body);

    let tick: ((t: number) => void) | null = null;
    if (lenis) {
      lenis.on("scroll", () => {
        ScrollTrigger.update();
        onScroll();
      });
      tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Scroll is locked until the climb (or in Normal mode, once the gate is gone).
  const scrollFree = gate === null && (experience === "normal" || phase === "climb");
  useEffect(() => {
    document.documentElement.classList.toggle("scroll-locked", !scrollFree);
    if (scrollFree) lenisRef.current?.start();
    else lenisRef.current?.stop();
  }, [scrollFree]);

  // ---- Pointer: parallax always; drag to look, hold to slow, tap to start ----
  useEffect(() => {
    const s = vr.current;
    let start: { x: number; y: number; yaw: number; pitch: number; id: number; at: number; type: string } | null = null;
    let holdTimer = 0;
    const interactive = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("a, button, input, label, [role='radio'], [role='alertdialog']");
    const lookable = () => immersiveLive && atLeast(s.phase, "sky");

    const move = (e: PointerEvent) => {
      s.px = (e.clientX / window.innerWidth) * 2 - 1;
      s.py = -((e.clientY / window.innerHeight) * 2 - 1);
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!s.dragging && Math.hypot(dx, dy) > 8) {
        window.clearTimeout(holdTimer);
        if (e.pointerType === "mouse" && lookable()) {
          s.dragging = true;
          s.holding = false;
          document.documentElement.classList.add("is-dragging");
        } else {
          start = null; // touch: moving means scrolling
          s.holding = false;
          return;
        }
      }
      if (s.dragging) {
        s.yaw = start.yaw - dx * 0.0042;
        s.pitch = Math.max(-0.6, Math.min(0.6, start.pitch - dy * 0.0032));
      }
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || interactive(e.target) || !lookable()) return;
      start = { x: e.clientX, y: e.clientY, yaw: s.yaw, pitch: s.pitch, id: e.pointerId, at: performance.now(), type: e.pointerType };
      holdTimer = window.setTimeout(() => {
        if (s.phase === "sky") return; // a long press before the light is called does nothing
        s.holding = true;
        heldOnce.current = true;
        setHint(null);
        ambient.timeScale(0);
        document.documentElement.classList.add("is-holding");
      }, 260);
    };
    const up = (e?: PointerEvent) => {
      window.clearTimeout(holdTimer);
      const wasTap = !!start && !s.dragging && !s.holding && e && performance.now() - start.at < 400;
      if (wasTap && s.phase === "sky") startLight();
      if (s.dragging) s.lastDragEnd = performance.now();
      s.dragging = false;
      s.holding = false;
      start = null;
      ambient.timeScale(1);
      document.documentElement.classList.remove("is-dragging", "is-holding");
    };
    const blur = () => up();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", blur);
    window.addEventListener("blur", blur);
    return () => {
      up();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", blur);
      window.removeEventListener("blur", blur);
    };
  }, [immersiveLive, startLight]);

  // ---- Text choreography ------------------------------------------------------
  const textLive = experience === "normal" ? gate === null : introDone;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const hero = root.querySelector<HTMLElement>("[data-hero-title]");
      const heroItems = root.querySelectorAll<HTMLElement>("[data-hero-item]");
      if (hero) {
        const split = SplitText.create(hero, { type: "lines,words", mask: "lines" });
        gsap.set(split.words, { yPercent: 115 });
        gsap.set(heroItems, { autoAlpha: 0, y: 24, filter: "blur(8px)" });
        if (textLive) {
          gsap.to(split.words, { yPercent: 0, duration: 1.5, ease: "expo.out", stagger: 0.07, delay: 0.3 });
          gsap.to(heroItems, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "expo.out", stagger: 0.12, delay: 0.8 });
        }
      }
      root.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        const split = SplitText.create(el, { type: "lines,words", mask: "lines" });
        gsap.from(split.words, {
          yPercent: 110,
          duration: 1.2,
          ease: "expo.out",
          stagger: 0.05,
          scrollTrigger: { trigger: el, start: "top 82%", toggleActions: "play none none reverse" },
        });
      });
      root.querySelectorAll<HTMLElement>("[data-rise]").forEach((el) => {
        gsap.from(el.children, {
          autoAlpha: 0,
          y: 28,
          filter: "blur(6px)",
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 80%", toggleActions: "play none none reverse" },
        });
      });
      root.querySelectorAll<HTMLElement>("[data-numeral]").forEach((el) => {
        gsap.fromTo(el, { yPercent: 30 }, { yPercent: -30, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });
    }, root);
    return () => ctx.revert();
  }, [textLive]);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 2.2 });
    else el.scrollIntoView({ behavior: "smooth" });
  }, []);

  const activeKind = sections[active];
  const activeSlug = activeKind?.kind === "persona" ? activeKind.slug : null;
  const inIntro = immersiveLive && !introDone;
  const scrollHint = !ready
    ? ""
    : experience === "immersive"
      ? touch
        ? "Scroll to climb · touch & hold to slow time"
        : "Scroll to climb · drag to look · hold to slow time"
      : "Scroll to follow the light";

  return (
    <div
      ref={rootRef}
      className={`hub-v3 relative bg-[var(--void)] text-[var(--ink)] ${immersiveLive ? "is-immersive" : "is-normal"} ${textLive ? "" : "is-quiet"}`}
    >
      {/* ---------- Backdrop ---------- */}
      <div aria-hidden className="fixed inset-0 z-0">
        <div className={`poster-alive absolute inset-0 transition-opacity duration-[1400ms] ${sceneWanted || !decided ? "opacity-0" : "opacity-100"}`}>
          <RefractionPoster bands={bands} />
        </div>
        {sceneWanted ? (
          <div className="absolute inset-0">
            <SceneBoundary onFail={onSceneFail}>
              <VrScene
                bands={bands}
                sectionT={sectionT}
                state={vr}
                quality={quality}
                onPhaseEnd={onPhaseEnd}
                onWear={wear}
                onReady={onSceneReady}
                onStepDown={onStepDown}
                onStruggle={onStruggle}
                onFail={onSceneFail}
              />
            </SceneBoundary>
          </div>
        ) : null}
        <div className={`hub-scrim absolute inset-0 transition-opacity duration-[1200ms] ${textLive ? "opacity-100" : "opacity-0"}`} />
      </div>

      {/* ---------- Top bar ---------- */}
      <header className={`fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-4 px-4 pt-5 transition-opacity duration-700 sm:px-8 lg:px-12 ${gate ? "opacity-0" : "opacity-100"}`}>
        <button
          type="button"
          onClick={() => jump("hero")}
          className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase transition-colors hover:text-[var(--ink)]"
        >
          {DISPLAY_ROOT}
        </button>
        <div className="flex items-center gap-5">
          {ready && experience === "immersive" ? <QualityMenu value={quality} className="hidden md:block" /> : null}
          <span className="hidden sm:block">
            <SoundToggle />
          </span>
          <ModeSwitch />
        </div>
      </header>

      {/* ---------- Spectrum rail (lg+) ---------- */}
      <nav aria-label="Chapters" className={`fixed top-1/2 right-5 z-30 hidden -translate-y-1/2 flex-col gap-3 transition-opacity duration-700 lg:flex ${textLive ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {chapters.map((c) => {
          const id = personaIdentity(c.slug);
          const on = activeSlug === c.slug;
          const color = spectrumColor(c.t);
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => jump(c.slug)}
              aria-label={`${id.role} chapter`}
              aria-current={on ? "true" : undefined}
              data-cursor-color={color}
              className="group flex items-center justify-end gap-3"
            >
              <span className={`font-mono text-[10px] tracking-[0.14em] text-[var(--ink-dim)] uppercase transition-opacity duration-[var(--dur-2)] ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                {id.role}
              </span>
              <span
                className="block rounded-full transition-all duration-[var(--dur-2)]"
                style={{ width: 3, height: on ? 34 : 10, backgroundColor: color, boxShadow: on ? `0 0 18px ${color}` : "none", opacity: on ? 1 : 0.55 }}
              />
            </button>
          );
        })}
      </nav>

      <main className="relative z-10">
        {/* ---------- Hero ---------- */}
        <section id="hero" data-section className="flex min-h-[100svh] items-end px-4 pb-14 sm:px-8 lg:items-center lg:px-12 lg:pb-0">
          <div className="max-w-3xl">
            <h1 data-hero-title className="font-display text-[length:clamp(2.9rem,1rem+5.4vw,7rem)] leading-[0.96] tracking-[-0.02em] text-balance">
              <span className="block">One mind.</span>
              <span className="block italic text-[var(--ink-dim)]">Many perspectives.</span>
            </h1>
            <p data-hero-item className="mt-7 text-[length:var(--step-1)] text-[var(--ink-dim)]">
              {HUB_COPY.intro} <CyclingPhrase chapters={chapters} />
            </p>
            <p data-hero-item className="mt-14 font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase">
              {scrollHint} <span aria-hidden className="hub-scroll-cue" />
            </p>
          </div>
        </section>

        {/* ---------- Into the colour ---------- */}
        <section id="through" data-section className="flex min-h-[110svh] items-center justify-center px-4 text-center sm:px-8">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--ink-faint)] uppercase">{HUB_COPY.throughEyebrow}</p>
            <h2 data-split className="mt-5 font-display text-[length:var(--step-4)] leading-[0.98] tracking-[-0.015em]">
              {HUB_COPY.throughTitle}
            </h2>
            <div data-rise>
              <p className="mx-auto mt-6 max-w-md text-[length:var(--step-0)] text-[var(--ink-dim)]">{HUB_COPY.throughBody}</p>
            </div>
          </div>
        </section>

        {chapters.map((c, i) => (
          <PersonaChapter key={c.slug} chapter={c} index={i} total={chapters.length} />
        ))}

        {upcoming.length ? (
          <section id="more" data-section className="flex min-h-[100svh] items-center px-4 sm:px-8 lg:px-12">
            <div className="max-w-xl">
              <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--ink-faint)] uppercase">Still refracting</p>
              <h2 data-split className="mt-4 font-display text-[length:var(--step-4)] leading-[0.95]">
                {HUB_COPY.moreTitle}
              </h2>
              <ul data-rise className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.16em] uppercase">
                {upcoming.map((u, i) => (
                  <li key={u.slug} className="hub-flicker flex items-center gap-2 text-[var(--ink-faint)]" style={{ "--i": i } as CSSProperties}>
                    <span aria-hidden className="h-px w-5" style={{ backgroundColor: spectrumColor(u.t, 50) }} />
                    {personaIdentity(u.slug).role}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* ---------- Closing ---------- */}
        <section id="end" data-section className="flex min-h-[110svh] flex-col justify-center px-4 sm:px-8 lg:px-12">
          <div className="max-w-2xl lg:max-w-3xl">
            <h2 data-split className="font-display text-[length:var(--step-4)] leading-[0.95]">
              {HUB_COPY.closingTitle.split(/(?<=\.)\s+/).map((line, i) => (
                <span key={i} className={`block ${i > 0 ? "italic text-[var(--ink-dim)]" : ""}`}>
                  {line}
                </span>
              ))}
            </h2>
            <div data-rise>
              <p className="mt-6 max-w-lg text-[length:var(--step-0)] leading-relaxed text-[var(--ink-dim)]">{HUB_COPY.closingBody}</p>
              <div className="mt-10">
                <a
                  href={`mailto:${HUB_COPY.email}`}
                  className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--ink)] px-7 text-sm font-medium text-[var(--void)] transition-transform duration-[var(--dur-2)] hover:-translate-y-0.5"
                >
                  Say hello <span aria-hidden>→</span>
                </a>
                <p className="mt-4 font-mono text-xs text-[var(--ink-faint)]">{HUB_COPY.email}</p>
              </div>
            </div>
          </div>
          <footer className="mt-24 flex items-center justify-between pb-8 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-faint)] uppercase">
            <span>© {new Date().getFullYear()} Ratul Roy</span>
            <span className="sm:hidden">
              <SoundToggle />
            </span>
          </footer>
        </section>
      </main>

      {/* ---------- Intro overlays ---------- */}
      {/* Void until the page knows how it opens: no glimpse of anything else first. */}
      <div aria-hidden className={`hub-boot fixed inset-0 z-[45] bg-[var(--void)] ${decided ? "is-done" : ""}`} />
      <div ref={flashRef} aria-hidden className="vr-flash fixed inset-0 z-40 opacity-0" />
      {blink ? (
        <svg aria-hidden className="vr-blink fixed inset-0 z-40 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <mask id="vr-eye">
              <rect width="100" height="100" fill="#fff" />
              <ellipse ref={eyeRef} cx="50" cy="50" rx="0" ry="0" fill="#000" />
            </mask>
          </defs>
          <rect width="100" height="100" fill="#050507" mask="url(#vr-eye)" />
        </svg>
      ) : null}
      {inIntro ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_auto_1fr] items-end px-4 pb-6 sm:px-8 lg:px-12">
          <span />
          <p aria-live="polite" className={`vr-hint text-center font-mono text-[11px] tracking-[0.22em] text-[var(--ink-dim)] uppercase ${hint ? "is-on" : ""}`}>
            {hint ?? ""}
          </p>
          <button
            type="button"
            onClick={skip}
            className="pointer-events-auto justify-self-end font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline"
          >
            Skip intro →
          </button>
        </div>
      ) : null}

      {ready ? <LightCursor holdHint="slowing time" /> : null}

      {struggling ? (
        <div role="alertdialog" aria-label="Performance" className="fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[rgba(10,10,14,0.9)] p-5 backdrop-blur-xl sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-[var(--ink-dim)]">This device is working hard. Switch to Normal view?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setExperience("normal")} className="min-h-10 rounded-full bg-[var(--ink)] px-4 text-xs font-medium text-[var(--void)]">
              Switch
            </button>
            <button type="button" onClick={() => setStruggling(false)} className="min-h-10 rounded-full border border-[var(--line)] px-4 text-xs text-[var(--ink-dim)]">
              Keep 3D
            </button>
          </div>
        </div>
      ) : null}
      {toast ? (
        <p role="status" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-[var(--line)] bg-[rgba(10,10,14,0.85)] px-4 py-2 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-dim)] uppercase backdrop-blur-xl">
          {toast}
        </p>
      ) : null}

      {gate === "full" ? (
        <HeadsetGate
          device={device}
          quality={quality}
          onQuality={setQuality}
          status={device && !device.webgl ? "unsupported" : status}
          startedAt={startedAt}
          leaving={leaving}
          touch={touch}
          onWear={wear}
          onNormal={goNormal}
        />
      ) : null}
      {gate === "returning" ? (
        <div role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[var(--void)]">
          <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--ink-dim)] uppercase">{status === "failed" ? "3D couldn’t start" : "Gathering light"}</p>
          <button type="button" onClick={goNormal} className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase underline-offset-4 hover:text-[var(--ink)] hover:underline">
            {status === "failed" ? "Continue in Normal view" : "Skip — Normal view"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PersonaChapter({ chapter, index, total }: { chapter: HubChapter; index: number; total: number }) {
  const id = personaIdentity(chapter.slug);
  const color = spectrumColor(chapter.t);
  return (
    <section
      id={chapter.slug}
      data-section
      aria-labelledby={`${chapter.slug}-title`}
      className="relative flex min-h-[125svh] items-center px-4 py-24 sm:px-8 lg:px-12"
    >
      <span
        aria-hidden
        data-numeral
        className="hub-numeral pointer-events-none absolute top-1/2 right-[6vw] -translate-y-1/2 font-display leading-none max-lg:hidden"
        style={{ "--c": color } as CSSProperties}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="relative max-w-2xl">
        <p className="flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase">
          <span aria-hidden className="h-px w-8" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · {id.role}
        </p>
        <h2 id={`${chapter.slug}-title`} data-split className="mt-5 font-display text-[length:clamp(2.6rem,1.4rem+3.6vw,5.4rem)] leading-[0.95] tracking-[-0.015em] break-words">
          {id.handle ?? id.role}
        </h2>
        <div data-rise>
          <p className="mt-3 font-display text-[length:var(--step-2)] italic" style={{ color }}>
            I {id.phrase}.
          </p>
          <p className="mt-6 max-w-xl text-[length:var(--step-0)] leading-relaxed text-[var(--ink-dim)]">{chapter.body}</p>
          {chapter.points.length ? (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] tracking-[0.06em] text-[var(--ink-faint)]">
              {chapter.points.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span aria-hidden style={{ color }}>
                    ·
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <PersonaLink
              persona={chapter.slug}
              data-cursor-color={color}
              className="hub-cta mt-10 inline-flex min-h-12 items-center gap-3 rounded-full border px-6 text-sm font-medium backdrop-blur-md"
              style={{ "--c": color } as CSSProperties}
            >
              {id.cta}
              <span aria-hidden className="hub-cta-arrow">
                →
              </span>
            </PersonaLink>
            <p className="mt-3 font-mono text-[11px] text-[var(--ink-faint)]">
              <span style={{ color }}>{id.subdomain}.</span>
              {DISPLAY_ROOT}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "I build systems" → "I read markets" → … (static sentence with reduced motion). */
function CyclingPhrase({ chapters }: { chapters: HubChapter[] }) {
  const [i, setI] = useState(0);
  const [cycling, setCycling] = useState(false);
  const phrases = chapters.map((c) => ({ text: personaIdentity(c.slug).phrase, color: spectrumColor(c.t) }));

  useEffect(() => {
    if (phrases.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    queueMicrotask(() => setCycling(true));
    const id = window.setInterval(() => setI((n) => (n + 1) % phrases.length), 2600);
    return () => window.clearInterval(id);
  }, [phrases.length]);

  const list = phrases.map((p) => p.text);
  const sentence = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
  if (!cycling) return <span className="text-[var(--ink)]">{sentence}.</span>;
  return (
    <>
      <span className="sr-only">{sentence}.</span>
      <span aria-hidden key={i} className="hub-phrase inline-block" style={{ color: phrases[i].color }}>
        {phrases[i].text}.
      </span>
    </>
  );
}

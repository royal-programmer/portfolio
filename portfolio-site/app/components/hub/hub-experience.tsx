"use client";

/**
 * The hub (D38): the VR journey.
 *
 *   gate      a headset floats in the dark; device analysed, quality suggested
 *   wear      click it → it comes up to your face · blink · the night sky
 *   sky       one point of light far ahead · Press Space
 *   approach  the light comes at you, slow then fast (hold to slow time)
 *   impact    the strike · a white pillar stands up through you
 *   split     the camera rides the J; the pillar fans out and the white separates into colour
 *   climb     scroll: spiral up through the cone past the drifting field; each persona's objects
 *             assemble and light up — a lit assembly is a doorway (tap it: the camera flies in)
 *
 * HTML owns all content (screen readers, no-JS and Normal mode get the whole
 * story). Scroll is smoothed by Lenis; text is choreographed with GSAP.
 */
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { HubGuide, toggleFullscreen } from "./hub-guide";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import type { PersonaSlug } from "@/lib/content/types";
import { ambient } from "@/lib/site/ambient-sound";
import { DISPLAY_ROOT, HUB_COPY, personaIdentity } from "@/lib/site/brand";
import { PROFILES } from "@/lib/site/profiles";
import { analyseDevice, type DeviceReport } from "@/lib/site/device";
import type { Quality } from "@/lib/site/experience";
import { PersonaLink, personaHref } from "@/lib/site/persona-link";
import { spectrumColor } from "@/lib/site/spectrum";
import { useExperience } from "../../experience-provider";
import { ModeSwitch, QualityMenu, QUALITY_LABEL, SoundToggle } from "../experience-controls";
import { BootFrame, ExitFrame } from "./exit-sequence";
import { GateSkeleton, HeadsetGate, type LoadStatus } from "./headset-gate";
import { printCredits } from "@/lib/site/credits";
import { LightCursor } from "./light-cursor";
import { speculate } from "@/lib/site/speculate";
import { NormalDisplays } from "./normal-displays";
import { NormalJourney } from "./normal-journey";
import { RefractionPoster } from "./refraction-poster";
import { PORTAL_LENGTH, PORTAL_OUT_LENGTH, REWIND_LENGTH, atLeast, createVrState, type Band, type Phase, type World } from "./vr/state";

const VrScene = dynamic(() => import("./vr/scene"), { ssr: false });

gsap.registerPlugin(ScrollTrigger, SplitText);

export type HubChapter = { slug: PersonaSlug; t: number; body: string; points: string[] };
export type HubUpcoming = { slug: PersonaSlug; t: number };
type Props = { chapters: HubChapter[]; upcoming: HubUpcoming[]; /** Published engineer project slugs (the terminal's `ls`). */ terminalItems?: string[] };

type SectionKind =
  | { kind: "hero" }
  | { kind: "through" }
  | { kind: "persona"; t: number; slug: PersonaSlug }
  | { kind: "more" }
  | { kind: "end" };

const GATE_SESSION_KEY = "xp-gate";
/** The world last entered through its doorway: coming back lands on its section. */
const WORLD_SESSION_KEY = "xp-world";
const NEXT_PHASE: Partial<Record<Phase, Phase>> = { wear: "blink", blink: "sky", approach: "impact", impact: "split", split: "climb" };
const NEXT_LOWER: Record<Quality, Quality> = { best: "balanced", balanced: "performance", performance: "performance" };

/** How long a tapped doorway waits for its setup to fully form before it gives up on the dive and goes as a plain fade (a model that never arrived). */
const WAIT_FOR_SETUP_MS = 15000;

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

export function HubExperience({ chapters, upcoming, terminalItems = [] }: Props) {
  const xp = useExperience();
  const { experience, ready, chosen, setExperience, setQuality, qualityChosen, sound, soundChoice } = xp;

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
  /** The rail and the HUD open with the page and fold to their strips once you scroll (Ratul's call). */
  const [folded, setFolded] = useState(false);
  const unfoldY = useRef(0);
  const unfold = useCallback(() => {
    unfoldY.current = window.scrollY;
    setFolded(false);
  }, []);
  const toggleFold = useCallback(() => {
    if (folded) unfold();
    else setFolded(true);
  }, [folded, unfold]);
  const [hint, setHint] = useState<string | null>(null);
  /** The shortcuts card (the ? key, or the guide's button). */
  const [blink, setBlink] = useState(false);
  /** "Take off your headset": the dive back down the climb, lids closing, back to the gate. */
  const [rewinding, setRewinding] = useState(false);
  const [closing, setClosing] = useState(false);
  /** False until the page knows how it will open — a void cover hides everything until then. */
  const [decided, setDecided] = useState(false);
  /** The world being entered through its lit assembly (its colour fills the view, then we leave). */
  const [entering, setEntering] = useState<World | null>(null);
  /** The world just returned from: its finished window shrinks away as the camera pulls out. */
  const [returning, setReturning] = useState<World | null>(null);
  /** A doorway asked for before its setup has formed: the button waits for the screen, then goes. */
  const [waiting, setWaiting] = useState<string | null>(null);
  /** Normal mode: the doorway just taken, until the other host answers (the chapter's button shows it). */
  const [normalWaiting, setNormalWaiting] = useState<string | null>(null);
  /** public/hub/media.json: Ratul's own pictures per persona (the photographer's sequence uses one). */
  const [media, setMedia] = useState<Partial<Record<string, string[]>>>({});
  const router = useRouter();
  useEffect(() => void printCredits(), []);
  useEffect(() => {
    let live = true;
    fetch("/hub/media.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => live && setMedia(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const vr = useRef(createVrState());
  const lenisRef = useRef<Lenis | null>(null);
  const anchors = useRef<number[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLDivElement>(null);
  // Normal mode: the displays tell the canvas how far the drawing should recede, and lend the
  // chapter button their doorway.
  const normalRecede = useRef(0);
  const normalEnter = useRef<((slug: string) => void) | null>(null);
  // Read once, before the provider strips it from the URL.
  const xpForced = useRef<boolean>(false);
  if (typeof window !== "undefined" && !xpForced.current) {
    const q = new URLSearchParams(window.location.search).get("xp");
    if (q === "normal" || q === "immersive") xpForced.current = true;
  }
  const blinkRaf = useRef(0);
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
  /** Where each persona peaks on the climb: its section's index is its scroll progress `c`. */
  const worlds: World[] = useMemo(
    () => sections.flatMap((s, i) => (s.kind === "persona" ? [{ slug: s.slug, t: s.t, c: i }] : [])),
    [sections],
  );
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
    let seen = sessionFlag();
    // A link that names the mode is a decision already made: no gate.
    if (xpForced.current) {
      sessionFlag(true);
      seen = true;
    }
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
    // Back from a world: stand where its doorway is, not at the start of the climb.
    let from: string | null = null;
    try {
      from = sessionStorage.getItem(WORLD_SESSION_KEY);
      sessionStorage.removeItem(WORLD_SESSION_KEY);
    } catch {}
    if (from) {
      const el = document.getElementById(from);
      const world = worlds.find((w) => w.slug === from);
      if (el && world) {
        // The chapter's middle, re-aligned a few times while the page settles (fonts, the
        // chapters' heights, a phone's address bar): the browser's own restore is off, so this
        // is the only hand on the scroll, and the camera stands exactly at the chapter's station.
        const align = () => {
          const y = el.getBoundingClientRect().top + window.scrollY + el.offsetHeight / 2 - window.innerHeight / 2;
          if (Math.abs(window.scrollY - y) > 1) {
            window.scrollTo(0, y);
            lenisRef.current?.scrollTo(y, { immediate: true, force: true });
          }
          vr.current.c = world.c;
        };
        requestAnimationFrame(() => {
          align();
          // Start inside the screen you left and pull back out to the chapter.
          vr.current.portalOut = { slug: from!, at: performance.now() + 200 };
          setReturning(world);
          window.setTimeout(() => setReturning(null), PORTAL_OUT_LENGTH * 1000 + 300);
        });
        for (const ms of [120, 300, 600, 1000, 1600]) window.setTimeout(align, ms);
      }
    }
  }, [setPhase, worlds]);

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
        ambient.impact();
        // A short bloom, not a curtain: the white pillar is already there behind it.
        const f = flashRef.current;
        if (f) gsap.fromTo(f, { opacity: 0.95 }, { opacity: 0, duration: 1.1, ease: "power1.out" });
      }
    },
    [setPhase, touch],
  );

  /** The pointer is on a lit screen: warm that world so the switch is instant (dev compiles it now). */
  const warmed = useRef(new Set<string>());
  const onPortalHover = useCallback((slug: string | null) => {
    if (!slug || warmed.current.has(slug)) return;
    warmed.current.add(slug);
    const target = personaHref(window.location.origin, slug as PersonaSlug);
    fetch(target.href, { mode: "no-cors", credentials: "include", cache: "force-cache" }).catch(() => {});
  }, []);

  /** Smooth-scroll to a section (the rail, the keys, the Top/End marks, an early tap on a doorway). */
  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 2.2 });
    else el.scrollIntoView({ behavior: "smooth" });
  }, []);

  /** Through the doorway: the camera flies into the screen; the world's own sequence runs; we leave when it ends. */
  const startPortal = useCallback((world: World) => {
    vr.current.portal = { slug: world.slug, at: performance.now() };
    vr.current.portalHover = null;
    sessionFlag(true);
    try {
      sessionStorage.setItem(WORLD_SESSION_KEY, world.slug);
    } catch {}
    setEntering(world);
    ambient.chime(1.5);
  }, []);
  const enterWorld = useCallback(
    (slug: string) => {
      const world = worlds.find((w) => w.slug === slug);
      if (!world || vr.current.portal || waiting) return;
      // The dive needs this world's screen. Before the setup has formed (its model still
      // arriving) there is nothing to fly into: wait for it, the button showing that it heard.
      const a = vr.current.portalAnchor;
      if (!a || a.slug !== slug || !a.formed) {
        // Ratul's call: the hub drives the scroll to the chapter itself; the parts gather on the
        // way and the dive fires the moment the setup is whole.
        setWaiting(slug);
        jump(slug);
        return;
      }
      startPortal(world);
    },
    [worlds, waiting, startPortal, jump],
  );
  useEffect(() => {
    if (!waiting) return;
    const world = worlds.find((w) => w.slug === waiting);
    if (!world) {
      setWaiting(null);
      return;
    }
    const t0 = performance.now();
    let arrived = false;
    const id = window.setInterval(() => {
      // The auto-scroll is still on its way: let it arrive. Once there, scrolling away means the
      // setup is coming apart and the tap is forgotten.
      const dc = Math.abs(vr.current.c - world.c);
      if (dc < 0.15) arrived = true;
      if (arrived && dc > 0.45) {
        window.clearInterval(id);
        setWaiting(null);
        return;
      }
      const a = vr.current.portalAnchor;
      const formed = !!a && a.slug === waiting && a.formed;
      if (!formed && performance.now() - t0 < WAIT_FOR_SETUP_MS) return;
      // Formed: the dive, from the perfect moment. Still nothing after a long wait (the model
      // never arrived): no anchor, so the doorway is the plain fade into the world's window.
      if (!formed) vr.current.portalAnchor = null;
      window.clearInterval(id);
      setWaiting(null);
      startPortal(world);
    }, 60);
    return () => window.clearInterval(id);
  }, [waiting, worlds, startPortal]);
  const leaveForWorld = useCallback(() => {
    if (!entering) return;
    const target = personaHref(window.location.origin, entering.slug as PersonaSlug);
    // `via=hub`: the world page opens on this same booting window and plays its sequence from here.
    const href = target.href + (target.href.includes("?") ? "&" : "?") + "via=hub";
    if (target.crossOrigin) window.location.assign(href);
    else router.push(href);
  }, [entering, router]);
  // The cut: the moment the screen has filled the view, the world page takes over.
  useEffect(() => {
    if (!entering) return;
    const id = window.setTimeout(leaveForWorld, Math.round(PORTAL_LENGTH * 1000) + 90);
    return () => window.clearTimeout(id);
  }, [entering, leaveForWorld]);

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

  // The lids: one runner for the intro's opening, the rewind's closing and the re-opening on the
  // headset screen. A plain animation frame, not a tween: the scene's loop is the one clock that
  // never stalls. The gradient feathers the last 45 % of the ellipse; the blur follows the opening.
  const runLids = useCallback((dir: "open" | "close", len: number, delay = 0, onEnd?: () => void) => {
    const canvas = rootRef.current?.querySelector<HTMLCanvasElement>("canvas") ?? null;
    const eye = eyeRef.current;
    if (!eye) return;
    const t0 = performance.now() + delay;
    if (blinkRaf.current) cancelAnimationFrame(blinkRaf.current);
    const frame = (now: number) => {
      const x = Math.min(1, Math.max(0, (now - t0) / len));
      // Opening eases in and out as a slit that rounds; closing is quick and lands hard.
      const u = dir === "open" ? (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2) : 1 - x * x;
      eye.setAttribute("rx", (260 * Math.pow(u, 0.75)).toFixed(2));
      eye.setAttribute("ry", (260 * Math.pow(u, 1.6)).toFixed(2));
      if (canvas) canvas.style.filter = u < 0.999 && u > 0.001 ? `blur(${(16 * Math.pow(1 - u, 1.4)).toFixed(2)}px)` : "";
      if (x < 1) blinkRaf.current = requestAnimationFrame(frame);
      else {
        blinkRaf.current = 0;
        onEnd?.();
      }
    };
    blinkRaf.current = requestAnimationFrame(frame);
  }, []);

  // ---- Ending: take off the headset ------------------------------------------
  const rewind = useCallback(() => {
    const s = vr.current;
    if (s.phase !== "climb" || s.rewind || s.portal) return;
    s.rewind = { at: performance.now(), from: s.c };
    s.zoom = 0;
    setRewinding(true);
    setHint(null);
    ambient.rewind();
    const ms = REWIND_LENGTH * 1000;
    const lids = window.setTimeout(() => setClosing(true), ms - 640);
    const back = window.setTimeout(() => {
      s.rewind = null;
      s.skipped = false;
      s.approach = 0;
      s.c = 0;
      s.yaw = s.pitch = 0;
      window.scrollTo(0, 0);
      lenisRef.current?.scrollTo(0, { immediate: true, force: true });
      setPhase("gate");
      setStartedAt(performance.now());
      setGate("full");
      ambient.stop();
      setRewinding(false);
      // Shut for a beat over the headset screen, then the eyes open on it: the start again.
      runLids("open", 900, 300, () => {
        setClosing(false);
        setBlink(false);
      });
    }, ms + 120);
    return () => {
      window.clearTimeout(lids);
      window.clearTimeout(back);
    };
  }, [setPhase, runLids]);

  // The lids close over the end of the dive (the eye mounts open, then runs shut).
  useEffect(() => {
    if (!closing) return;
    setBlink(true);
  }, [closing]);
  useEffect(() => {
    if (closing && blink) runLids("close", 400);
  }, [closing, blink, runLids]);

  // Back from a world: you pull out of its screen — a flare in its colour, the eyes opening onto the
  // climb, the camera's lens settling (the scene widens the view over the pull-out).
  useEffect(() => {
    if (!returning) return;
    const c = spectrumColor(returning.t);
    const flashEl = flashRef.current;
    let tw: gsap.core.Tween | null = null;
    setBlink(true);
    // Two frames on: the lids have mounted (closed) and the animation clocks are fresh after the
    // landing's long frame — so neither the flare nor the lids skip their start.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const f = flashRef.current;
        if (f) {
          f.style.background = c;
          tw = gsap.fromTo(f, { opacity: 0.55 }, { opacity: 0, duration: PORTAL_OUT_LENGTH * 0.9, ease: "power2.out", onComplete: () => {
              f.style.background = "";
            },
          });
        }
        runLids("open", PORTAL_OUT_LENGTH * 1000 * 0.8, 0, () => setBlink(false));
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      // Never leave the flare half-way (a stalled clock could): clear it outright.
      tw?.kill();
      if (flashEl) {
        flashEl.style.opacity = "0";
        flashEl.style.background = "";
      }
    };
  }, [returning, runLids]);

  // The world's colour rises over the last part of the flight in.
  useEffect(() => {
    const el = enterRef.current;
    if (!entering || !el) return;
    document.documentElement.classList.add("is-portal-hover");
    // The cover rises as the screen fills the view (the flight is PORTAL_LENGTH).
    const tw = gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.in", delay: PORTAL_LENGTH - 0.3 });
    return () => {
      tw.kill();
    };
  }, [entering]);

  // Back from a world: the browser may restore this page from its cache mid-flight (colour up,
  // camera inside the screen). Put everything back where it was.
  const enteringRef = useRef<World | null>(null);
  useEffect(() => {
    enteringRef.current = entering;
  }, [entering]);
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const s = vr.current;
      const w = enteringRef.current;
      s.portal = null;
      s.portalHover = null;
      setEntering(null);
      setLeaving(false);
      document.documentElement.classList.remove("is-portal-hover");
      ambient.resume();
      // The world's key is spent here (a fresh load would otherwise replay the return on reload).
      try {
        sessionStorage.removeItem(WORLD_SESSION_KEY);
      } catch {}
      // Come back out of the screen you went into: the same pull-out as a fresh landing.
      if (w) {
        s.portalOut = { slug: w.slug, at: performance.now() + 120 };
        setReturning(w);
        window.setTimeout(() => setReturning(null), PORTAL_OUT_LENGTH * 1000 + 300);
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

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

  // The blink: black, then the eyes open onto the sky. The loop outlives the phase: the sky
  // arrives while the lids are still opening, and the opening must not stop when it does.
  useEffect(() => {
    if (phase !== "blink") return;
    setBlink(true); // stays mounted through the sky until the opening is wider than the view
    runLids("open", 1700, 250, () => setBlink(false));
  }, [phase, runLids]);
  useEffect(() => () => cancelAnimationFrame(blinkRaf.current), []);

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
  const suggestedOnce = useRef(false);
  const onStepDown = useCallback(() => {
    const next = NEXT_LOWER[quality];
    if (qualityChosen) {
      // The visitor set this level: never change it under them — say so, once.
      if (suggestedOnce.current) return;
      suggestedOnce.current = true;
      setToast(`Running below 40 fps — ${QUALITY_LABEL[next]} would be smoother`);
      return;
    }
    setQuality(next, false);
    setToast(`Graphics lowered to ${QUALITY_LABEL[next]} to keep it smooth`);
  }, [quality, qualityChosen, setQuality]);
  const onStruggle = useCallback(() => setStruggling(true), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ---- Sound follows the menu (the click is the user gesture); the scene can change while it plays -----
  useEffect(() => {
    if (soundChoice !== "off") ambient.scene(soundChoice);
  }, [soundChoice]);
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
      // The chapters answer the keys on the climb, and in Normal mode once the gate is gone.
      const nav = p === "climb" || (experience === "normal" && gate === null);
      ambient.resume();
      if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (p === "climb" && !e.ctrlKey && !e.metaKey && (e.key === "-" || e.key === "_" || e.key === "=" || e.key === "+" || e.key === "0")) {
        // Lens: − pulls the view wide (watch an assembly whole), + tightens, 0 resets.
        const s = vr.current;
        s.zoom = e.key === "0" ? 0 : Math.max(-0.5, Math.min(1, s.zoom + (e.key === "-" || e.key === "_" ? 0.25 : -0.25)));
        return;
      }
      if (nav && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const s = vr.current;
        // Glide so the chapter sits centred in the view (its words and its setup), not at the top.
        const centreOf = (el: HTMLElement) => el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2;
        const glide = (id: string) => {
          const el = document.getElementById(id);
          if (!el) return;
          const y = id === "hero" ? 0 : Math.max(0, centreOf(el));
          if (lenisRef.current) lenisRef.current.scrollTo(y, { duration: 1.5 });
          else window.scrollTo({ top: y, behavior: "smooth" });
        };
        const personas = sections.filter((sec) => sec.kind === "persona") as Array<{ kind: "persona"; slug: string }>;
        const stops = personas.map((w) => ({ slug: w.slug, el: document.getElementById(w.slug) })).filter((x): x is { slug: string; el: HTMLElement } => !!x.el);
        // Space: the next world from where you are now (Shift: the one before). Past the last, the ending.
        if (e.key === " " && !s.portal && !s.rewind) {
          e.preventDefault();
          const here = window.scrollY;
          if (e.shiftKey) {
            const prev = [...stops].reverse().find((x) => centreOf(x.el) < here - 40);
            glide(prev ? prev.slug : "hero");
          } else {
            const next = stops.find((x) => centreOf(x.el) > here + 40);
            glide(next ? next.slug : "end");
          }
          return;
        }
        // 1 … 6: straight to that world.
        if (/^[1-9]$/.test(e.key)) {
          const w = personas[Number(e.key) - 1];
          if (w) {
            e.preventDefault();
            glide(w.slug);
          }
          return;
        }
        // Enter: through the doorway of the setup under the pointer, or the one you are standing at.
        if (e.key === "Enter" && !s.portal && !s.rewind) {
          const here = sections[active];
          const slug = s.portalHover ?? (here?.kind === "persona" ? here.slug : null);
          if (slug) {
            e.preventDefault();
            if (experience === "normal") normalEnter.current?.(slug);
            else enterWorld(slug);
          }
          return;
        }
      }
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
  }, [gate, status, wear, startLight, sections, active, enterWorld, experience]);

  // ---- Smooth scroll + scroll → climb progress ---------------------------------
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduce ? null : new Lenis({ lerp: 0.14, wheelMultiplier: 0.9 });
    lenisRef.current = lenis;
    // The hub places its own scroll (a return lands on the chapter you left); the browser's restore
    // would fight it while the page is still finding its height.
    const prevRestore = history.scrollRestoration;
    history.scrollRestoration = "manual";

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
      if (Math.abs(window.scrollY - unfoldY.current) > 40) setFolded(true);
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
      history.scrollRestoration = prevRestore;
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Scroll is locked until the climb (or in Normal mode, once the gate is gone), and again while leaving.
  const scrollFree = gate === null && !entering && !rewinding && (experience === "normal" || phase === "climb");
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
    const interactive = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("a, button, input, label, iframe, [role='radio'], [role='alertdialog'], [role='dialog']");
    const lookable = () => immersiveLive && atLeast(s.phase, "sky");

    const move = (e: PointerEvent) => {
      s.px = (e.clientX / window.innerWidth) * 2 - 1;
      s.py = -((e.clientY / window.innerHeight) * 2 - 1);
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!s.dragging && Math.hypot(dx, dy) > 8) {
        if (e.pointerType === "mouse" && lookable()) {
          // Moving while held keeps time slow and looks around; moving early is a plain drag.
          if (!s.holding) window.clearTimeout(holdTimer);
          s.dragging = true;
          document.documentElement.classList.add("is-dragging");
        } else {
          window.clearTimeout(holdTimer);
          start = null; // touch: moving means scrolling
          s.holding = false;
          return;
        }
      }
      if (s.dragging) {
        // Drag right → look right, drag up → look up (first-person, Ratul's call).
        s.yaw = start.yaw + dx * 0.0042;
        s.pitch = Math.max(-0.6, Math.min(0.6, start.pitch + dy * 0.0032));
      }
    };
    const down = (e: PointerEvent) => {
      ambient.resume();
      if (e.button !== 0 || interactive(e.target) || !lookable()) return;
      // A finger arrives without a move: the scene needs the point for the doorway test.
      s.px = (e.clientX / window.innerWidth) * 2 - 1;
      s.py = -((e.clientY / window.innerHeight) * 2 - 1);
      start = { x: e.clientX, y: e.clientY, yaw: s.yaw, pitch: s.pitch, id: e.pointerId, at: performance.now(), type: e.pointerType };
      holdTimer = window.setTimeout(() => {
        if (s.phase === "sky") return; // a long press before the light is called does nothing
        s.holding = true;
        heldOnce.current = true;
        setHint(null);
        document.documentElement.classList.add("is-holding");
      }, 260);
    };
    const up = (e?: PointerEvent) => {
      window.clearTimeout(holdTimer);
      const wasTap = !!start && !s.dragging && !s.holding && e && performance.now() - start.at < 400;
      if (wasTap && s.phase === "sky") startLight();
      if (wasTap && s.phase === "climb" && s.portalHover) enterWorld(s.portalHover);
      if (s.dragging) s.lastDragEnd = performance.now();
      s.dragging = false;
      s.holding = false;
      start = null;
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
  }, [immersiveLive, startLight, enterWorld]);

  // ---- Text choreography ------------------------------------------------------
  const textLive = experience === "normal" ? gate === null : introDone;
  // The rail and the HUD open when the chrome first appears (the gate and the intro move the scroll themselves).
  useEffect(() => {
    if (textLive) unfold();
  }, [textLive, unfold]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const hero = root.querySelector<HTMLElement>("[data-hero-title]");
      const heroItems = root.querySelectorAll<HTMLElement>("[data-hero-item]");
      if (hero) {
        // `split-line` → the masks get `split-line-mask`, padded so descenders are not clipped.
        const split = SplitText.create(hero, { type: "lines,words", mask: "lines", linesClass: "split-line" });
        gsap.set(split.words, { yPercent: 125 });
        gsap.set(heroItems, { autoAlpha: 0, y: 24, filter: "blur(8px)" });
        if (textLive) {
          gsap.to(split.words, { yPercent: 0, duration: 1.5, ease: "expo.out", stagger: 0.07, delay: 0.3 });
          gsap.to(heroItems, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "expo.out", stagger: 0.12, delay: 0.8 });
        }
      }
      root.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        const split = SplitText.create(el, { type: "lines,words", mask: "lines", linesClass: "split-line" });
        gsap.from(split.words, {
          yPercent: 125,
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

  const activeKind = sections[active];
  const activeSlug = activeKind?.kind === "persona" ? activeKind.slug : null;
  const inIntro = immersiveLive && !introDone;

  return (
    <div
      ref={rootRef}
      className={`hub-v3 relative bg-[var(--void)] text-[var(--ink)] ${immersiveLive ? "is-immersive" : "is-normal"} ${textLive ? "" : "is-quiet"} ${entering || rewinding ? "is-entering" : ""}`}
    >
      {/* ---------- Backdrop ---------- */}
      <div aria-hidden className="fixed inset-0 z-0">
        <div className={`poster-alive absolute inset-0 transition-opacity duration-[1400ms] ${sceneWanted || !decided ? "opacity-0" : "opacity-100"}`}>
          <RefractionPoster bands={bands} />
        </div>
        {/* Normal mode: the same journey as a flat motion piece, over the still poster it started from. */}
        {decided && !sceneWanted && experience === "normal" ? (
          <>
            <NormalJourney state={vr} worlds={worlds} sectionT={sectionT} recede={normalRecede} />
            <div className="normal-grain absolute inset-0" />
          </>
        ) : null}
        {sceneWanted ? (
          <div className="absolute inset-0">
            <SceneBoundary onFail={onSceneFail}>
              <VrScene
                bands={bands}
                sectionT={sectionT}
                worlds={worlds}
                state={vr}
                quality={quality}
                onPhaseEnd={onPhaseEnd}
                onPortalHover={onPortalHover}
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
          className="hit font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase transition-colors hover:text-[var(--ink)]"
        >
          {DISPLAY_ROOT}
        </button>
        <div className="flex items-center gap-3 sm:gap-5">
          {ready && experience === "immersive" ? <QualityMenu value={quality} className="hidden md:block" /> : null}
          <span className="hidden sm:block">
            <SoundToggle />
          </span>
          <ModeSwitch />
        </div>
      </header>

      {/* ---------- Spectrum rail (every size): Top, the worlds, End. Folds to a strip on scroll. ---------- */}
      <nav aria-label="Chapters" className={`hub-rail ${textLive ? "is-on" : ""} ${folded ? "is-folded" : ""}`}>
        <button type="button" className="hub-rail-end" onClick={() => jump("hero")} aria-label="Back to the top">
          <span aria-hidden>▲</span>
          <span className="hub-rail-word">Top</span>
        </button>
        {folded ? (
          <button type="button" className="hub-rail-marks" onClick={unfold} aria-label="Open the chapters">
            {chapters.map((c) => {
              const on = activeSlug === c.slug;
              const color = spectrumColor(c.t);
              return <span key={c.slug} className="hub-rail-mark" style={{ height: on ? 22 : 6, backgroundColor: color, boxShadow: on ? `0 0 14px ${color}` : "none", opacity: on ? 1 : 0.5 }} />;
            })}
          </button>
        ) : (
          <div className="hub-rail-marks">
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
                  className="group hit flex items-center justify-end gap-3"
                >
                  <span className={`hub-rail-label font-mono text-[10px] tracking-[0.14em] text-[var(--ink-dim)] uppercase transition-opacity duration-[var(--dur-2)] max-lg:hidden ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    {id.role}
                  </span>
                  <span className="hub-rail-mark" style={{ height: on ? 34 : 10, backgroundColor: color, boxShadow: on ? `0 0 18px ${color}` : "none", opacity: on ? 1 : 0.55 }} />
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className="hub-rail-end" onClick={() => jump("end")} aria-label="Down to the end">
          <span aria-hidden>▼</span>
          <span className="hub-rail-word">End</span>
        </button>
      </nav>

      <main className="relative z-10">
        {/* ---------- Hero ---------- */}
        <section id="hero" data-section className="flex min-h-[100svh] items-end px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] sm:px-8 md:pb-14 lg:items-center lg:px-12 lg:pb-0">
          <div className="max-w-3xl">
            <h1 data-hero-title className="font-display text-[length:clamp(2.9rem,1rem+5.4vw,7rem)] leading-[0.96] tracking-[-0.02em] text-balance">
              <span className="block">One mind.</span>
              <span className="block italic text-[var(--ink-dim)]">Many perspectives.</span>
            </h1>
            <p data-hero-item className="mt-7 text-[length:var(--step-1)] text-[var(--ink-dim)]">
              {HUB_COPY.intro} <CyclingPhrase chapters={chapters} />
            </p>
            <p data-hero-item className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-[var(--ink-faint)] sm:text-xs">
              <CyclingLine lines={HUB_COPY.character} />
            </p>
          </div>
        </section>

        {/* ---------- Into the colour ---------- */}
        <section id="through" data-section className="flex min-h-[110svh] items-center justify-center px-4 text-center sm:px-8">
          <h2 data-split className="max-w-3xl font-display text-[length:var(--step-4)] leading-[0.98] tracking-[-0.015em]">
            {HUB_COPY.throughTitle}
          </h2>
        </section>

        {chapters.map((c, i) => (
          <PersonaChapter key={c.slug} chapter={c} index={i} total={chapters.length} waiting={(waiting ?? normalWaiting) === c.slug} warm={experience === "normal" && !sceneWanted && textLive} onEnter={immersiveLive && introDone ? enterWorld : experience === "normal" && !sceneWanted && textLive ? (slug) => normalEnter.current?.(slug) : undefined} />
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
        <section id="end" data-section className="flex min-h-[100svh] flex-col px-4 sm:px-8 lg:px-12">
          <div className="my-auto max-w-2xl pt-28 lg:max-w-3xl">
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
                <a
                  href="/Ratul_Roy_Resume.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="hit ml-3 inline-flex min-h-12 items-center rounded-full border border-[var(--line)] px-6 text-sm text-[var(--ink-dim)] transition-colors hover:text-[var(--ink)]"
                >
                  Résumé (PDF)
                </a>
                <p className="mt-4 font-mono text-xs text-[var(--ink-faint)]">{HUB_COPY.email}</p>
                {/* The same data as the terminal's `profiles`: work and social rows, plus GitHub. */}
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
                  {PROFILES.filter((p) => p.href && (p.group === "work" || p.group === "social" || p.id === "github")).map((p) => (
                    <li key={p.id}>
                      <a href={p.href} target="_blank" rel="noreferrer" className="hit inline-flex min-h-8 items-center text-[var(--ink-dim)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline">
                        {p.label}
                      </a>
                    </li>
                  ))}
                </ul>
                {immersiveLive && introDone ? (
                  // The one line in the empty sky (D38): click it and the journey rewinds to the headset.
                  <button type="button" onClick={rewind} className="vr-takeoff">
                    <span aria-hidden className="vr-takeoff-ring" />
                    Take off your headset
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <footer className="hub-footer mt-16 flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-[var(--ink-faint)] uppercase">
            <span>© {new Date().getFullYear()} Ratul Roy</span>
          </footer>
        </section>
      </main>

      {/* ---------- The guide: the HUD in the corner, every way around listed, always on ---------- */}
      <HubGuide
        on={ready && gate === null && !inIntro && !entering && !returning && !rewinding}
        touch={touch}
        immersive={experience === "immersive"}
        chapters={chapters.map((c) => ({ slug: c.slug, role: personaIdentity(c.slug).role, color: spectrumColor(c.t) }))}
        folded={folded}
        onToggle={toggleFold}
        onTop={() => jump("hero")}
        onEnd={() => jump("end")}
      />


      {/* ---------- Intro overlays ---------- */}
      {/* Before any script runs the page IS the loader: the gate's still parts, server-rendered.
          The live gate fades in over it in the same places; this fades away once the page has decided. */}
      <div aria-hidden className={`hub-boot fixed inset-0 z-[45] bg-[var(--void)] ${decided ? "is-done" : ""}`}>
        <GateSkeleton />
      </div>
      <div ref={flashRef} aria-hidden className="vr-flash fixed inset-0 z-40 opacity-0" />
      {entering ? (
        <div ref={enterRef} aria-hidden className="hub-enter fixed inset-0 z-[46] flex items-center justify-center opacity-0" style={{ "--c": spectrumColor(entering.t) } as CSSProperties}>
          <BootFrame slug={entering.slug as PersonaSlug} t={entering.t} items={terminalItems} photo={media.photographer?.[0] ? `/hub/photographer/${media.photographer[0]}` : undefined} />
        </div>
      ) : null}
      {returning ? (
        <div aria-hidden className="hub-return fixed inset-0 z-[46] flex items-center justify-center" style={{ "--dur": `${PORTAL_OUT_LENGTH}s` } as CSSProperties}>
          <ExitFrame slug={returning.slug as PersonaSlug} t={returning.t} items={terminalItems} photo={media.photographer?.[0] ? `/hub/photographer/${media.photographer[0]}` : undefined} />
        </div>
      ) : null}
      {blink || phase === "blink" ? (
        <svg aria-hidden className="vr-blink fixed inset-0 z-40 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {/* Soft lids: the opening is feathered, not cut. */}
            <radialGradient id="vr-eye-soft">
              <stop offset="55%" stopColor="#000" />
              <stop offset="100%" stopColor="#fff" />
            </radialGradient>
            <mask id="vr-eye">
              <rect width="100" height="100" fill="#fff" />
              <ellipse ref={eyeRef} cx="50" cy="50" rx={closing ? 260 : 0} ry={closing ? 260 : 0} fill="url(#vr-eye-soft)" />
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

      {ready ? <LightCursor /> : null}
      {decided && !sceneWanted && experience === "normal" && textLive ? (
        <NormalDisplays worlds={worlds} activeSlug={activeSlug} items={terminalItems} photo={media.photographer?.[0] ? `/hub/photographer/${media.photographer[0]}` : undefined} recedeRef={normalRecede} enterRef={normalEnter} onWaiting={setNormalWaiting} />
      ) : null}

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
          onWear={wear}
          onNormal={goNormal}
        />
      ) : null}
      {gate === "returning" ? (
        <div role="status" className="hub-wait fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[var(--void)]">
          {status === "failed" ? <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--ink-dim)] uppercase">3D couldn’t start</p> : <span aria-label="Loading" className="gate-ring is-spinning" style={{ width: 20, height: 20 }} />}
          <button type="button" onClick={goNormal} className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase underline-offset-4 hover:text-[var(--ink)] hover:underline">
            {status === "failed" ? "Continue in Normal view" : "Skip — Normal view"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PersonaChapter({ chapter, index, total, onEnter, waiting, warm }: { chapter: HubChapter; /** Normal mode: warm the destination on intent (Speculation Rules). */ warm?: boolean; index: number; total: number; /** The doorway heard the tap and waits for its setup to form. */ waiting?: boolean; /** Immersive: the button goes through the same doorway as the setup (the camera flies into its screen). */ onEnter?: (slug: string) => void }) {
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
      <div className="relative w-full max-w-2xl">
        {/* Phones, Normal mode: the chapter's drawings gather here, above its words (normal-journey measures it). */}
        <div id={`${chapter.slug}-art`} className="normal-art-slot" aria-hidden />
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
              onClick={(e) => {
                if (!onEnter) return;
                e.preventDefault();
                onEnter(chapter.slug);
              }}
              data-cursor-color={color}
              onPointerEnter={warm ? () => speculate(chapter.slug) : undefined}
              onPointerDown={warm ? () => speculate(chapter.slug) : undefined}
              onFocus={warm ? () => speculate(chapter.slug) : undefined}
              aria-busy={waiting || undefined}
              className={`hub-cta mt-10 inline-flex min-h-12 items-center gap-3 rounded-full border px-6 text-sm font-medium backdrop-blur-md ${waiting ? "is-waiting" : ""}`}
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
        {/* Phones, Normal mode: the chapter's display sits here, in the flow below its words (normal-displays). */}
        <div id={`${chapter.slug}-display`} className="normal-display-slot" aria-hidden />
      </div>
    </section>
  );
}

/** The character lines, one at a time, every 6 s (the first only, with reduced motion; both for screen readers). */
function CyclingLine({ lines }: { lines: readonly string[] }) {
  const [tick, setTick] = useState(0);
  const [cycling, setCycling] = useState(false);

  useEffect(() => {
    if (lines.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    queueMicrotask(() => setCycling(true));
    const id = window.setInterval(() => setTick((n) => n + 1), 6000);
    return () => window.clearInterval(id);
  }, [lines.length]);

  if (!cycling) return <>{lines[0]}</>;
  return (
    <>
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden key={tick} className="hub-phrase inline-block">
        {lines[tick % lines.length]}
      </span>
    </>
  );
}

/** "I build systems that stay up" → "I read markets, not rumours" → … Each lap of the personas advances the phrase, so a visitor who stays hears them all (the first of each, joined, with reduced motion). */
function CyclingPhrase({ chapters }: { chapters: HubChapter[] }) {
  const [tick, setTick] = useState(0);
  const [cycling, setCycling] = useState(false);
  const ids = chapters.map((c) => ({ id: personaIdentity(c.slug), color: spectrumColor(c.t) }));
  const count = ids.length;

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    queueMicrotask(() => setCycling(true));
    const id = window.setInterval(() => setTick((n) => n + 1), 2600);
    return () => window.clearInterval(id);
  }, [count]);

  const list = ids.map((p) => p.id.phrases[0]);
  const sentence = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
  const cur = count ? ids[tick % count] : undefined;
  const text = cur ? cur.id.phrases[Math.floor(tick / count) % cur.id.phrases.length] : "";
  if (!cycling) return <span className="text-[var(--ink)]">{sentence}.</span>;
  return (
    <>
      <span className="sr-only">{sentence}.</span>
      <span aria-hidden key={tick} className="hub-phrase inline-block" style={{ color: cur?.color }}>
        {text}.
      </span>
    </>
  );
}

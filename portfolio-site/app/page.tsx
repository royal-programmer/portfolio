"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import {
  ArrowRight,
  Briefcase,
  Camera,
  CandlestickChart,
  Lock,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { PERSONA_ORDER, usePersona, type Persona } from "./persona-provider";

type UiTheme = "system" | "light" | "dark";

const PERSONA_CONTENT = {
  engineer: {
    label: "Engineer Mode",
    eyebrow: "Developer + Software Engineer",
    heading: "I design fast, scalable web products with premium UX.",
    body: "Building clean systems, modern interfaces, and reliable backends from idea to launch.",
    accent: "#3b82f6",
    cta: "View engineering projects",
    points: ["Next.js + TypeScript", "System architecture", "API and backend integration"],
  },
  trader: {
    label: "Trader Mode",
    eyebrow: "Quant Mind + Risk Discipline",
    heading: "I track setups, probabilities, and execution with system-first thinking.",
    body: "Focused on process quality, risk control, and repeatable decisions across market cycles.",
    accent: "#22c55e",
    cta: "Explore trading journal",
    points: ["Risk-managed strategy", "Data-backed journaling", "Daily review workflow"],
  },
  photographer: {
    label: "Photographer Mode",
    eyebrow: "Lens Focus + Composition",
    heading: "I capture light, shape stories, and design visuals.",
    body: "From portraits to street scenes, I focus on framing, timing, and atmosphere.",
    accent: "#ec4899",
    cta: "View photography",
    points: ["Portrait lighting", "Street composition", "Editing + color grading"],
  },
} as const;

const PERSONA_BACKGROUNDS: Record<Persona, string> = {
  engineer:
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
  trader:
    'https://images.unsplash.com/photo-1559526324-593bc073d936?auto=format&fit=crop&w=1600&q=80',
  photographer:
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1600&q=80',
};

const KONAMI = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];

const THEME_OPTIONS: Array<{ value: UiTheme; label: string; icon: typeof Monitor }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const makeTypeSequence = (words: string[], pauseMs: number): Array<string | number> => {
  // react-type-animation: sequence alternates "next text" + "pause time".
  const seq: Array<string | number> = [];
  for (const word of words) seq.push(word, pauseMs);
  return seq;
};

const ENGINEER_WORDS = [
  "UI/UX Designer",
  "React Developer",
  "TypeScript",
  "Node.js",
  "Next.js",
  "Cloud Specialist",
  "API Builder",
];

const TRADER_WORDS = [
  "Price Action",
  "Risk Management",
  "Trading Systems",
  "Probabilistic Thinking",
  "Backtesting",
  "Execution Discipline",
  "Quant Mindset",
];

const ENGINEER_SEQUENCE = makeTypeSequence(ENGINEER_WORDS, 1400);
const TRADER_SEQUENCE = makeTypeSequence(TRADER_WORDS, 1400);

const PHOTOGRAPHER_WORDS = [
  "Photographer",
  "Portrait Lighting",
  "Street Photography",
  "Camera & Composition",
  "Color Grading",
  "Storytelling Frames",
];

const PHOTOGRAPHER_SEQUENCE = makeTypeSequence(PHOTOGRAPHER_WORDS, 1400);

export default function Home() {
  const { persona, setPersona } = usePersona();
  const [showFlash, setShowFlash] = useState(false);
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem("ui-theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    return "system";
  });
  const sequence = useRef<string[]>([]);
  const holdTimer = useRef<number | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const content = useMemo(() => PERSONA_CONTENT[persona], [persona]);

  const HOLD_MS = 1300;
  const DOUBLE_WINDOW_MS = 280;
  const lastDownRef = useRef<number>(0);
  const downStreakRef = useRef<number>(0);
  const holdTargetPersonaRef = useRef<Persona>("engineer");

  useEffect(() => {
    window.localStorage.setItem("ui-theme", uiTheme);
    if (uiTheme === "system") {
      document.documentElement.removeAttribute("data-ui-theme");
      return;
    }
    document.documentElement.setAttribute("data-ui-theme", uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!themeMenuRef.current) return;
      const target = event.target as Node | null;
      if (target && !themeMenuRef.current.contains(target)) setIsThemeMenuOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  const applyPersonaWithFlash = useCallback(
    (next: Persona) => {
      setShowFlash(true);
      setPersona(next);
      window.setTimeout(() => setShowFlash(false), 600);
    },
    [setPersona],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      sequence.current = [...sequence.current, event.key.toLowerCase()].slice(-10);
      if (KONAMI.every((k, i) => sequence.current[i] === k)) {
        setShowFlash(true);
        const idx = PERSONA_ORDER.indexOf(persona);
        setPersona(PERSONA_ORDER[(idx + 1) % PERSONA_ORDER.length]);
        window.setTimeout(() => setShowFlash(false), 600);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persona, setPersona]);

  const startHold = () => {
    holdTimer.current = window.setTimeout(() => {
      applyPersonaWithFlash(holdTargetPersonaRef.current);
      downStreakRef.current = 0;
    }, HOLD_MS);
  };

  const stopHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const onLogoPointerDown = () => {
    const now = Date.now();
    if (now - lastDownRef.current < DOUBLE_WINDOW_MS) downStreakRef.current += 1;
    else downStreakRef.current = 1;
    lastDownRef.current = now;

    const streak = Math.min(downStreakRef.current, 3);
    holdTargetPersonaRef.current =
      streak === 1 ? "engineer" : streak === 2 ? "trader" : "photographer";
    startHold();
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--page-bg)] text-[var(--fg)] transition-colors duration-700">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`bg-${persona}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage: `url("${PERSONA_BACKGROUNDS[persona]}")`,
            opacity: "var(--bg-image-opacity)",
          }}
        />
      </AnimatePresence>
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ backgroundColor: "var(--bg-overlay)" }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,var(--accent-glow),transparent_42%),radial-gradient(circle_at_20%_80%,var(--accent-glow-2),transparent_45%)]" />
      <motion.div
        animate={{ opacity: showFlash ? 0.3 : 0 }}
        className="pointer-events-none fixed inset-0 z-50 bg-white mix-blend-overlay"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <button
          onMouseDown={onLogoPointerDown}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={onLogoPointerDown}
          onTouchEnd={stopHold}
          className="group flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-xl"
          style={{
            backgroundColor: "var(--control-bg)",
            borderColor: "var(--control-border)",
            color: "var(--control-text)",
          }}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          RR Portfolio
          <Lock className="h-4 w-4 opacity-60 group-hover:opacity-100" />
        </button>
        <span
          className="rounded-full border px-4 py-2 text-sm backdrop-blur-xl"
          style={{ backgroundColor: "var(--control-bg)", borderColor: "var(--control-border)" }}
        >
          {content.label}
        </span>
        <div ref={themeMenuRef} className="relative">
          <motion.div
            layout
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="h-11 w-[252px] overflow-hidden rounded-full border p-1 backdrop-blur-xl"
            style={{ backgroundColor: "var(--control-bg)", borderColor: "var(--control-border)" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {!isThemeMenuOpen ? (
                <motion.button
                  key="theme-closed"
                  type="button"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  onClick={() => setIsThemeMenuOpen(true)}
                  className="flex h-full w-full items-center justify-center rounded-full text-sm text-[var(--fg)] transition-colors"
                  aria-expanded={false}
                  aria-label="Open theme controls"
                  style={{ backgroundColor: "var(--control-bg)" }}
                >
                  Theme
                </motion.button>
              ) : (
                <motion.div
                  key="theme-open"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="flex h-full items-center gap-1"
                >
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = uiTheme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setUiTheme(option.value);
                          setIsThemeMenuOpen(false);
                        }}
                        className={`inline-flex h-full flex-1 items-center justify-center gap-1 rounded-full px-2 text-xs transition-all sm:text-sm ${
                          active
                          ? "bg-[var(--control-hover)] text-[var(--fg)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_10px_28px_rgba(0,0,0,0.12)]"
                          : "text-[var(--muted)] hover:bg-[var(--control-hover)] hover:text-[var(--fg)]"
                        }`}
                        aria-pressed={active}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 pt-8 md:grid-cols-2 md:px-10 md:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          viewport={{ once: true, margin: "-50px" }}
          className="space-y-6 rounded-3xl border p-6 backdrop-blur-2xl"
          style={{
            backgroundColor: "var(--surface-bg)",
            borderColor: "var(--surface-border)",
            boxShadow: "var(--panel-shadow)",
          }}
        >
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">{content.eyebrow}</p>
          <p className="text-lg text-[var(--muted)] md:text-2xl">
            I am a{" "}
            <span className="font-semibold text-[var(--accent)]">
              <TypeAnimation
                key={persona}
                sequence={
                  persona === "engineer" ? ENGINEER_SEQUENCE : persona === "trader" ? TRADER_SEQUENCE : PHOTOGRAPHER_SEQUENCE
                }
                speed={55}
                deletionSpeed={38}
                repeat={Infinity}
                cursor
              />
            </span>
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">{content.heading}</h1>
          <p className="max-w-xl text-lg text-[var(--muted)]">{content.body}</p>
          <button className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-medium text-[var(--cta-fg)] transition-transform hover:scale-[1.03]">
            {content.cta}
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: "easeOut" }}
          viewport={{ once: true, margin: "-50px" }}
          className="rounded-3xl border p-6 backdrop-blur-2xl transition-all duration-700"
          style={{
            backgroundColor: "var(--panel-bg)",
            borderColor: "var(--panel-border)",
            boxShadow: "var(--panel-shadow)",
          }}
        >
          <div className="mb-4 flex items-center gap-2 text-sm text-[var(--muted)]">
            {persona === "engineer" ? (
              <Briefcase className="h-4 w-4" />
            ) : persona === "trader" ? (
              <CandlestickChart className="h-4 w-4" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            Identity Shift Panel
          </div>
          <div className="space-y-4">
            {content.points.map((point) => (
              <div
                key={point}
                className="rounded-2xl border px-4 py-3"
                style={{ backgroundColor: "var(--chip-bg)", borderColor: "var(--chip-border)" }}
              >
                {point}
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-[var(--muted)]">
            Easter egg hint: 1× click + hold → Engineer, 2× → Trader, 3× → Photographer (4×+ still Photographer).
            Refresh or reopen the site starts as Engineer; moving between pages keeps your persona. Konami code still cycles personas.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3 md:px-10">
        {["Projects", "Experience", "Contact"].map((title, idx) => (
          <motion.article
            key={title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            viewport={{ once: true }}
            className="rounded-3xl border p-6 backdrop-blur-xl"
            style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
          >
            <h3 className="mb-3 text-xl font-semibold">{title}</h3>
            <p className="text-[var(--muted)]">
              {title === "Projects" && "Selected work with product thinking, architecture depth, and polished UI."}
              {title === "Experience" && "Engineering discipline blended with market strategy and execution mindset."}
              {title === "Contact" && "Open to freelance, collaboration, and full-time opportunities."}
            </p>
          </motion.article>
        ))}
      </section>
    </main>
  );
}

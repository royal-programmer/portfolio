"use client";

/**
 * The hub — "one light, many colours".
 *
 * A white beam (Ratul) enters a prism and disperses into one ray per persona,
 * in true spectral order. Each ray lands on that world's door; worlds that
 * aren't launched yet are unlit rays. Lite mode renders the same composition
 * statically (see `.xp-motion` in globals.css).
 *
 * Desktop (lg+) uses one fixed-aspect stage so SVG rays and HTML doors share a
 * coordinate system (percentages of the same box). Smaller screens stack.
 */
import { useCallback, useRef, useState, type CSSProperties } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { DISPLAY_ROOT, personaIdentity } from "@/lib/site/brand";
import { PersonaLink } from "@/lib/site/persona-link";
import { ExperienceToggle } from "../experience-toggle";

export type HubDoor = { slug: PersonaSlug; live: boolean; eyebrow: string };

// Stage geometry, in SVG user units (viewBox 0 0 W H).
const W = 1600;
const H = 800;
const BEAM_Y = 430;
const ENTRY = { x: 580, y: BEAM_Y };
const EXIT = { x: 729, y: 410 };
const PRISM = "660,290 780,500 540,500";
const DOOR_X = 1030;
const BAND_TOP = 70;
const BAND_H = 660;

const doorY = (i: number, n: number) => BAND_TOP + ((i + 0.5) * BAND_H) / n;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

function rayPoints(y: number, spread = 16) {
  return `${EXIT.x},${EXIT.y - 3} ${EXIT.x},${EXIT.y + 3} ${DOOR_X},${y + spread} ${DOOR_X},${y - spread}`;
}

type Props = { doors: HubDoor[]; intro: string };

export function PrismHub({ doors, intro }: Props) {
  const [active, setActive] = useState<PersonaSlug | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = mainRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);

  const n = doors.length;

  return (
    <main
      ref={mainRef}
      onPointerMove={onPointerMove}
      className="hub xp-motion relative min-h-screen overflow-hidden bg-[var(--void)] text-[var(--ink)]"
    >
      {/* Cursor light (immersive only) */}
      <div aria-hidden className="hub-cursor-light xp-immersive-only pointer-events-none absolute inset-0" />

      {/* Top bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-[100rem] items-start justify-between gap-6 px-4 pt-5 sm:px-8 lg:px-12">
        <p className="hub-fade font-mono text-xs tracking-[0.2em] text-[var(--ink-faint)] uppercase">
          {DISPLAY_ROOT}
        </p>
        <ExperienceToggle align="end" className="hub-fade hidden sm:flex" />
      </header>

      {/* ---------- Desktop stage (lg+) ---------- */}
      <div className="relative z-10 mx-auto hidden w-full max-w-[100rem] px-12 lg:block">
        <div
          className="hub-stage relative w-full"
          style={{ aspectRatio: `${W} / ${H}` }}
        >
          {/*
            Glow — its own GPU layer: blurred once by CSS (not an SVG filter),
            and only the layer's opacity breathes. Cheap even on weak GPUs.
            Gradients are referenced from the main SVG below (ids are global).
          */}
          <svg
            aria-hidden
            viewBox={`0 0 ${W} ${H}`}
            className="hub-glow-layer xp-immersive-only absolute inset-0 h-full w-full overflow-visible"
          >
            <line className="hub-beam" x1="0" y1={BEAM_Y} x2={ENTRY.x} y2={ENTRY.y} stroke="#fff" strokeWidth="10" strokeOpacity="0.45" />
            {doors.map((d, i) =>
              d.live ? (
                <polygon
                  key={d.slug}
                  className="hub-ray"
                  style={{ "--i": i } as CSSProperties}
                  points={rayPoints(doorY(i, n), active === d.slug ? 26 : 18)}
                  fill={`url(#hub-ray-${d.slug})`}
                  opacity={active === null ? 0.6 : active === d.slug ? 1 : 0.08}
                />
              ) : null,
            )}
          </svg>

          <svg
            aria-hidden
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id="hub-beam-grad" x1="0" x2={ENTRY.x} y1="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.35" stopColor="#fff" stopOpacity="0.85" />
                <stop offset="1" stopColor="#fff" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="hub-prism-edge" x1="540" x2="780" y1="290" y2="500" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.4" />
              </linearGradient>
              {doors.map((d) => (
                <linearGradient
                  key={d.slug}
                  id={`hub-ray-${d.slug}`}
                  x1={EXIT.x}
                  x2={DOOR_X}
                  y1="0"
                  y2="0"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" style={{ stopColor: d.live ? personaIdentity(d.slug).wl : "var(--wl-unlit)" }} stopOpacity="1" />
                  <stop offset="1" style={{ stopColor: d.live ? personaIdentity(d.slug).wl : "var(--wl-unlit)" }} stopOpacity={d.live ? 0.5 : 0.35} />
                </linearGradient>
              ))}
            </defs>

            {/* Incoming white beam */}
            <line
              className="hub-beam"
              x1="0" y1={BEAM_Y} x2={ENTRY.x} y2={ENTRY.y}
              stroke="url(#hub-beam-grad)" strokeWidth="2.5" strokeLinecap="round"
            />

            {/* Rays */}
            {doors.map((d, i) => {
              const y = doorY(i, n);
              const dim = active !== null && active !== d.slug;
              const lit = active === d.slug;
              return (
                <g
                  key={d.slug}
                  className="hub-ray-wrap"
                  style={{ opacity: dim ? 0.18 : 1 } as CSSProperties}
                >
                  <polygon
                    className="hub-ray"
                    style={{ "--i": i } as CSSProperties}
                    points={rayPoints(y, d.live ? (lit ? 12 : 8) : 5)}
                    fill={`url(#hub-ray-${d.slug})`}
                    opacity={d.live ? 1 : 0.55}
                  />
                </g>
              );
            })}

            {/* Light inside the glass */}
            <line x1={ENTRY.x} y1={ENTRY.y} x2={EXIT.x} y2={EXIT.y} stroke="#fff" strokeOpacity="0.55" strokeWidth="2" className="hub-beam" />

            {/* Prism */}
            <g className="hub-prism">
              <polygon points={PRISM} fill="rgba(243,241,236,0.035)" stroke="url(#hub-prism-edge)" strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="660,290 700,360 620,360" fill="rgba(255,255,255,0.05)" />
            </g>
          </svg>

          {/* Identity — upper left, above the beam */}
          <div
            className="absolute left-0 flex flex-col justify-end"
            style={{ top: "4%", width: pct(560, W), height: pct(330, H) }}
          >
            <p className="hub-fade font-mono text-xs tracking-[0.24em] text-[var(--ink-faint)] uppercase" style={{ "--d": "0ms" } as CSSProperties}>
              Who am I
            </p>
            <h1
              className="hub-fade mt-3 font-display text-[length:var(--step-5)] leading-[0.86] tracking-[-0.02em]"
              style={{ "--d": "80ms" } as CSSProperties}
            >
              Ratul Roy
            </h1>
            <p
              className="hub-fade mt-4 font-display text-[length:var(--step-2)] italic text-[var(--ink-dim)]"
              style={{ "--d": "160ms" } as CSSProperties}
            >
              One light, many colours.
            </p>
          </div>

          {/* Intro — lower left, below the beam */}
          <div className="absolute left-0" style={{ top: pct(530, H), width: pct(520, W) }}>
            <p className="hub-fade max-w-md text-[length:var(--step-0)] leading-relaxed text-[var(--ink-dim)]" style={{ "--d": "240ms" } as CSSProperties}>
              {intro}
            </p>
          </div>

          {/* Doors — where each ray lands */}
          <ul className="absolute inset-0" aria-label="Worlds">
            {doors.map((d, i) => {
              const id = personaIdentity(d.slug);
              return (
                <li
                  key={d.slug}
                  className="absolute -translate-y-1/2"
                  style={{ left: pct(DOOR_X + 18, W), top: pct(doorY(i, n), H), width: pct(W - DOOR_X - 18, W) }}
                >
                  <div className="hub-door" style={{ "--i": i } as CSSProperties}>
                    <Door door={d} id={id} onActive={setActive} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ---------- Stacked layout (< lg) ---------- */}
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-10 pb-6 sm:px-8 lg:hidden">
        <p className="hub-fade font-mono text-xs tracking-[0.24em] text-[var(--ink-faint)] uppercase">Who am I</p>
        <h1 className="hub-fade mt-3 font-display text-[length:var(--step-5)] leading-[0.86] tracking-[-0.02em]" style={{ "--d": "80ms" } as CSSProperties}>
          Ratul Roy
        </h1>
        <p className="hub-fade mt-3 font-display text-[length:var(--step-2)] italic text-[var(--ink-dim)]" style={{ "--d": "160ms" } as CSSProperties}>
          One light, many colours.
        </p>

        <MiniPrism doors={doors} />

        <p className="hub-fade text-[length:var(--step-0)] leading-relaxed text-[var(--ink-dim)]" style={{ "--d": "240ms" } as CSSProperties}>
          {intro}
        </p>

        <ul className="mt-8 flex flex-col gap-2" aria-label="Worlds">
          {doors.map((d, i) => (
            <li key={d.slug} className="hub-door" style={{ "--i": i } as CSSProperties}>
              <Door door={d} id={personaIdentity(d.slug)} onActive={() => {}} stacked />
            </li>
          ))}
        </ul>

        <ExperienceToggle className="mt-10 flex sm:hidden" />
      </div>

      <footer className="relative z-10 mx-auto flex w-full max-w-[100rem] flex-wrap items-center justify-between gap-4 px-4 pt-6 pb-8 text-xs text-[var(--ink-faint)] sm:px-8 lg:px-12">
        <p>© {new Date().getFullYear()} Ratul Roy</p>
        <nav aria-label="Contact" className="flex gap-5">
          <a className="transition-colors hover:text-[var(--ink)]" href="https://github.com/royal-programmer" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="transition-colors hover:text-[var(--ink)]" href="mailto:ratul.arya.roy@gmail.com">
            Email
          </a>
        </nav>
      </footer>
    </main>
  );
}

function Door({
  door,
  id,
  onActive,
  stacked = false,
}: {
  door: HubDoor;
  id: ReturnType<typeof personaIdentity>;
  onActive: (slug: PersonaSlug | null) => void;
  stacked?: boolean;
}) {
  const title = id.handle ?? id.role;
  const host = `${id.subdomain}.${DISPLAY_ROOT}`;

  const body = (
    <>
      <span
        aria-hidden
        className="hub-door-dot mt-[0.55em] h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          backgroundColor: door.live ? id.wl : "var(--wl-unlit)",
          boxShadow: door.live ? `0 0 18px ${id.wl}` : "none",
        }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-display text-[length:var(--step-2)] leading-tight ${
            door.live ? "text-[var(--ink)]" : "text-[var(--ink-faint)]"
          }`}
        >
          {title}
          {door.live ? (
            <span aria-hidden className="hub-door-arrow ml-3 inline-block font-sans text-[length:var(--step-0)] text-[var(--ink-dim)]">
              →
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[11px] tracking-wide text-[var(--ink-faint)]">
          {door.live ? (
            <>
              <span style={{ color: id.wl }}>{id.subdomain}.</span>
              {DISPLAY_ROOT}
              {id.handle ? ` · ${id.role}` : ""}
            </>
          ) : (
            <>{id.role} · not lit yet</>
          )}
        </span>
      </span>
    </>
  );

  const base = `group flex items-start gap-4 rounded-2xl ${stacked ? "border border-[var(--line)] bg-[var(--glass)] px-4 py-3.5" : "px-2 py-1.5"}`;

  if (!door.live) {
    return (
      <div className={`${base} opacity-80`} aria-label={`${id.role} — coming later`}>
        {body}
      </div>
    );
  }

  return (
    <PersonaLink
      persona={door.slug}
      aria-label={`${title} — ${id.role} world at ${host}`}
      title={door.eyebrow}
      className={`${base} hub-door-link outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]`}
      onMouseEnter={() => onActive(door.slug)}
      onMouseLeave={() => onActive(null)}
      onFocus={() => onActive(door.slug)}
      onBlur={() => onActive(null)}
    >
      {body}
    </PersonaLink>
  );
}

/** Compact dispersion graphic for small screens (decorative). */
function MiniPrism({ doors }: { doors: HubDoor[] }) {
  const n = doors.length;
  return (
    <svg aria-hidden viewBox="0 0 400 170" className="my-8 h-auto w-full overflow-visible">
      <line className="hub-beam" x1="0" y1="92" x2="150" y2="92" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      {doors.map((d, i) => {
        const y = 14 + ((i + 0.5) * 142) / n;
        return (
          <polygon
            key={d.slug}
            className="hub-ray"
            style={{ "--i": i, transformOrigin: "190px 86px" } as CSSProperties}
            points={`190,85 190,87 400,${y + (d.live ? 5 : 2)} 400,${y - (d.live ? 5 : 2)}`}
            fill={d.live ? personaIdentity(d.slug).wl : "var(--wl-unlit)"}
            opacity={d.live ? 0.9 : 0.6}
          />
        );
      })}
      <polygon points="170,50 205,112 135,112" fill="rgba(243,241,236,0.04)" stroke="rgba(243,241,236,0.35)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

"use client";

/**
 * The hub, as a scroll story (D32):
 *   0  Hero — light falls on the prism; "One mind. Many perspectives."
 *   1…n One chapter per live persona, in rank order; the camera follows its band
 *   n+1 More colours on the way (upcoming personas flicker)
 *   n+2 Closing — the spectrum folds back into white light; contact
 *
 * The 3D scene (Immersive) is a fixed backdrop, lazy-loaded after first paint
 * over a static poster (which is also the whole backdrop in Lite). HTML owns
 * all content, so Lite / no-JS / screen readers get the full story.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { DISPLAY_ROOT, HUB_COPY, personaIdentity } from "@/lib/site/brand";
import { PersonaLink } from "@/lib/site/persona-link";
import { spectrumColor } from "@/lib/site/spectrum";
import { useExperience } from "../../experience-provider";
import { ExperienceToggle } from "../experience-toggle";
import { RefractionPoster } from "./refraction-poster";
import type { SceneFocus } from "./refraction-scene";

const RefractionScene = dynamic(() => import("./refraction-scene"), { ssr: false });

export type HubChapter = {
  slug: PersonaSlug;
  t: number;
  body: string;
  points: string[];
};
export type HubUpcoming = { slug: PersonaSlug; t: number };

type Props = { chapters: HubChapter[]; upcoming: HubUpcoming[] };

export function HubExperience({ chapters, upcoming }: Props) {
  const { experience, ready } = useExperience();
  const [degraded, setDegraded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [active, setActive] = useState<SceneFocus["chapter"]>("hero");
  const focus = useRef<SceneFocus>({ chapter: "hero" });

  const bands = [
    ...chapters.map((c) => ({ t: c.t, lit: true })),
    ...upcoming.map((u) => ({ t: u.t, lit: false })),
  ].sort((a, b) => a.t - b.t);
  // The scene indexes lit bands in spectrum order; map chapter → that index.
  const litOrder = [...chapters].sort((a, b) => a.t - b.t).map((c) => c.slug);

  const immersive = ready && experience === "immersive" && !degraded;

  // Which chapter is in view → camera focus + rail highlight.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-chapter]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const raw = (e.target as HTMLElement).dataset.chapter!;
          const value: SceneFocus["chapter"] =
            raw === "hero" || raw === "more" || raw === "end" ? raw : litOrder.indexOf(raw as PersonaSlug);
          focus.current.chapter = value;
          setActive(value);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
    // litOrder is derived from props; stable per render of the same data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters]);

  const jump = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const activeSlug = typeof active === "number" ? litOrder[active] : null;

  return (
    <div className="hub-v2 xp-motion relative bg-[var(--void)] text-[var(--ink)]">
      {/* ---------- Backdrop: poster always, 3D on top when immersive ---------- */}
      <div aria-hidden className="fixed inset-0 z-0">
        <div className={`absolute inset-0 transition-opacity duration-[1200ms] ${immersive && sceneReady ? "opacity-0" : "opacity-100"}`}>
          <RefractionPoster bands={bands} />
        </div>
        {immersive ? (
          <div className={`absolute inset-0 transition-opacity duration-[1200ms] ${sceneReady ? "opacity-100" : "opacity-0"}`}>
            <RefractionScene
              bands={bands}
              focus={focus}
              onReady={() => setSceneReady(true)}
              onDegrade={() => setDegraded(true)}
            />
          </div>
        ) : null}
        {/* Readability scrim behind the text column */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,10,0.92)_0%,rgba(7,7,10,0.6)_38%,rgba(7,7,10,0)_62%)] max-lg:bg-[linear-gradient(180deg,rgba(7,7,10,0.2)_0%,rgba(7,7,10,0.85)_55%,rgba(7,7,10,0.95)_100%)]" />
      </div>

      {/* ---------- Top bar ---------- */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-6 px-4 pt-5 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={() => jump("hero")}
          className="font-mono text-xs tracking-[0.2em] text-[var(--ink-faint)] uppercase transition-colors hover:text-[var(--ink)]"
        >
          {DISPLAY_ROOT}
        </button>
        <ExperienceToggle align="end" className="hidden sm:flex" />
      </header>

      {/* ---------- Spectrum rail (lg+) ---------- */}
      <nav aria-label="Chapters" className="fixed top-1/2 right-5 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        {chapters.map((c) => {
          const id = personaIdentity(c.slug);
          const on = activeSlug === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => jump(c.slug)}
              aria-label={`${id.role} chapter`}
              aria-current={on ? "true" : undefined}
              className="group flex items-center justify-end gap-3"
            >
              <span className={`font-mono text-[11px] text-[var(--ink-dim)] transition-opacity duration-[var(--dur-2)] ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                {id.role}
              </span>
              <span
                className="block rounded-full transition-all duration-[var(--dur-2)]"
                style={{
                  width: on ? 10 : 6,
                  height: on ? 28 : 6,
                  backgroundColor: spectrumColor(c.t),
                  boxShadow: on ? `0 0 16px ${spectrumColor(c.t)}` : "none",
                }}
              />
            </button>
          );
        })}
      </nav>

      <main className="relative z-10">
        {/* ---------- 0 · Hero ---------- */}
        <section id="hero" data-chapter="hero" className="flex min-h-[100svh] items-end px-4 pb-16 sm:px-8 lg:items-center lg:px-12 lg:pb-0">
          <div className="max-w-3xl">
            <h1 className="hub-fade font-display text-[length:var(--step-5)] leading-[0.9] tracking-[-0.02em]" style={{ "--d": "200ms" } as CSSProperties}>
              One mind.
              <br />
              <span className="italic text-[var(--ink-dim)]">Many perspectives.</span>
            </h1>
            <p className="hub-fade mt-6 text-[length:var(--step-1)] text-[var(--ink-dim)]" style={{ "--d": "450ms" } as CSSProperties}>
              {HUB_COPY.intro} <CyclingPhrase chapters={chapters} />
            </p>
            <div className="hub-fade mt-10 flex flex-wrap gap-2" style={{ "--d": "700ms" } as CSSProperties}>
              {chapters.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => jump(c.slug)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--glass)] px-4 text-sm text-[var(--ink-dim)] backdrop-blur-md transition-colors duration-[var(--dur-1)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                >
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: spectrumColor(c.t), boxShadow: `0 0 10px ${spectrumColor(c.t)}` }} />
                  {personaIdentity(c.slug).role}
                </button>
              ))}
            </div>
            <p className="hub-fade mt-14 font-mono text-[11px] tracking-[0.2em] text-[var(--ink-faint)] uppercase" style={{ "--d": "1100ms" } as CSSProperties}>
              Scroll to follow the light ↓
            </p>
          </div>
        </section>

        {/* ---------- 1…n · Persona chapters ---------- */}
        {chapters.map((c, i) => (
          <PersonaChapter key={c.slug} chapter={c} index={i} total={chapters.length} />
        ))}

        {/* ---------- More colours ---------- */}
        {upcoming.length ? (
          <section id="more" data-chapter="more" className="flex min-h-[80svh] items-center px-4 sm:px-8 lg:px-12">
            <div className="max-w-xl">
              <p className="font-mono text-xs tracking-[0.2em] text-[var(--ink-faint)] uppercase">Still refracting</p>
              <h2 className="mt-4 font-display text-[length:var(--step-4)] leading-[0.95]">{HUB_COPY.moreTitle}</h2>
              <ul className="mt-8 flex flex-wrap gap-2">
                {upcoming.map((u, i) => (
                  <li
                    key={u.slug}
                    className="hub-flicker inline-flex min-h-10 items-center gap-2 rounded-full border border-dashed border-[var(--line)] px-4 text-sm text-[var(--ink-faint)]"
                    style={{ "--i": i } as CSSProperties}
                  >
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: spectrumColor(u.t, 45) }} />
                    {personaIdentity(u.slug).role}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* ---------- Closing ---------- */}
        <section id="end" data-chapter="end" className="flex min-h-[100svh] flex-col justify-center px-4 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-display text-[length:var(--step-4)] leading-[0.95]">
              {/* One sentence per line: "Different perspectives." / "One person." */}
              {HUB_COPY.closingTitle.split(/(?<=\.)\s+/).map((line, i) => (
                <span key={i} className={`block ${i > 0 ? "italic text-[var(--ink-dim)]" : ""}`}>
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-6 max-w-lg text-[length:var(--step-0)] leading-relaxed text-[var(--ink-dim)]">{HUB_COPY.closingBody}</p>
            <a
              href={`mailto:${HUB_COPY.email}`}
              className="mt-10 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--ink)] px-6 text-sm font-medium text-[var(--void)] transition-transform duration-[var(--dur-2)] hover:-translate-y-0.5"
            >
              Say hello <span aria-hidden>→</span>
            </a>
            <p className="mt-4 font-mono text-xs text-[var(--ink-faint)]">{HUB_COPY.email}</p>
            <ExperienceToggle className="mt-12 flex sm:hidden" />
          </div>
          <footer className="mt-24 pb-8 text-xs text-[var(--ink-faint)]">© {new Date().getFullYear()} Ratul Roy</footer>
        </section>
      </main>
    </div>
  );
}

function PersonaChapter({ chapter, index, total }: { chapter: HubChapter; index: number; total: number }) {
  const id = personaIdentity(chapter.slug);
  const color = spectrumColor(chapter.t);
  return (
    <section
      id={chapter.slug}
      data-chapter={chapter.slug}
      aria-labelledby={`${chapter.slug}-title`}
      className="flex min-h-[100svh] items-center px-4 py-24 sm:px-8 lg:px-12"
    >
      <div className="hub-reveal max-w-2xl">
        <p className="flex items-center gap-3 font-mono text-xs tracking-[0.16em] text-[var(--ink-faint)] uppercase">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}` }} />
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · {id.role}
        </p>
        <h2 id={`${chapter.slug}-title`} className="mt-5 font-display text-[length:clamp(2.6rem,1.4rem+3.6vw,5.2rem)] leading-[0.95] tracking-[-0.01em] break-words">
          {id.handle ?? id.role}
        </h2>
        <p className="mt-3 font-display text-[length:var(--step-2)] italic" style={{ color }}>
          I {id.phrase}.
        </p>
        <p className="mt-6 max-w-xl text-[length:var(--step-0)] leading-relaxed text-[var(--ink-dim)]">{chapter.body}</p>
        {chapter.points.length ? (
          <ul className="mt-6 flex flex-wrap gap-2">
            {chapter.points.map((p) => (
              <li key={p} className="rounded-full border border-[var(--line)] bg-[var(--glass)] px-3 py-1.5 text-xs text-[var(--ink-dim)] backdrop-blur-md">
                {p}
              </li>
            ))}
          </ul>
        ) : null}
        <PersonaLink
          persona={chapter.slug}
          className="hub-cta mt-10 inline-flex min-h-12 items-center gap-3 rounded-full border px-6 text-sm font-medium backdrop-blur-md"
          style={{ "--c": color } as CSSProperties}
        >
          {id.cta}
          <span aria-hidden className="hub-cta-arrow">→</span>
        </PersonaLink>
        <p className="mt-3 font-mono text-[11px] text-[var(--ink-faint)]">
          <span style={{ color }}>{id.subdomain}.</span>
          {DISPLAY_ROOT}
        </p>
      </div>
    </section>
  );
}

/** "I build systems" → "I read markets" → … Lite: the full list, static. */
function CyclingPhrase({ chapters }: { chapters: HubChapter[] }) {
  const { experience, ready } = useExperience();
  const [i, setI] = useState(0);
  const phrases = chapters.map((c) => ({ text: personaIdentity(c.slug).phrase, color: spectrumColor(c.t) }));
  const cycling = ready && experience === "immersive" && phrases.length > 1;

  useEffect(() => {
    if (!cycling) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % phrases.length), 2400);
    return () => window.clearInterval(id);
  }, [cycling, phrases.length]);

  const list = phrases.map((p) => p.text);
  const sentence = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
  if (!cycling) return <span className="text-[var(--ink)]">{sentence}.</span>;

  return (
    <>
      {/* Screen readers get the whole sentence once, not a ticker. */}
      <span className="sr-only">{sentence}.</span>
      <span aria-hidden key={i} className="hub-phrase inline-block" style={{ color: phrases[i].color }}>
        {phrases[i].text}.
      </span>
    </>
  );
}

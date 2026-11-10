"use client";

/**
 * The scroll-driven story's words (S9): the Projects, Stack and Contact panels that sit beside the shelf, the
 * constellation and the window, and the dot rail that lists the four stops. The panels are plain DOM; the page
 * (world-stage.tsx) fades them with the scroll, so nothing here animates by itself.
 */
import { forwardRef } from "react";
import { createPortal } from "react-dom";
import { HUB_COPY, personaIdentity } from "@/lib/site/brand";
import { usePersonaHref } from "@/lib/site/persona-link";
import { STAGE_STOPS, STAGE_STORY_COPY } from "@/lib/site/stage-data";

/** A terminal link: the terminal reads `run` when it mounts, so it is a plain link (a full load), like the desk props. */
function useRunHref() {
  const dest = usePersonaHref("engineer", "/");
  return (cmd: string) => `${dest.href}${dest.href.includes("?") ? "&" : "?"}run=${encodeURIComponent(cmd)}&via=stage`;
}

const linkClass = "stage-panel-link";

export const StoryPanel = forwardRef<HTMLDivElement, { stop: 1 | 2 | 3; static?: boolean }>(function StoryPanel({ stop, static: isStatic }, ref) {
  const run = useRunHref();
  const side = STAGE_STOPS[stop].side;
  const handle = personaIdentity("engineer").handle ?? "royal-programmer";
  const copy = stop === 1 ? STAGE_STORY_COPY.shelf : stop === 2 ? STAGE_STORY_COPY.constellation : STAGE_STORY_COPY.window;
  return (
    <div ref={ref} className={`stage-panel ${isStatic ? "stage-panel-static" : ""}`} data-side={side} data-stop={stop}>
      <p className="stage-panel-eyebrow">{copy.eyebrow}</p>
      <h2 className="stage-panel-title">{copy.title}</h2>
      <p className="stage-panel-body">{copy.body}</p>
      {stop === 3 ? (
        <div className="stage-panel-links">
          <a className={linkClass} href={`mailto:${HUB_COPY.email}`}>
            mail
          </a>
          <a className={linkClass} href={run("hire")}>
            hire
          </a>
          <a className={linkClass} href={run("resume --pdf")}>
            resume --pdf
          </a>
          <a className={linkClass} href={`https://www.linkedin.com/in/${handle}`} target="_blank" rel="noreferrer">
            linkedin
          </a>
        </div>
      ) : (
        <div className="stage-panel-links">
          <a className={linkClass} href={run("cta" in copy ? copy.cta.cmd : "stack")}>
            {"cta" in copy ? copy.cta.label : "more"}
          </a>
        </div>
      )}
    </div>
  );
});

/** The right-edge dots: one per stop, a button each. */
export const StoryRail = forwardRef<HTMLElement, { active: number; color: string; onGo: (i: number) => void }>(function StoryRail({ active, color, onGo }, ref) {
  // On the body: the stage's ancestors carry transforms, which would turn `position: fixed` into "fixed to them".
  return createPortal(
    <nav ref={ref} className="stage-rail" style={{ ["--stage-c" as string]: color }} aria-label="Stage: jump to a stop">
      {STAGE_STOPS.map((s, i) => (
        <button key={s.id} type="button" className="stage-rail-dot" aria-label={s.label} aria-current={active === i ? "true" : undefined} data-active={active === i} onClick={() => onGo(i)}>
          <span className="stage-rail-label">{s.label}</span>
        </button>
      ))}
    </nav>,
    document.body,
  );
});

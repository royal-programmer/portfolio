"use client";

/**
 * A quiet "Hire me" pill on every host but the terminal (which has `hire`): a popover with the
 * résumé, an email, and the terminal's short version. Always there; nothing is remembered.
 */
import { useEffect, useRef, useState } from "react";
import { HUB_COPY } from "@/lib/site/brand";
import { PersonaLink } from "@/lib/site/persona-link";

export function HirePill({ on = true, hub = false }: { on?: boolean; hub?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // The popover must not outlive the pill (the hub hides it while the gate or a warp plays).
  const shown = open && on;

  return (
    <div ref={box} className={`hire-pill ${hub ? "is-hub" : ""} ${on ? "is-on" : ""}`} aria-hidden={!on}>
      {shown ? (
        <div className="hire-pill-pop" role="menu" aria-label="Résumé and contact">
          <a role="menuitem" href="/Ratul_Roy_Resume.pdf" target="_blank" rel="noreferrer">
            Résumé (PDF)
          </a>
          <a role="menuitem" href={`mailto:${HUB_COPY.email}`}>
            Email
          </a>
          <PersonaLink role="menuitem" persona="engineer" path="/?run=hire">
            Terminal: hire
          </PersonaLink>
          <PersonaLink role="menuitem" persona="engineer" path="/?run=fit">
            Fit check: paste a job description
          </PersonaLink>
        </div>
      ) : null}
      <button type="button" className="hire-pill-btn" aria-label="Résumé and contact" aria-expanded={shown} tabIndex={on ? 0 : -1} onClick={() => setOpen((o) => !o)}>
        Hire me
      </button>
    </div>
  );
}

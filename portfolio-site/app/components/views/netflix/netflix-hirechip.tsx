"use client";

/**
 * The persistent "Open to work" chip in the desktop top bar (17-persona-views.md section 29): one click from any screen
 * to the one-sentence fit line, the hire brief (copy), the résumé, mail, the book-a-call link and the Fit check.
 * Everything comes from the Hire sheet's data. Phones have the tab bar's Hire tab instead (this chip is hidden there).
 */
import { useEffect, useRef, useState } from "react";
import type { HireSheet } from "@/lib/site/netflix-data";
import { PersonaLink } from "@/lib/site/persona-link";
import { track } from "@/lib/site/track";

export function NetflixHireChip({ hire }: { hire: HireSheet }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hire.brief);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="nf-hirechip" ref={box}>
      <button
        type="button"
        className="nf-hirechip-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (!open) track("hire_open", "chip");
          setOpen((v) => !v);
        }}
      >
        <i aria-hidden /> Open to work
      </button>
      {open ? (
        <div className="nf-hirechip-pop" role="dialog" aria-label="Hiring">
          {hire.line ? <p className="nf-hirechip-line">{hire.line}</p> : null}
          <div className="nf-hirechip-acts">
            <button type="button" onClick={copy}>
              {copied ? "Copied" : "Hire brief"}
            </button>
            <a href={hire.resume} download>
              Résumé
            </a>
            {hire.email ? <a href={`mailto:${hire.email}`}>Mail</a> : null}
            {hire.book ? (
              <a href={hire.book.href} target="_blank" rel="noreferrer">
                {hire.book.label}
              </a>
            ) : null}
          </div>
          <PersonaLink persona="engineer" path="/?run=fit" hard className="nf-hirechip-fit">
            Fit check: paste a job description (stays in your browser)
          </PersonaLink>
        </div>
      ) : null}
    </div>
  );
}

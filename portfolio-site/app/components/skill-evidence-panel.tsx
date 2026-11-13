"use client";

/**
 * The skill evidence panel (17-persona-views.md section 27): what a skill is backed by, from the data only.
 * A modal on desktop, a bottom sheet on a phone. Esc closes (and is swallowed, so the view underneath does not
 * also react), Tab stays inside, and focus goes back to whatever opened it. Used by the terminal, the Netflix
 * view and anything else that lists skills; the caller supplies the evidence and the language.
 */
import { useEffect, useRef } from "react";
import "./skill-evidence-panel.css";
import { PersonaLink } from "@/lib/site/persona-link";
import type { SkillEvidence } from "@/lib/site/skill-evidence";
import { t, type Lang } from "@/lib/site/terminal-strings";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SkillEvidencePanel({ evidence, lang = "en", onClose }: { evidence: SkillEvidence; lang?: Lang; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box.current?.querySelector<HTMLElement>("[data-first]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        close.current();
        return;
      }
      if (e.key === "Tab" && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const at = document.activeElement;
        if (!box.current.contains(at)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && at === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && at === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      // Anything else typed belongs to the panel, not to the view under it (the terminal prompt, Netflix shortcuts).
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  const e = evidence;
  const title = `skill-ev-${e.name.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="skev-scrim" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div ref={box} className="skev" role="dialog" aria-modal="true" aria-labelledby={title} data-source={e.source}>
        <header className="skev-head">
          <div>
            <h2 id={title}>{e.name}</h2>
            {e.group ? <p className="skev-group">{t("skill.in", lang)(e.group)}</p> : null}
          </div>
          <button type="button" className="skev-x" data-first onClick={onClose} aria-label={t("skill.close", lang)}>
            ×
          </button>
        </header>
        <div className="skev-body">
          {e.source === "none" ? (
            <p className="skev-none">{t("skill.none", lang)}</p>
          ) : (
            <>
              {e.projects.length ? (
                <section>
                  <h3>{t("skill.projects", lang)}</h3>
                  <ul>
                    {e.projects.map((p) => (
                      <li key={p.slug}>
                        <PersonaLink persona="engineer" path={`/${p.slug}`} className="skev-link">
                          {p.title}
                        </PersonaLink>
                        {p.line ? <span className="skev-line">{p.line}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {e.work.length ? (
                <section>
                  <h3>{t("skill.work", lang)}</h3>
                  <ul>
                    {e.work.map((w) => (
                      <li key={w.id ?? `${w.role}-${w.company}`}>
                        <strong>{w.role}</strong> · {w.company}
                        <span className="skev-line">{w.period}</span>
                        {w.bullets.length ? (
                          <ul className="skev-bullets">
                            {w.bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {e.certs.length ? (
                <section>
                  <h3>{t("skill.certs", lang)}</h3>
                  <ul>
                    {e.certs.map((c) => (
                      <li key={`${c.id ?? c.issuer}-${c.name}`}>
                        {c.name}
                        <span className="skev-line">{c.issuer}</span>
                        {c.verify ? (
                          <a className="skev-link" href={c.verify} target="_blank" rel="noreferrer">
                            {t("skill.verify", lang)}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <p className="skev-foot">{t(e.source === "linked" ? "skill.linked" : "skill.matched", lang)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

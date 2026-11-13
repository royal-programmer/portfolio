"use client";

/**
 * The phone app chrome (17-persona-views.md §21, C4): a bottom tab bar (Home, Search, My List, Hire) in the safe
 * area, and the Hire bottom sheet (Email, the `hire --brief` text with Copy, the résumé PDF). Shown at 768px and
 * under (CSS); nothing here prevents default on a touch, so scrolling is never blocked.
 */
import { useEffect, useRef, useState } from "react";
import type { HireSheet } from "@/lib/site/netflix-data";
import { t, type Lang } from "@/lib/site/terminal-strings";
import { useForName } from "./use-for-name";
import { PersonaLink } from "@/lib/site/persona-link";

const FOCUSABLE = 'button:not([disabled]), a[href]';

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </>
  ),
  list: <path d="M12 5v14M5 12h14" />,
  hire: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 13h16" />
    </>
  ),
};

type Tab = "home" | "search" | "list" | "hire";

export function NetflixTabBar({ lang, active, listDot, onHome, onSearch, onList, onHire }: { lang: Lang; active: Tab; listDot: boolean; onHome: () => void; onSearch: () => void; onList: () => void; onHire: () => void }) {
  const items: Array<{ id: Tab; run: () => void }> = [
    { id: "home", run: onHome },
    { id: "search", run: onSearch },
    { id: "list", run: onList },
    { id: "hire", run: onHire },
  ];
  return (
    <nav className="nf-tabbar" aria-label="App">
      {items.map((it) => (
        <button key={it.id} type="button" className="nf-tabbar-btn" aria-current={active === it.id ? "page" : undefined} onClick={it.run}>
          <span className="nf-tabbar-ico" aria-hidden>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              {ICONS[it.id]}
            </svg>
            {it.id === "list" && listDot ? <i className="nf-tabbar-dot" /> : null}
          </span>
          <span className="nf-tabbar-label">{t(`nf.tab.${it.id}` as "nf.tab.home", lang)}</span>
        </button>
      ))}
    </nav>
  );
}

export function NetflixHireSheet({ lang, hire, onClose }: { lang: Lang; hire: HireSheet; onClose: () => void }) {
  const forName = useForName();
  const box = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key !== "Tab") return;
      const f = Array.from(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
    };
  }, [onClose]);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(hire.brief);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = hire.brief;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  // Swipe down on the handle closes it; the sheet follows the finger and nothing is prevented.
  const move = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d || !box.current) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    box.current.style.transform = `translateY(${d.dy}px)`;
  };
  const release = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !box.current) return;
    if (d.dy > 90) return onClose();
    box.current.style.transform = "";
  };

  return (
    <div className="nf-sheet-wrap">
      <div className="nf-sheet-back" onClick={onClose} aria-hidden />
      <div className="nf-sheet" ref={box} role="dialog" aria-modal="true" aria-label={t("nf.hire.title", lang)}>
        <div className="nf-sheet-handle" onTouchStart={(e) => (drag.current = { y: e.touches[0].clientY, dy: 0 })} onTouchMove={move} onTouchEnd={release}>
          <span aria-hidden />
        </div>
        <h2 className="nf-sheet-title">{t("nf.hire.title", lang)}</h2>
        {hire.line ? <p className="nf-sheet-line">{hire.line}</p> : null}
        {forName ? <p className="nf-sheet-hi">{t("nf.for.hi", lang).replace("{name}", forName)}</p> : null}
        {hire.email ? (
          <a className="nf-sheet-act" href={`mailto:${hire.email}`}>
            <span>{t("nf.hire.email", lang)}</span>
            <small>{hire.email}</small>
          </a>
        ) : null}
        <div className="nf-sheet-brief">
          <div className="nf-sheet-briefhead">
            <span>{t("nf.hire.brief", lang)}</span>
            <button type="button" className="nf-sheet-copy" onClick={copy}>
              {copied ? t("nf.hire.copied", lang) : t("nf.hire.copy", lang)}
            </button>
          </div>
          <pre>{hire.brief}</pre>
        </div>
        {hire.book ? (
          <a className="nf-sheet-act" href={hire.book.href} target="_blank" rel="noreferrer">
            <span>{hire.book.label}</span>
          </a>
        ) : null}
        <a className="nf-sheet-act" href={hire.resume} download>
          <span>{t("nf.hire.resume", lang)}</span>
          <small>PDF</small>
        </a>
        <PersonaLink persona="engineer" path="/?run=fit" className="nf-sheet-fit">
          Fit check: paste a job description (stays in your browser)
        </PersonaLink>
        <button type="button" className="nf-sheet-close" onClick={onClose}>
          {t("nf.hire.close", lang)}
        </button>
      </div>
    </div>
  );
}

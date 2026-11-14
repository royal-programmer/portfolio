"use client";

/**
 * The Fit check inside the Netflix view (17-persona-views.md section 30): a dialog (modal on desktop, bottom sheet on a
 * phone) with a paste box, and a match card in the Netflix idiom once it is checked. It reads the text with the terminal's
 * own matcher (`fitMatch`, terminal-fit.ts), in this tab only. The text is never stored and no event carries it:
 * `fit_check` records only the verdict level.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import "./netflix-fit.css";
import type { HireSheet } from "@/lib/site/netflix-data";
import type { SkillEvidence } from "@/lib/site/skill-evidence";
import { fitMatch, FIT_MAX, type FitPool, type FitResult } from "@/lib/site/terminal-fit";
import { t, type Lang } from "@/lib/site/terminal-strings";
import { track } from "@/lib/site/track";

const FOCUSABLE = "button:not([disabled]), a[href], textarea:not([disabled])";
const OPEN_EVENT = "nf-fit-open";

export type FitOpen = { source: string; el: HTMLElement | null; returnTo?: string };

/** Ask the view to open the Fit check. `returnTo` is a selector to focus on close when the opener is gone (a menu that closed). */
export function openFit(source: string, returnTo?: string): void {
  if (typeof window === "undefined") return;
  const el = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  window.dispatchEvent(new CustomEvent<FitOpen>(OPEN_EVENT, { detail: { source, el, returnTo } }));
}

export const onFitOpen = (fn: (d: FitOpen) => void): (() => void) => {
  const h = (e: Event) => fn((e as CustomEvent<FitOpen>).detail);
  window.addEventListener(OPEN_EVENT, h);
  return () => window.removeEventListener(OPEN_EVENT, h);
};

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="nf-fit-ring" viewBox="0 0 64 64" width="64" height="64" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="nf-fit-ring-bg" />
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="nf-fit-ring-fg" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" className="nf-fit-ring-n">
        {pct}%
      </text>
    </svg>
  );
}

type Props = {
  lang: Lang;
  hire: HireSheet;
  pool: FitPool;
  evidence?: Record<string, SkillEvidence>;
  opener: FitOpen;
  /** The skill evidence panel is open on top: keys and focus belong to it. */
  paused: boolean;
  onSkill: (name: string) => void;
  onClose: () => void;
};

export function NetflixFitSheet({ lang, hire, pool, evidence, opener, paused, onSkill, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<FitResult | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const closeRef = useRef(onClose);
  const pausedRef = useRef(paused);
  useEffect(() => {
    closeRef.current = onClose;
    pausedRef.current = paused;
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    area.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = Array.from(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!box.current?.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const { el, returnTo } = opener;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
      // After the page underneath is no longer inert.
      window.setTimeout(() => {
        if (document.querySelector(".nf-fitbox")) return;
        const back = el?.isConnected ? el : returnTo ? document.querySelector<HTMLElement>(returnTo) : null;
        back?.focus({ preventScroll: true });
      }, 30);
    };
  }, [opener]);

  const check = () => {
    if (!text.trim()) return;
    const r = fitMatch(text, pool);
    setResult(r);
    track("fit_check", r.level);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(".nf-fit-card")?.focus({ preventScroll: true }));
  };
  const again = () => {
    setResult(null);
    requestAnimationFrame(() => area.current?.focus({ preventScroll: true }));
  };

  const verdict = useMemo(() => {
    if (!result) return "";
    if (result.level === "none") return t("fit.none", lang);
    return t("fit.verdict", lang)(t(`fit.${result.level}` as "fit.strong", lang), result.pct ?? 0, result.total);
  }, [result, lang]);

  const mailto = useMemo(() => {
    if (!hire.email) return null;
    const seed = t("hb.seed", lang)(hire.seedRole, hire.seedStack);
    const body = result && result.level !== "none" ? `${seed}\n\n${verdict}` : seed;
    return `mailto:${hire.email}?subject=${encodeURIComponent(t("nf.fit.subject", lang))}&body=${encodeURIComponent(body)}`;
  }, [hire, lang, result, verdict]);

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(hire.brief);
    } catch {
      return;
    }
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

  const over = text.length > FIT_MAX;
  return (
    <div className="nf-fit-wrap" inert={paused ? true : undefined}>
      <div className="nf-fit-back" onClick={onClose} aria-hidden />
      <div className="nf-fitbox" ref={box} role="dialog" aria-modal="true" aria-labelledby="nf-fit-title">
        <div className="nf-fit-handle" onTouchStart={(e) => (drag.current = { y: e.touches[0].clientY, dy: 0 })} onTouchMove={move} onTouchEnd={release}>
          <span aria-hidden />
        </div>
        <h2 id="nf-fit-title" className="nf-fit-title">
          {t("nf.fit.title", lang)}
        </h2>
        {!result ? (
          <>
            <p className="nf-fit-lede">{t("nf.fit.lede", lang)}</p>
            <label className="nf-fit-label" htmlFor="nf-fit-text">
              {t("nf.fit.label", lang)}
            </label>
            <textarea
              id="nf-fit-text"
              ref={area}
              className="nf-fit-text"
              rows={7}
              value={text}
              placeholder={t("nf.fit.ph", lang)}
              aria-describedby="nf-fit-count nf-fit-private"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  check();
                }
              }}
            />
            <div className="nf-fit-meta">
              <span id="nf-fit-count" className={over ? "nf-fit-count nf-fit-over" : "nf-fit-count"}>
                {text.length.toLocaleString("en")} / {FIT_MAX.toLocaleString("en")}
                {over ? ` · ${t("fit.truncated", lang)(FIT_MAX / 1024)}` : ""}
              </span>
              <span className="nf-fit-keyhint">{t("nf.fit.keyhint", lang)}</span>
            </div>
            <p id="nf-fit-private" className="nf-fit-private">
              {t("nf.fit.private", lang)}
            </p>
            <div className="nf-fit-acts">
              <button type="button" className="nf-btn nf-btn-play" onClick={check} disabled={!text.trim()}>
                {t("nf.fit.run", lang)}
              </button>
              <button type="button" className="nf-btn nf-btn-glass" onClick={onClose}>
                {t("nf.close", lang)}
              </button>
            </div>
          </>
        ) : (
          <div className="nf-fit-result" role="region" aria-label={t("nf.fit.result", lang)}>
            <div className="nf-fit-card" tabIndex={-1} data-level={result.level}>
              {result.pct != null ? <Ring pct={result.pct} /> : null}
              <p className="nf-fit-verdict" role="status">
                {verdict}
              </p>
            </div>
            {result.truncated ? <p className="nf-fit-private">{t("fit.truncated", lang)(FIT_MAX / 1024)}</p> : null}
            {result.level === "partial" ? <p className="nf-fit-low">{t("nf.fit.low", lang)}</p> : null}
            {result.matched.length ? (
              <section className="nf-fit-group" data-kind="match">
                <h3>
                  {t("nf.fit.matches", lang)} <small>{result.matched.length}</small>
                </h3>
                <ul>
                  {result.matched.map((m) => {
                    const key = m.toLowerCase();
                    return (
                      <li key={m}>
                        {evidence?.[key] ? (
                          <button type="button" className="nf-fit-chip" title={t("nf.fit.evidence", lang)} onClick={() => onSkill(key)}>
                            {m}
                          </button>
                        ) : (
                          <span className="nf-fit-chip">{m}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {result.adjacent.length ? (
              <section className="nf-fit-group" data-kind="adjacent">
                <h3>
                  {t("nf.fit.adjacent", lang)} <small>{result.adjacent.length}</small>
                </h3>
                <p className="nf-fit-note">{t("nf.fit.adjnote", lang)}</p>
                <ul>
                  {result.adjacent.map((a) => (
                    <li key={a.want}>
                      <span className="nf-fit-chip">
                        {a.want}
                        {a.have && a.have !== a.want ? <em> → {a.have}</em> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {result.notYet.length ? (
              <section className="nf-fit-group" data-kind="not">
                <h3>
                  {t("nf.fit.notyet", lang)} <small>{result.notYet.length}</small>
                </h3>
                <ul>
                  {result.notYet.map((n) => (
                    <li key={n}>
                      <span className="nf-fit-chip">{n}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="nf-fit-acts nf-fit-links">
              {mailto ? (
                <a className="nf-btn nf-btn-play" href={mailto}>
                  {t("nf.fit.mail", lang)}
                </a>
              ) : null}
              <button type="button" className="nf-btn nf-btn-glass" onClick={copyBrief}>
                {copied ? t("nf.hire.copied", lang) : t("nf.fit.brief", lang)}
              </button>
              <a className="nf-btn nf-btn-glass" href={hire.resume} download>
                {t("nf.fit.resume", lang)}
              </a>
              {hire.book ? (
                <a className="nf-btn nf-btn-glass" href={hire.book.href} target="_blank" rel="noreferrer">
                  {hire.book.label}
                </a>
              ) : null}
              <button type="button" className="nf-btn nf-btn-glass" onClick={again}>
                {t("nf.fit.again", lang)}
              </button>
            </div>
            <p className="nf-fit-private">{t("nf.fit.private", lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * The full-screen player (17-persona-views.md §26, round 27). Play from a card, the hero, Continue watching or the modal opens this:
 * a fixed full-viewport dialog on black, rendered into the body so no transformed ancestor can shrink it. It owns the chrome (back
 * arrow and title top-left, Esc, F for the browser Fullscreen API, a focus trap, focus returned on close, controls that hide after
 * 3 s without input, a tap on a phone shows or hides them); what plays inside (the project trailer, or an episode's text and the
 * binge card) comes in as children. F never auto-requests fullscreen.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CHROME_HIDE_MS } from "@/lib/site/netflix-trailer";
import { t } from "@/lib/site/terminal-strings";

const FOCUSABLE = 'button:not([disabled]), a[href], select, input, [tabindex]:not([tabindex="-1"])';
const noop = () => () => {};
const canFullscreen = () => typeof document !== "undefined" && document.fullscreenEnabled === true;

export function Player({ title, meta, onBack, returnFocus, children }: { title: string; meta?: string; onBack: () => void; returnFocus: () => HTMLElement | null | undefined; children: React.ReactNode }) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  if (!client) return null;
  return createPortal(
    <Shell title={title} meta={meta} onBack={onBack} returnFocus={returnFocus}>
      {children}
    </Shell>,
    document.body,
  );
}

function Shell({ title, meta, onBack, returnFocus, children }: { title: string; meta?: string; onBack: () => void; returnFocus: () => HTMLElement | null | undefined; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [hide, setHide] = useState(false);
  const [fs, setFs] = useState(false);
  const timer = useRef(0);
  const back = useRef(onBack);
  const ret = useRef(returnFocus);
  useEffect(() => {
    back.current = onBack;
    ret.current = returnFocus;
  });

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHide(true), CHROME_HIDE_MS);
  }, []);
  const wake = useCallback(() => {
    setHide(false);
    arm();
  }, [arm]);

  // Open: focus the back arrow (after the modal underneath has taken its own focus); close: focus returns to Play.
  useEffect(() => {
    arm();
    const focus = window.setTimeout(() => root.current?.querySelector<HTMLElement>(".nf-pl-back")?.focus({ preventScroll: true }), 60);
    const prevOverflow = document.body.style.overflow;
    // The modal underneath already holds the scroll lock (and restores it); alone, the player takes and gives it back.
    const own = !document.querySelector(".nf-modal") && prevOverflow !== "hidden";
    if (own) document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(focus);
      if (own) document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      ret.current()?.focus({ preventScroll: true });
    };
  }, [arm]);

  const toggleFs = useCallback(() => {
    if (!canFullscreen()) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void root.current?.requestFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // Keys. On the document in the capture phase: after a child's own window handlers (Space, arrows, the binge card's Esc and
  // Enter), before the modal underneath, which must not also act. Esc goes back, F toggles fullscreen, Tab stays inside.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      wake();
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        back.current();
        return;
      }
      if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleFs();
        return;
      }
      if (e.key === "Tab") {
        const f = Array.from(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null || n === document.activeElement);
        if (f.length) {
          const active = document.activeElement;
          const inside = !!root.current?.contains(active);
          if (e.shiftKey && (active === f[0] || !inside)) {
            e.preventDefault();
            f[f.length - 1].focus();
          } else if (!e.shiftKey && (active === f[f.length - 1] || !inside)) {
            e.preventDefault();
            f[0].focus();
          }
        }
      }
      // Nothing else reaches the page or the modal behind (Backspace, letters).
      e.stopPropagation();
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [wake, toggleFs]);

  return (
    <div
      className="nf-pl"
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-chrome={hide ? "hide" : "show"}
      onPointerMove={(e) => {
        if (e.pointerType !== "touch") wake();
      }}
      onClick={(e) => {
        // A tap on a phone shows or hides the controls (a mouse click pauses, inside the trailer).
        if ((e.nativeEvent as PointerEvent).pointerType !== "touch" || (e.target as HTMLElement).closest("a, button")) return;
        if (hide) wake();
        else {
          window.clearTimeout(timer.current);
          setHide(true);
        }
      }}
    >
      <div className="nf-pl-top nf-pl-chrome">
        <button type="button" className="nf-pl-back" aria-label={t("nf.pl.back", "en")} onClick={() => back.current()}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 12H5M11 5l-7 7 7 7" />
          </svg>
        </button>
        <h2 className="nf-pl-title">{title}</h2>
        {meta ? <span className="nf-pl-meta">{meta}</span> : null}
        {canFullscreen() ? (
          <button type="button" className="nf-pl-fs" aria-label={fs ? t("nf.pl.fsexit", "en") : t("nf.pl.fs", "en")} aria-pressed={fs} title={`${fs ? t("nf.pl.fsexit", "en") : t("nf.pl.fs", "en")} (F)`} onClick={toggleFs}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {fs ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

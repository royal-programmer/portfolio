"use client";

/**
 * A contextual Hire bar (17-persona-views.md §22, D5): after two titles opened or 45 s on the page, a slim dismissible
 * bar slides in at the bottom (above the phone tab bar): `Open to work · Email · hire brief · Résumé`. Once per
 * session; a dismissal is remembered for 7 days (`xp-nf-hire-bar`). Never over a modal, the guided play or the Hire
 * sheet (`hold`); the end card lives in the modal, so it is covered by the same rule. Copy is the Hire sheet's data.
 */
import { useEffect, useState } from "react";
import { HIRE_BAR } from "@/lib/site/netflix-data";
import type { HireSheet } from "@/lib/site/netflix-data";

const KEY = "xp-nf-hire-bar";
const SESSION_KEY = "xp-nf-hire-bar-session";

const dismissedRecently = () => {
  try {
    const t = Number(window.localStorage.getItem(KEY));
    return !!t && Date.now() - t < HIRE_BAR.rememberDays * 86_400_000;
  } catch {
    return false;
  }
};
const shownThisSession = () => {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

export function NetflixHireBar({ hire, opens, hold }: { hire: HireSheet; opens: number; hold: boolean }) {
  const [timed, setTimed] = useState(false);
  const [gone, setGone] = useState(false);
  const [copied, setCopied] = useState(false);
  // Decided after mount (storage is only readable then); `null` until known.
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after mount
    setBlocked(dismissedRecently() || shownThisSession());
  }, []);
  useEffect(() => {
    if (blocked !== false) return;
    const t = window.setTimeout(() => setTimed(true), HIRE_BAR.afterMs);
    return () => window.clearTimeout(t);
  }, [blocked]);

  const ready = blocked === false && !gone && (timed || opens >= HIRE_BAR.afterOpens);
  const show = ready && !hold;
  useEffect(() => {
    if (!show) return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
  }, [show]);

  if (!show) return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setGone(true);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hire.brief);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {}
  };
  return (
    <aside className="nf-hirebar" aria-label="Hiring">
      <span className="nf-hirebar-t">
        <i aria-hidden /> Open to work
        <small>{hire.availability}</small>
      </span>
      <span className="nf-hirebar-a">
        {hire.book ? (
          <a href={hire.book.href} target="_blank" rel="noreferrer">
            {hire.book.label}
          </a>
        ) : null}
        {hire.email ? <a href={`mailto:${hire.email}`}>Email</a> : null}
        <button type="button" onClick={copy}>
          {copied ? "Copied" : "hire brief"}
        </button>
        <a href={hire.resume} download>
          Résumé
        </a>
      </span>
      <button type="button" className="nf-hirebar-x" aria-label="Dismiss for a week" onClick={dismiss}>
        <span aria-hidden>×</span>
      </button>
    </aside>
  );
}

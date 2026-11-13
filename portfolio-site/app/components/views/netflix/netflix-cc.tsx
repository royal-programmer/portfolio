"use client";

import type { useAd } from "./netflix-ad";
import { CC_HINT, LANG_LABEL, type SubLang } from "@/lib/site/netflix-subs";

/** The CC toggle (N8): `CC` plus the active language's label; with English it says how to pick one. */
export function CcButton({ cc, small, hint }: { cc: { on: boolean; lang: SubLang | null; toggle: () => void }; small?: boolean; hint?: boolean }) {
  const live = cc.on && !!cc.lang;
  const label = cc.lang ? (cc.on ? "Subtitles on" : "Subtitles off") : CC_HINT;
  return (
    <>
      <button type="button" className={`nf-round nf-cc${small ? " nf-round-s" : ""}`} aria-pressed={live} aria-label={label} title={label} data-lang={cc.lang ?? undefined} onClick={(e) => {
        e.stopPropagation();
        cc.toggle();
      }}>
        <span aria-hidden>CC</span>
        {cc.lang ? (
          <span className="nf-cc-lang" aria-hidden>
            {LANG_LABEL[cc.lang]}
          </span>
        ) : null}
      </button>
      {hint && !cc.lang ? <span className="nf-cc-hint">{CC_HINT}</span> : null}
    </>
  );
}

/** The AD toggle (D4), beside CC: `AD`, pressed while audio description is on; a note says when no voice matches. */
export function AdButton({ ad, small }: { ad: ReturnType<typeof useAd>; small?: boolean }) {
  if (!ad.supported) return null;
  const label = "AD, audio description";
  return (
    <>
      <button
        type="button"
        className={`nf-round nf-ad${small ? " nf-round-s" : ""}`}
        aria-pressed={ad.on}
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          ad.toggle();
        }}
      >
        <span aria-hidden>AD</span>
      </button>
      {ad.on && ad.note ? (
        <span className="nf-ad-note" role="status">
          {ad.note}
        </span>
      ) : null}
    </>
  );
}

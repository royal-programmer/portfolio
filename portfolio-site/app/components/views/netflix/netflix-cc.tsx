"use client";

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

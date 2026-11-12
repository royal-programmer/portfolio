"use client";

/**
 * The fixed top bar (17-persona-views.md §7): our R mark, Home / Series / My List, an expanding
 * search and the active profile's tile (the one door to Profiles). Transparent over the billboard, black after 80px of scroll. On phones
 * it keeps the mark, the search and the profile tile.
 */
import { useEffect, useRef, useState } from "react";
import { cleanFor, forLink, FOR_MAX, typeFor } from "@/lib/site/netflix-for";
import { VIEW_ICONS } from "@/lib/site/view-icons";
import { t } from "@/lib/site/terminal-strings";

type Props = {
  /** Shown beside the mark on phones, where the top bar is just the title and the profile tile. */
  title?: string;
  /** Bumped by the phone tab bar's Search tab: opens the search box. */
  searchToken?: number;
  glyph: string;
  tone: string;
  query: string;
  onQuery: (q: string) => void;
  /** A paste: return true when the text was taken as a job description (the box then stays as it is). */
  onPasteText?: (text: string) => boolean;
  onHome: () => void;
  onSeries: () => void;
  onMyList: () => void;
  onProfiles: () => void;
  /** Menu entries under Profiles; each is optional. */
  onClearHistory?: () => void;
  onReplay?: () => void;
  /** `Keyboard shortcuts` in the Profiles menu (N9). */
  onKeys?: () => void;
  /** The active profile id, for "Make a link for someone" (D1). */
  profile?: string;
};

export function NetflixTopbar({ title, searchToken = 0, glyph, tone, query, onQuery, onPasteText, onHome, onSeries, onMyList, onProfiles, onClearHistory, onReplay, onKeys, profile }: Props) {
  const [forDraft, setForDraft] = useState("");
  // E5: the copy never waits. A synchronous copy runs inside the press; when the browser refuses it, the link is shown in a
  // read-only field to select (and the async clipboard is tried in the background). No `window.prompt`, nothing awaited.
  const [forState, setForState] = useState<"idle" | "copied" | "manual">("idle");
  const [forUrl, setForUrl] = useState("");
  const forTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(forTimer.current), []);
  const copyFor = () => {
    const link = forLink(window.location.origin, profile ?? "recruiter", forDraft);
    setForUrl(link);
    const before = document.activeElement as HTMLElement | null;
    let ok = false;
    try {
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {}
    before?.focus({ preventScroll: true });
    window.clearTimeout(forTimer.current);
    if (ok) {
      setForState("copied");
      forTimer.current = window.setTimeout(() => setForState("idle"), 2200);
      return;
    }
    setForState("manual");
    try {
      void navigator.clipboard?.writeText(link).then(() => setForState("copied"), () => {});
    } catch {}
  };
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuBox = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const expanded = open || query !== "";

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 80);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // The Profiles menu closes on an outside press or Esc.
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (!menuBox.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setMenu(false);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc, true);
    };
  }, [menu]);
  const choose = (fn?: () => void) => () => {
    setMenu(false);
    fn?.();
  };

  const openSearch = () => {
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  };
  const lastToken = useRef(0);
  useEffect(() => {
    if (!searchToken || searchToken === lastToken.current) return;
    lastToken.current = searchToken;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tab bar lives outside this component and asks for the box
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  }, [searchToken]);
  const clear = () => {
    onQuery("");
    setOpen(false);
  };

  return (
    <header className="nf-bar" data-solid={solid || undefined} data-searching={expanded || undefined}>
      <button type="button" className="nf-bar-mark" style={{ color: VIEW_ICONS.netflix.fg }} onClick={onHome} aria-label="Home">
        R
      </button>
      {title ? <span className="nf-bar-title">{title}</span> : null}
      <nav className="nf-bar-nav" aria-label="Sections">
        <button type="button" onClick={onHome}>
          Home
        </button>
        <button type="button" onClick={onSeries}>
          Series
        </button>
        <button type="button" onClick={onMyList}>
          My List
        </button>
      </nav>
      <div className="nf-bar-right">
        <div className="nf-search-box" data-open={expanded || undefined} role="search">
          <button type="button" className="nf-search-btn" aria-label={expanded ? "Search" : "Open search"} aria-expanded={expanded} onClick={expanded ? () => input.current?.focus() : openSearch}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 21 21" />
            </svg>
          </button>
          <input
            ref={input}
            type="search"
            className="nf-search-input"
            placeholder="Titles, tags, tools"
            aria-label="Search titles, tags and tools"
            value={query}
            tabIndex={expanded ? 0 : -1}
            onChange={(e) => onQuery(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (onPasteText?.(text)) e.preventDefault();
            }}
            onBlur={() => !query && setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                clear();
                input.current?.blur();
              }
            }}
          />
          {query ? (
            <button type="button" className="nf-search-clear" aria-label="Clear search" onClick={clear}>
              ×
            </button>
          ) : null}
        </div>
        <div className="nf-pmenu-wrap" ref={menuBox}>
          <button type="button" className="nf-bar-profile" style={{ "--tone": tone } as React.CSSProperties} onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label="Profiles menu" title="Profiles">
            <span aria-hidden>{glyph}</span>
          </button>
          {menu ? (
            <div
              className="nf-pmenu"
              role="menu"
              aria-label="Profiles"
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button"));
                const i = items.indexOf(document.activeElement as HTMLElement);
                items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
              }}
            >
              <button type="button" role="menuitem" onClick={choose(onProfiles)}>
                Switch profile
              </button>
              {onReplay ? (
                <button type="button" role="menuitem" onClick={choose(onReplay)}>
                  Replay the recruiter cut
                </button>
              ) : null}
              {onKeys ? (
                <button type="button" role="menuitem" onClick={choose(onKeys)}>
                  Keyboard shortcuts
                </button>
              ) : null}
              {onClearHistory ? (
                <button type="button" role="menuitem" onClick={choose(onClearHistory)}>
                  Clear watch history
                </button>
              ) : null}
              {profile ? (
                <form
                  className="nf-pmenu-for"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void copyFor();
                  }}
                >
                  <label htmlFor="nf-for-in">{t("nf.for.make", "en")}</label>
                  <input id="nf-for-in" type="text" inputMode="text" autoComplete="off" maxLength={FOR_MAX} value={forDraft} placeholder={t("nf.for.ph", "en")} onChange={(e) => {
                      setForDraft(typeFor(e.target.value));
                      setForState("idle");
                    }} />
                  <button type="submit" disabled={!cleanFor(forDraft)}>
                    {forState === "copied" ? t("nf.for.copied", "en") : t("nf.for.copy", "en")}
                  </button>
                  {forState === "manual" ? (
                    <>
                      <p className="nf-pmenu-for-note" role="status">
                        {t("nf.for.manual", "en")}
                      </p>
                      <input type="text" readOnly aria-label={t("nf.for.link", "en")} value={forUrl} onFocus={(e) => e.currentTarget.select()} ref={(el) => el?.select()} />
                    </>
                  ) : null}
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

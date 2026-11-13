"use client";

/**
 * Keyboard and remote-control navigation for the Netflix view (17-persona-views.md §7, N9). One window
 * listener drives a roving focus over the page's lines (top bar, hero buttons, then every row): the arrows move,
 * Enter opens (a focused card is a button), `/` searches, `m` mutes, `p` opens Profiles, `?` shows the keys.
 * Nothing here touches touch or wheel scrolling. Where a card is focused it is announced politely.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Anything a remote can land on in the page body. Cast tiles and cards are plain buttons; poster cards carry the attribute on their title. */
const CARD = "[data-nf-card], [data-nf-nav]";

const visible = (el: HTMLElement) => el.offsetParent !== null || el.getClientRects().length > 0;

/** The page's navigable lines, top to bottom: the top bar, the hero's buttons, then each row's cards. */
function lines(): HTMLElement[][] {
  const all = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(visible);
  const out: HTMLElement[][] = [];
  const bar = all(".nf-bar button, .nf-bar a");
  if (bar.length) out.push(bar);
  const hero = all(".nf-hero .nf-actions button, .nf-hero .nf-actions a");
  if (hero.length) out.push(hero);
  for (const row of document.querySelectorAll<HTMLElement>(".nf-rows .nf-row, .nf-results .nf-search")) {
    const cards = Array.from(row.querySelectorAll<HTMLElement>(CARD)).filter(visible);
    if (cards.length) out.push(cards);
  }
  return out;
}

const center = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2;
};

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
};

/** "Work seasons · 3 of 8 · Title": the words a screen reader hears when a card gets focus. */
function describe(el: HTMLElement): string | null {
  const row = el.closest<HTMLElement>(".nf-row, .nf-search");
  if (!row || !el.matches(CARD)) return null;
  const head = row.querySelector<HTMLElement>(".nf-row-title");
  const title = (head?.firstChild?.textContent ?? head?.textContent ?? "").replace(/\s+/g, " ").trim();
  const cards = Array.from(row.querySelectorAll<HTMLElement>(CARD));
  const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
  return `${title} · ${cards.indexOf(el) + 1} of ${cards.length} · ${name}`;
}

type Opts = {
  /** The detail modal is open: the page keeps out of the way. */
  modalOpen: boolean;
  toggleMute: () => void;
  toggleKeys: () => void;
  keysOpen: boolean;
};

/** Installs the listeners; returns what the polite live region should say. */
export function useNetflixKeys({ modalOpen, toggleMute, toggleKeys, keysOpen }: Opts): string {
  const [said, setSaid] = useState("");
  const latest = useRef({ modalOpen, toggleMute, toggleKeys, keysOpen });
  useEffect(() => {
    latest.current = { modalOpen, toggleMute, toggleKeys, keysOpen };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = latest.current;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (typing(e.target)) return;
      if (e.key === "?") {
        if (o.modalOpen) return;
        e.preventDefault();
        o.toggleKeys();
        return;
      }
      if (o.modalOpen || o.keysOpen) return;
      // The Profiles menu and the trailer keep their own keys.
      if (document.querySelector(".nf-pmenu")) return;
      if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(".nf-search-input");
        if (document.activeElement !== input) document.querySelector<HTMLElement>(".nf-search-btn")?.click();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        o.toggleMute();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        document.querySelector<HTMLElement>(".nf-bar-profile")?.click();
        requestAnimationFrame(() => document.querySelector<HTMLElement>(".nf-pmenu button")?.focus());
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const grid = lines();
      if (!grid.length) return;
      const here = document.activeElement as HTMLElement | null;
      let row = -1;
      let col = -1;
      grid.forEach((cells, r) => {
        const c = here ? cells.indexOf(here) : -1;
        if (c >= 0) {
          row = r;
          col = c;
        }
      });
      e.preventDefault();
      // The first press, with nothing of ours focused: land on the first card.
      if (row < 0) {
        const firstRow = grid.findIndex((cells) => cells[0]?.matches(CARD));
        grid[firstRow >= 0 ? firstRow : 0][0].focus();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const to = grid[row][col + (e.key === "ArrowRight" ? 1 : -1)];
        to?.focus();
        return;
      }
      const next = grid[row + (e.key === "ArrowDown" ? 1 : -1)];
      if (!next) return;
      const x = center(grid[row][col]);
      let best = next[0];
      for (const el of next) if (Math.abs(center(el) - x) < Math.abs(center(best) - x)) best = el;
      best.focus();
      if (best.matches(CARD)) best.closest(".nf-row, .nf-search")?.scrollIntoView({ block: "center", behavior: "auto" });
    };
    const onFocus = (e: FocusEvent) => {
      const s = describe(e.target as HTMLElement);
      if (s) setSaid(s);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return said;
}

const KEYS: Array<[string, string]> = [
  ["← →", "Move along a row"],
  ["↑ ↓", "Move between rows, the Play buttons and the top bar"],
  ["Enter", "Open the card"],
  ["Esc · Backspace", "Close the card or this list"],
  ["→ in a card", "Next episode (the season's last one ends on a card of its own)"],
  ["/", "Search"],
  ["m", "Mute or unmute"],
  ["p", "Profile menu (the avatar, top right)"],
  ["?", "This list"],
];

/** The `?` overlay: every key, dismissible with Esc, `?`, the button or a click outside. */
export function KeysOverlay({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      before?.focus?.({ preventScroll: true });
    };
  }, [close]);
  return (
    <div className="nf-keys" onClick={close}>
      <div className="nf-keys-box" ref={box} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        <dl>
          {KEYS.map(([k, d]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="nf-btn nf-btn-glass" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}

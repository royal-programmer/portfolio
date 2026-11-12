"use client";

/**
 * Wraps a persona view (a branch of the page): remembers it as the visitor's pick, and offers the
 * way back — Esc, or the "exit" action in the corner — which forgets the pick and returns to the
 * page's root (the terminal), so the root is default again until the next pick.
 */
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { LaunchedPersona } from "@/lib/content/types";
import { personaHref, useOrigin } from "@/lib/site/persona-link";
import { forgetView, rememberView } from "@/lib/site/view-memory";

/** The shell's exit, for a view that wants its own "back to the terminal" control. */
const ExitContext = createContext<(() => void) | null>(null);
export const useViewExit = () => useContext(ExitContext);

type Props = { persona: LaunchedPersona; view: string; /** Arrived from the terminal (`?via=terminal`): the parameter is taken off the address bar. */ stripVia?: boolean; children: ReactNode };

export function ViewShell({ persona, view, stripVia, children }: Props) {
  const router = useRouter();
  const origin = useOrigin();
  const root = useMemo(() => personaHref(origin, persona, "/"), [origin, persona]);

  // A view always scrolls: drop any lock the hub left on the document (see hub-experience's scroll-locked effect).
  useEffect(() => {
    document.documentElement.classList.remove("scroll-locked");
  }, []);

  useEffect(() => {
    rememberView(persona, view);
  }, [persona, view]);

  useEffect(() => {
    if (!stripVia) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("via")) {
        u.searchParams.delete("via");
        window.history.replaceState(window.history.state, "", u);
      }
    } catch {}
  }, [stripVia]);

  const exit = useCallback(() => {
    forgetView(persona);
    // A direct load (no history behind it, or a cross-host root) takes a full navigation: the client router can answer
    // from a cached root that still points at this view and appear to do nothing.
    if (root.crossOrigin || window.history.length <= 1) window.location.assign(root.href);
    else router.push(root.href);
  }, [persona, root, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // A page panel that is open closes on Esc itself; this Esc is not ours.
      if (document.querySelector('[role="dialog"], [aria-expanded="true"], [aria-modal="true"]')) return;
      exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  return (
    <ExitContext.Provider value={exit}>
      {children}
      <div className="view-exit" role="toolbar" aria-label="View">
        <button type="button" onClick={exit} title="Back to the terminal (Esc)">
          <span aria-hidden>←</span> back to terminal
        </button>
      </div>
    </ExitContext.Provider>
  );
}

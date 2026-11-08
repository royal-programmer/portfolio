"use client";

/**
 * Wraps a persona view (a branch of the page): remembers it as the visitor's pick, and offers the
 * way back — Esc, or the "exit" action in the corner — which forgets the pick and returns to the
 * page's root (the terminal), so the root is default again until the next pick.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import type { LaunchedPersona } from "@/lib/content/types";
import { personaHref, useOrigin } from "@/lib/site/persona-link";
import { forgetView, rememberView } from "@/lib/site/view-memory";

type Props = { persona: LaunchedPersona; view: string; children: ReactNode };

export function ViewShell({ persona, view, children }: Props) {
  const router = useRouter();
  const origin = useOrigin();
  const root = useMemo(() => personaHref(origin, persona, "/"), [origin, persona]);

  useEffect(() => {
    rememberView(persona, view);
  }, [persona, view]);

  const exit = useCallback(() => {
    forgetView(persona);
    if (root.crossOrigin) window.location.assign(root.href);
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
    <>
      {children}
      <div className="view-exit" role="toolbar" aria-label="View">
        <button type="button" onClick={exit} title="Back to the terminal (Esc)">
          <span aria-hidden>⌂</span> exit
        </button>
      </div>
    </>
  );
}

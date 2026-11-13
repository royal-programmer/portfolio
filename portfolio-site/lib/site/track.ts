"use client";

/**
 * The visitor-event helper (17-persona-views.md section 29): `track(kind, ref?)`. No cookie, no storage:
 * the session id lives in a module variable, so it is gone when the tab is. Events queue for a moment and
 * leave in one beacon to /api/e. It does nothing when the browser says Do Not Track / Global Privacy
 * Control, and in development it only logs to the console. Never throws.
 */
import type { EventKind, EventView } from "./events";

type Ctx = { persona: string; view: EventView; profile?: string };

let ctx: Ctx = { persona: "engineer", view: "hub" };
let session: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let hooked = false;
const queue: { kind: EventKind; ref?: string }[] = [];

const optedOut = () => {
  if (typeof navigator === "undefined") return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.doNotTrack === "1" || n.globalPrivacyControl === true;
};

/** Say which world and view the visitor is in (and the Netflix profile, once chosen). */
export function setTrackContext(next: Partial<Ctx>): void {
  ctx = { ...ctx, ...next };
}

function sessionId(): string {
  if (!session) session = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
  return session;
}

function referrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const h = new URL(document.referrer).hostname;
    return h && h !== location.hostname ? h.slice(0, 80) : undefined;
  } catch {
    return undefined;
  }
}

function flush(): void {
  timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  try {
    const body = JSON.stringify({
      persona: ctx.persona,
      view: ctx.view,
      profile: ctx.profile,
      session: sessionId(),
      lang: (navigator.language || "en").slice(0, 2).toLowerCase(),
      device: window.innerWidth < 768 ? "phone" : "desktop",
      referrer_host: referrerHost(),
      events,
    });
    if (process.env.NODE_ENV !== "production") {
      console.debug("[track]", events.map((e) => (e.ref ? `${e.kind}:${e.ref}` : e.kind)).join(", "));
      return;
    }
    if (!navigator.sendBeacon?.("/api/e", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/e", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
    }
  } catch {}
}

export function track(kind: EventKind, ref?: string): void {
  try {
    if (typeof window === "undefined" || optedOut()) return;
    if (!hooked) {
      hooked = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
    }
    queue.push({ kind, ref: ref ? ref.slice(0, 80) : undefined });
    if (queue.length >= 10) flush();
    else if (!timer) timer = setTimeout(flush, 2000);
  } catch {}
}

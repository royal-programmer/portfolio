"use client";

import { useEffect, useState } from "react";

const CHANNEL = "terminal:engineer";

/**
 * "n here now", honestly: Supabase Realtime presence on one public channel. No table, nothing persisted;
 * each tab tracks a random id and the time it joined, and nothing else. Joins 3 s after `enabled` turns
 * true, leaves on pagehide, stays out of the way on a data-saver connection. If the environment is missing
 * or the connection fails the count stays 0 and nothing is logged.
 */
export function usePresence(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    let live = true;
    let leave = () => {};
    const timer = window.setTimeout(async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
        const { getBrowserClient } = await import("@/lib/db/browser");
        if (!live) return;
        const client = getBrowserClient();
        const id = Math.random().toString(36).slice(2, 12);
        const ch = client.channel(CHANNEL, { config: { presence: { key: id } } });
        let left = false;
        leave = () => {
          if (left) return;
          left = true;
          try {
            void ch.untrack();
            void client.removeChannel(ch);
          } catch {}
        };
        ch.on("presence", { event: "sync" }, () => {
          if (live && !left) setCount(Object.keys(ch.presenceState()).length);
        });
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") void ch.track({ id, at: Date.now() });
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (live && !left) setCount(0);
            if (status !== "CLOSED") leave();
          }
        });
      } catch {
        // Presence is a nicety; a failure shows nothing.
      }
    }, 3000);
    const onHide = () => leave();
    window.addEventListener("pagehide", onHide);
    return () => {
      live = false;
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", onHide);
      leave();
      setCount(0);
    };
  }, [enabled]);
  return count;
}

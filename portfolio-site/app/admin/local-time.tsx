"use client";

/**
 * A timestamp in the viewer's own locale and time zone. The server does not know either, so the server render
 * and the first client render show the same stable UTC text; the local text swaps in once hydrated. This keeps
 * React from discarding the server HTML with a hydration mismatch.
 */
import { useSyncExternalStore } from "react";

const noop = () => () => {};

export function LocalTime({ iso }: { iso: string }) {
  const local = useSyncExternalStore(noop, () => new Date(iso).toLocaleString(), () => "");
  const stable = iso.replace("T", " ").slice(0, 16) + " UTC";
  return <time dateTime={iso} suppressHydrationWarning>{local || stable}</time>;
}

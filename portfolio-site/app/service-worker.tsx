"use client";

import { useEffect } from "react";

/** localStorage flag that turns the service worker on in `next dev` (production always has it). */
export const SW_DEV_FLAG = "xp-sw-dev";

/** Chrome's install prompt, held until the terminal's `install` command asks for it. */
export type InstallPrompt = { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

declare global {
  interface Window {
    __xpInstall?: InstallPrompt;
    /** Set once a new worker has taken over a page that already had one; the terminal reads it for "update ready". */
    __xpSwUpdated?: boolean;
  }
}

/**
 * Registers /sw.js (scope "/") after the page has loaded. Production builds always do; in dev only
 * when `localStorage["xp-sw-dev"] === "1"` (set it in the console, reload; remove it and reload to
 * switch the worker off again, which also unregisters it). When a new worker takes over, it
 * dispatches `xp-sw-update` on window for the status bar.
 */
export function ServiceWorker() {
  // The install prompt is independent of the worker: keep it for `install`.
  useEffect(() => {
    const hold = (e: Event) => {
      e.preventDefault();
      window.__xpInstall = e as unknown as InstallPrompt;
    };
    const done = () => {
      window.__xpInstall = undefined;
    };
    window.addEventListener("beforeinstallprompt", hold);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", hold);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let flag = false;
    try {
      flag = window.localStorage.getItem(SW_DEV_FLAG) === "1";
    } catch {}
    const sw = navigator.serviceWorker;

    if (process.env.NODE_ENV !== "production" && !flag) {
      // Dev without the flag: leave no worker behind from an earlier run with it.
      void sw.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
      return;
    }

    // Only a page that already had a worker is told about a newer one (the first install also claims it).
    const had = !!sw.controller;
    const updated = () => {
      window.__xpSwUpdated = true;
      window.dispatchEvent(new Event("xp-sw-update"));
    };
    const onChange = () => {
      if (had) updated();
    };
    const onMessage = (e: MessageEvent) => {
      if (had && (e.data as { type?: string } | null)?.type === "sw-updated") updated();
    };
    sw.addEventListener("controllerchange", onChange);
    sw.addEventListener("message", onMessage);

    const register = () => void sw.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      sw.removeEventListener("controllerchange", onChange);
      sw.removeEventListener("message", onMessage);
      window.removeEventListener("load", register);
    };
  }, []);
  return null;
}

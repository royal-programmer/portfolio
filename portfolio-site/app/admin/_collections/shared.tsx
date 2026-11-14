"use client";

/** Small pieces the admin collection screens share: the toast with Undo, the live preview pane, a JSON download. */
import { useCallback, useEffect, useRef, useState } from "react";

const PREVIEW_CHECK_URL = "/admin/preview?check=1";

export const PREVIEW_URL = "/admin/preview?to=engineer";

/** True below the width where a side-by-side preview has room (a phone or small tablet opens a tab instead). */
export const narrowScreen = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1199px)").matches;

export type ToastState = { text: string; undo?: () => void; id: number } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, undo?: () => void) => {
    clearTimeout(timer.current);
    setToast({ text, undo, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), undo ? 9000 : 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, show, hide: () => setToast(null) };
}

export function Toast({ toast }: { toast: ToastState }) {
  const [gone, setGone] = useState<number | null>(null);
  if (!toast || gone === toast.id) return null;
  return (
    <div className="adm-toast" role="status" aria-live="polite">
      <span>{toast.text}</span>
      {toast.undo ? (
        <button
          type="button"
          className="adm-btn"
          onClick={() => {
            toast.undo?.();
            setGone(toast.id);
          }}
        >
          Undo
        </button>
      ) : null}
      <button type="button" className="adm-icon" aria-label="Dismiss" onClick={() => setGone(toast.id)}>
        x
      </button>
    </div>
  );
}

/** The page the record appears on, in an iframe (the preview route sets the draft cookie); reloads when `refreshKey` changes. */
export function PreviewPane({ refreshKey, onClose }: { refreshKey: number; onClose: () => void }) {
  // "ok" until proven otherwise; "blocked" when the draft cookie never arrived or the frame never loaded
  // (a browser that blocks third-party cookies leaves a blank frame), and then a tab is the way to preview.
  const [state, setState] = useState<"loading" | "ok" | "blocked">("loading");
  const [prev, setPrev] = useState(refreshKey);
  if (prev !== refreshKey) {
    setPrev(refreshKey);
    setState("loading");
  }
  useEffect(() => {
    if (state !== "loading") return;
    const giveUp = setTimeout(() => setState("blocked"), 12000);
    return () => clearTimeout(giveUp);
  }, [state, refreshKey]);
  const check = () => {
    // The frame loaded; now ask the server whether the cookie it set made it back.
    setTimeout(async () => {
      try {
        const r = await fetch(PREVIEW_CHECK_URL, { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json()) as { active?: boolean };
        setState(j.active ? "ok" : "blocked");
      } catch {
        setState("ok"); // could not ask: do not hide a frame that may be fine
      }
    }, 1500);
  };
  return (
    <aside className="adm-previewpane" aria-label="Live preview">
      <div className="adm-editor-head">
        <strong>Preview</strong>
        <div className="adm-actions">
          <a className="adm-btn" href={PREVIEW_URL} target="_blank" rel="noreferrer">
            Open in a tab
          </a>
          <button type="button" className="adm-btn is-ghost" onClick={onClose}>
            Hide
          </button>
        </div>
      </div>
      {state === "blocked" ? (
        <div className="adm-note is-bad" role="alert">
          <p>
            The preview did not load here. Your browser probably blocks the cookie the preview needs inside a frame. Open it in a tab instead.
          </p>
          <a className="adm-btn is-primary" href={PREVIEW_URL} target="_blank" rel="noreferrer">
            Open in a tab
          </a>
        </div>
      ) : (
        <iframe key={refreshKey} title="Site preview" src={PREVIEW_URL} onLoad={check} />
      )}
      <p className="adm-hint">Shows the site with drafts on. It refreshes each time you save.</p>
    </aside>
  );
}

export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VisibilityPill({ v }: { v: string }) {
  return <em className={`adm-pill${v === "public" ? " is-ok" : ""}`}>{v === "private" ? "hidden" : v}</em>;
}

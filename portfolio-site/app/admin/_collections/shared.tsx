"use client";

/** Small pieces the admin collection screens share: the toast with Undo, the live preview pane, a JSON download. */
import { useCallback, useEffect, useRef, useState } from "react";

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
      <iframe key={refreshKey} title="Site preview" src={PREVIEW_URL} />
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

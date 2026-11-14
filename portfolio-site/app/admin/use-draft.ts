"use client";

/**
 * One hook for every admin form's draft. On open it loads the server draft and the browser copy, offers
 * the newer one (`pickDraft`) and says where it came from ("Draft from your phone, 2 h ago"). While the form
 * differs from what is saved it writes the browser copy (600 ms) and the server copy (2 s), both debounced.
 * The browser copy is the offline fallback; a failed server write never blocks the form. Nothing here
 * publishes anything.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { draftNotice, pickDraft, type DraftCopy } from "@/lib/admin/drafts";
import { discardServerDraft, loadServerDraft, saveServerDraft } from "./draft-actions";

const LOCAL = (key: string) => `adm-draft:${key}`;

function readLocal(key: string): DraftCopy | null {
  try {
    const raw = localStorage.getItem(LOCAL(key));
    if (!raw) return null;
    const d = JSON.parse(raw) as { data?: unknown; at?: string; value?: unknown; visibility?: string };
    // The round-29 format was { value, visibility } with no time: keep it, as the oldest possible copy.
    return d.data !== undefined && d.at ? { data: d.data, updatedAt: d.at } : { data: { value: d.value, visibility: d.visibility }, updatedAt: new Date(0).toISOString() };
  } catch {
    return null;
  }
}

export type DraftState = {
  notice: string | null;
  /** Epoch ms of the last browser save, or null. */
  savedAt: number | null;
  /** "ok" once a server write landed, "off" when the table or network is not there. */
  server: "pending" | "ok" | "off";
  /** Remove the draft everywhere (after publishing or Revert). */
  clear: () => void;
};

export function useDraft<T>({ key, dirty, value, apply }: { key: string; dirty: boolean; value: T; apply: (data: T) => void }): DraftState {
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [server, setServer] = useState<DraftState["server"]>("pending");
  const applyRef = useRef(apply);
  const hadServer = useRef(false);
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = readLocal(key);
      const loaded = await loadServerDraft(key).catch(() => ({ ok: false, draft: null }));
      if (!alive) return;
      hadServer.current = Boolean(loaded.draft);
      if (!loaded.ok) setServer("off");
      const picked = pickDraft(loaded.draft, local, null);
      if (picked) {
        applyRef.current(picked.data as T);
        setNotice(draftNotice(picked));
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    if (!dirty) {
      try {
        localStorage.removeItem(LOCAL(key));
      } catch {
        /* ignore */
      }
      if (hadServer.current) {
        hadServer.current = false;
        void discardServerDraft(key);
      }
      return;
    }
    const local = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL(key), JSON.stringify({ data: value, at: new Date().toISOString() }));
        setSavedAt(Date.now());
      } catch {
        /* storage blocked */
      }
    }, 600);
    const remote = setTimeout(() => {
      void saveServerDraft(key, value).then((r) => {
        if (r.ok) hadServer.current = true;
        setServer(r.ok ? "ok" : "off");
      });
    }, 2000);
    return () => {
      clearTimeout(local);
      clearTimeout(remote);
    };
  }, [ready, dirty, value, key]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(LOCAL(key));
    } catch {
      /* ignore */
    }
    if (hadServer.current) {
      hadServer.current = false;
      void discardServerDraft(key);
    }
    setSavedAt(null);
    setNotice(null);
  }, [key]);

  return { notice, savedAt, server, clear };
}

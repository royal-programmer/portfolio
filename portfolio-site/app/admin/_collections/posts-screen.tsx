"use client";

/**
 * Writing: blog posts on the same master-detail screen as the other collections. List on the left (search, status),
 * editor on the right: title, address (kept after the first save), excerpt, markdown text, tags, who can see it, the
 * publish date. Autosaved draft (browser and account), "What will change" before saving, Revert, Hide with Undo and
 * Delete forever (only for a hidden post).
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftKey } from "@/lib/admin/drafts";
import { setAdminDirty } from "../dirty";
import { useDraft } from "../use-draft";
import { deletePostsForever, restorePostVisibility, savePost, setPostVisibility } from "../post-actions";
import { BLANK_POST, checkPost, cleanPost, mergePostDraft, type PostValue } from "../_lib/post-forms";
import { diffValues } from "../_lib/record-forms";
import { Toast, useToast, VisibilityPill } from "./shared";

export type PostRow = { id: string; slug: string; title: string; excerpt: string; body: string; tags: string; visibility: string; publishedAt: string; updatedAt: string };

const VIS_LABEL: Record<string, string> = { public: "Public", unlisted: "Unlisted", private: "Hidden" };
const valueOf = (r?: PostRow): PostValue => (r ? { title: r.title, slug: r.slug, excerpt: r.excerpt, body: r.body, tags: r.tags, visibility: r.visibility, publishedAt: r.publishedAt } : { ...BLANK_POST });

function Editor({ row, onSaved, onClose }: { row?: PostRow; onSaved: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [busy, start] = useTransition();
  const initial = useMemo(() => valueOf(row), [row]);
  const [v, setV] = useState<PostValue>(initial);
  const [review, setReview] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (review) reviewRef.current?.scrollIntoView?.({ block: "center" });
  }, [review]);

  const cleaned = useMemo(() => cleanPost(v), [v]);
  const base = useMemo(() => cleanPost(initial), [initial]);
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(base);
  const diff = useMemo(() => diffValues({ ...base, visibility: VIS_LABEL[String(base.visibility)] }, { ...cleaned, visibility: VIS_LABEL[String(cleaned.visibility)] }), [base, cleaned]);
  const set = (k: keyof PostValue, val: string) => setV((cur) => ({ ...cur, [k]: val }));

  const draft = useDraft<PostValue>({ key: draftKey("post", row?.id ?? "new"), dirty, value: v, apply: (d) => setV(mergePostDraft(initial, d)) });
  useEffect(() => {
    setAdminDirty(dirty);
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => setAdminDirty(false), []);

  const revert = () => {
    setV({ ...initial });
    setReview(false);
    setNote(null);
    setProblems([]);
    draft.clear();
  };
  const ask = () => {
    const p = checkPost(v);
    setProblems(p);
    setNote(null);
    setReview(p.length === 0);
  };
  const confirm = () =>
    start(async () => {
      const r = await savePost({ id: row?.id, value: v });
      if (r.error) return setNote({ ok: false, text: r.error });
      setNote({ ok: true, text: r.message ?? "Saved." });
      setReview(false);
      draft.clear();
      setAdminDirty(false);
      router.refresh();
      if (!row && r.id) onSaved(r.id);
    });

  return (
    <div className="adm-editor">
      <div className="adm-editor-head">
        <h2>{row ? row.title || "(untitled)" : "New post"}</h2>
        <button type="button" className="adm-btn is-ghost adm-close" onClick={onClose}>
          Close
        </button>
      </div>
      {draft.notice ? (
        <p className="adm-note is-ok" role="status">
          {draft.notice}. Nothing is saved to the site until you press Save.{" "}
          <button type="button" className="adm-btn is-ghost" onClick={revert}>
            Discard
          </button>
        </p>
      ) : null}
      <div className="adm-form">
        <label className="adm-field is-block">
          <span className="adm-label">Title *</span>
          <input className="adm-input" value={v.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="adm-field is-block">
          <span className="adm-label">
            Address <span className="adm-hint">({row ? "fixed after the first save" : "optional, made from the title"})</span>
          </span>
          <input className="adm-input" value={v.slug} disabled={!!row} placeholder="my-first-post" onChange={(e) => set("slug", e.target.value)} />
        </label>
        <label className="adm-field is-block">
          <span className="adm-label">Excerpt</span>
          <input className="adm-input" value={v.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
        </label>
        <label className="adm-field is-block">
          <span className="adm-label">Text (markdown)</span>
          <textarea className="adm-input" rows={12} value={v.body} onChange={(e) => set("body", e.target.value)} />
        </label>
        <label className="adm-field is-block">
          <span className="adm-label">
            Tags <span className="adm-hint">(comma-separated)</span>
          </span>
          <input className="adm-input" value={v.tags} onChange={(e) => set("tags", e.target.value)} />
        </label>
        <label className="adm-field is-block">
          <span className="adm-label">Publish date</span>
          <input className="adm-input is-narrow" type="date" value={v.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} />
        </label>
        <label className="adm-field is-block">
          <span className="adm-label">Who can see it</span>
          <select className="adm-input is-narrow" value={v.visibility} onChange={(e) => set("visibility", e.target.value)}>
            <option value="public">Public: shown on the site</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Hidden: not on the site</option>
          </select>
        </label>
        {problems.length ? (
          <div className="adm-note is-bad" role="alert">
            <strong>Fix this first:</strong>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {review ? (
          <div className="adm-review" role="region" aria-label="What will change" ref={reviewRef}>
            <h3 className="adm-h2">What will change</h3>
            {diff.length ? (
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((d) => (
                    <tr key={d.path}>
                      <td>{d.path}</td>
                      <td className="adm-before">{d.before}</td>
                      <td className="adm-after">{d.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-hint">Nothing differs from what is saved.</p>
            )}
            <div className="adm-actions">
              <button type="button" className="adm-btn is-primary" disabled={busy} onClick={confirm}>
                {busy ? "Saving…" : v.visibility === "public" ? "Yes, publish" : "Yes, save"}
              </button>
              <button type="button" className="adm-btn" onClick={() => setReview(false)}>
                Keep editing
              </button>
            </div>
          </div>
        ) : null}
        {note ? (
          <p className={`adm-note ${note.ok ? "is-ok" : "is-bad"}`} role="status">
            {note.text}
          </p>
        ) : null}
        <div className="adm-actions adm-stickybar">
          <button type="button" className="adm-btn is-primary" disabled={busy || (!dirty && !!row)} onClick={ask}>
            {row ? "Save" : "Create post"}
          </button>
          <button type="button" className="adm-btn" disabled={busy || !dirty} onClick={revert}>
            Revert
          </button>
          <span className="adm-hint adm-saved" aria-live="polite">
            {dirty ? (draft.savedAt ? `Draft saved ${draft.server === "ok" ? "to your account" : "in this browser"} (not published)` : "Unsaved changes") : "Nothing to save"}
          </span>
        </div>
        {row ? (
          <div className="adm-actions">
            {row.visibility !== "private" ? (
              <button
                type="button"
                className="adm-btn is-ghost"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const was = row.visibility;
                    const r = await setPostVisibility([row.id], "private");
                    if (r.error) return setNote({ ok: false, text: r.error });
                    router.refresh();
                    show("Hidden from the site.", () => void restorePostVisibility([{ id: row.id, visibility: was }]).then(() => router.refresh()));
                  })
                }
              >
                Hide (delete, can undo)
              </button>
            ) : (
              <button
                type="button"
                className="adm-btn is-ghost is-danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Delete "${row.title}" forever? This cannot be undone.`) || !window.confirm("Really delete forever?")) return;
                  start(async () => {
                    const r = await deletePostsForever([row.id]);
                    if (r.error) return setNote({ ok: false, text: r.error });
                    draft.clear();
                    router.refresh();
                    onClose();
                  });
                }}
              >
                Delete forever
              </button>
            )}
          </div>
        ) : null}
      </div>
      <Toast toast={toast} />
    </div>
  );
}

export function PostsScreen({ rows, initialId, startNew, ready }: { rows: PostRow[]; initialId?: string; startNew?: boolean; ready: boolean }) {
  const [sel, setSel] = useState<string | "new" | null>(startNew ? "new" : (rows.find((r) => r.id === initialId)?.id ?? null));
  const [q, setQ] = useState("");
  const [vis, setVis] = useState("all");
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => (vis === "all" || r.visibility === vis) && (!n || `${r.title} ${r.slug} ${r.tags}`.toLowerCase().includes(n)));
  }, [rows, q, vis]);
  const current = sel && sel !== "new" ? rows.find((r) => r.id === sel) : undefined;
  const close = () => {
    setAdminDirty(false);
    setSel(null);
  };
  return (
    <section className={`adm-master${sel ? " has-sheet" : ""}`}>
      <div className="adm-list">
        <div className="adm-listbar">
          <h1>Writing</h1>
          <button type="button" className="adm-btn is-primary" onClick={() => setSel("new")}>
            New post
          </button>
        </div>
        {!ready ? <p className="adm-note is-bad">The posts table could not be read. Check the database connection and that migration 0001 is applied.</p> : null}
        <div className="adm-filters">
          <input type="search" className="adm-input" placeholder="Search" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="adm-input is-narrow" aria-label="Status" value={vis} onChange={(e) => setVis(e.target.value)}>
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Hidden</option>
          </select>
        </div>
        {shown.length === 0 ? (
          <p className="adm-hint">{rows.length ? "No match." : "No posts yet."}</p>
        ) : (
          <ul className="adm-records adm-reclist">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" className="adm-recmain" aria-current={sel === r.id ? "true" : undefined} onClick={() => setSel(r.id)}>
                  <strong>{r.title || "(untitled)"}</strong>
                  <span className="adm-hint">/{r.slug}</span>
                  <VisibilityPill v={r.visibility} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="adm-detail" role="region" aria-label="Editor">
        {sel === "new" ? (
          <Editor key="new" onSaved={(id) => setSel(id)} onClose={close} />
        ) : current ? (
          <Editor key={current.id} row={current} onSaved={(id) => setSel(id)} onClose={close} />
        ) : (
          <p className="adm-hint adm-empty">Pick a post on the left, or press New post.</p>
        )}
      </div>
      {!sel ? (
        <button type="button" className="adm-fab" onClick={() => setSel("new")} aria-label="Quick add post">
          + Quick add
        </button>
      ) : null}
    </section>
  );
}

"use client";

/**
 * One master-detail screen for every record type (experience, certificates, education, timeline, milestones,
 * diagrams, profile links). List on the left: search, status filter, select rows, drag or Up/Down to reorder,
 * bulk visibility, export and import (dry run first). Editor on the right: the form from `_lib/record-forms.ts`,
 * an autosaved local draft ("Saved 2 s ago", never published), a Publish button that first shows what will change
 * (before and after), Revert, Duplicate, Hide with Undo, and Delete forever (only for a hidden record). Desktop
 * can show a live preview beside the form; a phone gets a Preview button.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RecordType } from "@/lib/content/types";
import { checkRecord, cleanData, diffValues, moveItem, RECORD_FORMS, validateImport, type RecordForm } from "../_lib/record-forms";
import { deleteRecordsForever, duplicateRecord, importRecords, reorderRecords, restoreVisibility, saveRecord, setRecordsVisibility } from "../record-actions";
import { setAdminDirty } from "../dirty";
import type { Collection } from "../collections";
import { FieldList } from "./record-fields";
import { MediaUploader } from "./media-uploader";
import { narrowScreen, PREVIEW_URL, PreviewPane, useToast, Toast, downloadJson, VisibilityPill } from "./shared";

type Obj = Record<string, unknown>;
export type RecordRowView = { id: string; slug: string; title: string; visibility: string; order: number; updatedAt: string; data: Obj; photos: { id: string; thumbUrl: string; alt: string }[] };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const VIS_LABEL: Record<string, string> = { public: "Public", unlisted: "Unlisted", private: "Hidden" };

function draftKey(type: string, id: string) {
  return `adm-draft:${type}:${id}`;
}

function Editor({ col, form, row, suggest, onSaved, onClose, onPreview }: { col: Collection; form: RecordForm; row?: RecordRowView; suggest: Record<string, string[]>; onSaved: (id: string) => void; onClose: () => void; onPreview: (manual: boolean) => void }) {
  const router = useRouter();
  const type = form.type as RecordType;
  const initial = useMemo(() => (row ? clone(row.data) : clone(form.blank)), [row, form]);
  const initialVis = row?.visibility ?? "private";
  const [value, setValue] = useState<Obj>(initial);
  const [visibility, setVisibility] = useState(initialVis);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [restored, setRestored] = useState(false);
  const [review, setReview] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const { toast, show } = useToast();
  const key = draftKey(type, row?.id ?? "new");
  const reviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (review) reviewRef.current?.scrollIntoView?.({ block: "center" });
  }, [review]);

  const cleaned = useMemo(() => cleanData(form.fields, value), [form, value]);
  const base = useMemo(() => cleanData(form.fields, initial), [form, initial]);
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(base) || visibility !== initialVis;
  const diff = useMemo(() => [...(visibility !== initialVis ? [{ path: "visibility", before: VIS_LABEL[initialVis], after: VIS_LABEL[visibility] }] : []), ...diffValues(base, cleaned)], [base, cleaned, visibility, initialVis]);

  // Restore a local draft once, on open.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw) as { value: Obj; visibility: string };
      setValue(d.value);
      setVisibility(d.visibility);
      setRestored(true);
    } catch {
      /* storage blocked or bad JSON: start clean */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (debounced) to this browser only: it never publishes.
  useEffect(() => {
    setAdminDirty(dirty);
    if (!dirty) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ value, visibility }));
        setSavedAt(Date.now());
      } catch {
        /* ignore */
      }
    }, 600);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty, value, visibility, key]);
  useEffect(() => () => setAdminDirty(false), []);
  useEffect(() => {
    if (!savedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [savedAt]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setSavedAt(null);
    setRestored(false);
  };
  const revert = () => {
    setValue(clone(initial));
    setVisibility(initialVis);
    setReview(false);
    setNote(null);
    clearDraft();
  };

  const askPublish = () => {
    const p = checkRecord(type, cleaned);
    setProblems(p);
    setNote(null);
    setReview(p.length === 0);
  };
  const confirmPublish = () =>
    start(async () => {
      const r = await saveRecord({ type, id: row?.id, visibility, data: cleaned });
      if (r.error) return setNote({ ok: false, text: r.error });
      setNote({ ok: true, text: r.message ?? "Saved." });
      setReview(false);
      clearDraft();
      setAdminDirty(false);
      router.refresh();
      onPreview(false);
      if (r.id) onSaved(r.id);
    });

  const act = (fn: () => Promise<{ error?: string; message?: string; id?: string }>, after?: (r: { id?: string }) => void, undo?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) return setNote({ ok: false, text: r.error });
      router.refresh();
      onPreview(false);
      show(r.message ?? "Done.", undo);
      after?.(r);
    });

  const title = row ? row.title : `New ${col.singular}`;
  const ago = savedAt ? Math.max(0, Math.round((now - savedAt) / 1000)) : null;
  return (
    <div className="adm-editor">
      <div className="adm-editor-head">
        <h2>{title}</h2>
        <div className="adm-actions">
          <button type="button" className="adm-btn adm-previewbtn" onClick={() => onPreview(true)}>
            Preview
          </button>
          <button type="button" className="adm-btn is-ghost adm-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {restored ? <p className="adm-note is-ok">Restored your unsaved draft from this browser. Nothing is published until you press Publish.</p> : null}
      <div className="adm-form">
        <FieldList fields={form.fields} value={value} onChange={setValue} suggest={suggest} />
        <label className="adm-field is-block">
          <span className="adm-label">Who can see it</span>
          <select className="adm-input is-narrow" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
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
              <button type="button" className="adm-btn is-primary" disabled={busy} onClick={confirmPublish}>
                {busy ? "Saving…" : visibility === "public" ? "Yes, publish" : "Yes, save"}
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
          <button type="button" className="adm-btn is-primary" disabled={busy || (!dirty && !!row)} onClick={askPublish}>
            {visibility === "public" ? "Publish" : "Save (hidden)"}
          </button>
          <button type="button" className="adm-btn" disabled={busy || !dirty} onClick={revert}>
            Revert
          </button>
          <span className="adm-hint adm-saved" aria-live="polite">
            {dirty ? (ago === null ? "Unsaved changes" : `Draft saved here ${ago < 2 ? "just now" : `${ago} s ago`} (not published)`) : "Nothing to publish"}
          </span>
        </div>
        {row ? (
          <div className="adm-actions">
            <button type="button" className="adm-btn" disabled={busy} onClick={() => act(() => duplicateRecord(row.id), (r) => r.id && onSaved(r.id))}>
              Duplicate
            </button>
            {row.visibility !== "private" ? (
              <button
                type="button"
                className="adm-btn is-ghost"
                disabled={busy}
                onClick={() => act(() => setRecordsVisibility(type, [row.id], "private"), undefined, () => void restoreVisibility(type, [{ id: row.id, visibility: row.visibility }]).then(() => router.refresh()))}
              >
                Hide (delete, can undo)
              </button>
            ) : (
              <button
                type="button"
                className="adm-btn is-ghost is-danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete "${row.title}" forever? This cannot be undone.`) && window.confirm("Really delete forever?")) act(() => deleteRecordsForever(type, [row.id]), () => onClose());
                }}
              >
                Delete forever
              </button>
            )}
          </div>
        ) : null}
      </div>
      {col.uploads && row ? (
        <div className="adm-media">
          <h3 className="adm-h2">Badge images ({row.photos.length})</h3>
          {row.photos.length ? (
            <div className="adm-thumbs">
              {row.photos.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.thumbUrl} alt={m.alt} loading="lazy" />
              ))}
            </div>
          ) : null}
          <MediaUploader entryId={row.id} />
        </div>
      ) : null}
      <Toast toast={toast} />
    </div>
  );
}

export function RecordsScreen({ collection, rows, initialId, startNew }: { collection: Collection; rows: RecordRowView[]; initialId?: string; startNew?: boolean }) {
  const router = useRouter();
  const type = collection.recordType as Exclude<RecordType, "skill_group">;
  const form = RECORD_FORMS[type];
  const [sel, setSel] = useState<string | "new" | null>(startNew ? "new" : (rows.find((r) => r.id === initialId)?.id ?? null));
  const [q, setQ] = useState("");
  const [vis, setVis] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const { toast, show } = useToast();
  const preview = (manual: boolean) => {
    if (manual && narrowScreen()) window.open(PREVIEW_URL, "_blank", "noopener");
    else if (manual || previewOpen) {
      setPreviewOpen(true);
      setPreviewKey((k) => k + 1);
    }
  };
  const sig = rows.map((r) => r.id).join(",");
  // The shown order follows the server's rows; a local move overrides it until the rows change.
  const [ord, setOrd] = useState({ sig, ids: sig ? sig.split(",") : [] });
  if (ord.sig !== sig) setOrd({ sig, ids: sig ? sig.split(",") : [] });
  const ids = ord.ids;
  const setIds = (next: string[]) => setOrd({ sig: ord.sig, ids: next });

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const ordered = useMemo(() => ids.map((i) => byId.get(i)).filter((r): r is RecordRowView => !!r), [ids, byId]);
  const filtering = q.trim() !== "" || vis !== "all";
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return ordered.filter((r) => (vis === "all" || r.visibility === vis) && (!n || `${r.title} ${r.slug}`.toLowerCase().includes(n)));
  }, [ordered, q, vis]);
  const suggest = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (type === "certification") out.issuer = [...new Set(rows.map((r) => String(r.data.issuer ?? "")).filter(Boolean))];
    return out;
  }, [rows, type]);
  const current = sel && sel !== "new" ? byId.get(sel) : undefined;

  const close = () => {
    setAdminDirty(false);
    setSel(null);
  };
  const pickRow = (id: string | "new") => {
    setSel(id);
    router.replace(`?${id === "new" ? "new=1" : `id=${id}`}`, { scroll: false });
  };

  const move = (from: number, to: number) => {
    const next = moveItem(ids, from, to);
    if (next.join() === ids.join()) return;
    setIds(next);
    start(async () => {
      const r = await reorderRecords(type, next);
      show(r.error ?? "Order saved.");
      if (!r.error) router.refresh();
    });
  };

  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pickedIds = [...picked].filter((i) => byId.has(i));

  const bulkVis = (v: string) => {
    const before = pickedIds.map((id) => ({ id, visibility: byId.get(id)!.visibility }));
    start(async () => {
      const r = await setRecordsVisibility(type, pickedIds, v);
      if (r.error) return show(r.error);
      router.refresh();
      show(r.message ?? "Done.", () => void restoreVisibility(type, before).then(() => router.refresh()));
    });
  };
  const bulkDelete = () => {
    if (!window.confirm(`Delete ${pickedIds.length} forever? Only hidden ones are deleted.`) || !window.confirm("Really delete forever?")) return;
    start(async () => {
      const r = await deleteRecordsForever(type, pickedIds);
      show(r.error ?? r.message ?? "Done.");
      setPicked(new Set());
      router.refresh();
    });
  };
  const exportRows = (list: RecordRowView[], name: string) => downloadJson(name, list.map((r) => ({ slug: r.slug, visibility: r.visibility, order: r.order, data: r.data })));

  const plan = useMemo(() => (importing && text.trim() ? validateImport(type, text, rows.map((r) => r.slug)) : null), [importing, text, type, rows]);

  return (
    <section className={`adm-master${sel ? " has-sheet" : ""}${previewOpen && sel ? " has-preview" : ""}`}>
      <div className="adm-list">
        <div className="adm-listbar">
          <h1>{collection.label}</h1>
          <button type="button" className="adm-btn is-primary" onClick={() => pickRow("new")}>
            New {collection.singular}
          </button>
        </div>
        {collection.note ? <p className="adm-hint">{collection.note}</p> : null}
        <div className="adm-filters">
          <input type="search" className="adm-input" placeholder="Search" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="adm-input is-narrow" aria-label="Status" value={vis} onChange={(e) => setVis(e.target.value)}>
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Hidden</option>
          </select>
        </div>
        <div className="adm-actions adm-toolrow">
          <button type="button" className="adm-btn is-ghost" onClick={() => exportRows(ordered, `${type}.json`)} disabled={!rows.length}>
            Export JSON
          </button>
          <button type="button" className="adm-btn is-ghost" onClick={() => setImporting((v) => !v)} aria-expanded={importing}>
            Import JSON
          </button>
        </div>
        {importing ? (
          <div className="adm-review">
            <label className="adm-field is-block">
              <span className="adm-label">Paste an export, or choose a file</span>
              <textarea className="adm-input is-mono" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Choose a JSON file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setText(await f.text());
              }}
            />
            {plan ? (
              <>
                <p className={`adm-note ${plan.ok ? "is-ok" : "is-bad"}`}>Dry run: {plan.summary}</p>
                <ul className="adm-plain">
                  {plan.errors.slice(0, 6).map((e) => (
                    <li key={e.index}>{e.index >= 0 ? `Record ${e.index + 1}: ` : ""}{e.message}</li>
                  ))}
                  {plan.rows.slice(0, 8).map((r) => (
                    <li key={r.slug}>
                      {r.action === "create" ? "Add" : "Update"} <code>{r.slug}</code> ({VIS_LABEL[r.visibility]})
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="adm-btn is-primary"
                  disabled={!plan.ok || busy}
                  onClick={() =>
                    start(async () => {
                      const r = await importRecords(type, text);
                      show(r.error ?? r.message ?? "Imported.");
                      if (!r.error) {
                        setImporting(false);
                        setText("");
                        router.refresh();
                      }
                    })
                  }
                >
                  Import {plan.rows.length}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {pickedIds.length ? (
          <div className="adm-bulk" role="region" aria-label="Bulk actions">
            <strong>{pickedIds.length} selected</strong>
            <button type="button" className="adm-btn" disabled={busy} onClick={() => bulkVis("public")}>
              Make public
            </button>
            <button type="button" className="adm-btn" disabled={busy} onClick={() => bulkVis("private")}>
              Hide
            </button>
            <button type="button" className="adm-btn" onClick={() => exportRows(pickedIds.map((i) => byId.get(i)!), `${type}-selected.json`)}>
              Export
            </button>
            <button type="button" className="adm-btn is-ghost" disabled={busy} onClick={bulkDelete}>
              Delete forever
            </button>
            <button type="button" className="adm-btn is-ghost" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </div>
        ) : null}
        {filtering && rows.length > 1 ? <p className="adm-hint">Clear the search and filter to reorder.</p> : null}
        {shown.length === 0 ? (
          <p className="adm-hint">{rows.length ? "No match." : `No ${collection.label.toLowerCase()} yet.`}</p>
        ) : (
          <ul className="adm-records adm-reclist">
            {shown.map((r) => {
              const i = ids.indexOf(r.id);
              return (
                <li
                  key={r.id}
                  className={dragFrom === i ? "is-drag" : undefined}
                  draggable={!filtering}
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => !filtering && e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom !== null) move(dragFrom, i);
                    setDragFrom(null);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                >
                  <input type="checkbox" className="adm-pick" aria-label={`Select ${r.title}`} checked={picked.has(r.id)} onChange={() => togglePick(r.id)} />
                  <button type="button" className="adm-recmain" aria-current={sel === r.id ? "true" : undefined} onClick={() => pickRow(r.id)}>
                    <strong>{r.title || "(untitled)"}</strong>
                    <span className="adm-hint">/{r.slug}</span>
                    <VisibilityPill v={r.visibility} />
                  </button>
                  {!filtering ? (
                    <span className="adm-reorder">
                      <button type="button" className="adm-icon" aria-label={`Move ${r.title} up`} disabled={i === 0 || busy} onClick={() => move(i, i - 1)}>
                        Up
                      </button>
                      <button type="button" className="adm-icon" aria-label={`Move ${r.title} down`} disabled={i === ids.length - 1 || busy} onClick={() => move(i, i + 1)}>
                        Down
                      </button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="adm-detail" role="region" aria-label="Editor">
        {sel === "new" ? (
          <Editor key="new" col={collection} form={form} suggest={suggest} onSaved={(id) => pickRow(id)} onClose={close} onPreview={preview} />
        ) : current ? (
          <Editor key={current.id} col={collection} form={form} row={current} suggest={suggest} onSaved={(id) => pickRow(id)} onClose={close} onPreview={preview} />
        ) : (
          <p className="adm-hint adm-empty">Pick a record on the left, or press New to add one.</p>
        )}
      </div>
      {previewOpen && sel ? <PreviewPane refreshKey={previewKey} onClose={() => setPreviewOpen(false)} /> : null}
      {!sel ? (
        <button type="button" className="adm-fab" onClick={() => pickRow("new")} aria-label={`Quick add ${collection.singular}`}>
          + Quick add
        </button>
      ) : null}
      <Toast toast={toast} />
    </section>
  );
}

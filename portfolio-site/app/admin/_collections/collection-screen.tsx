"use client";

/**
 * Add and manage on one screen: the records on the left (search, visibility filter), the editor on the
 * right (New, edit, duplicate, delete with confirm, attach photos). On phones the list is the page and the
 * editor is a full-screen sheet; a floating Quick add button opens a new record. Fields come from the
 * collection constant (`../collections.ts`).
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateProject, saveProject, type ActionState } from "../entry-actions";
import type { Collection, CollectionField } from "../collections";
import { setAdminDirty } from "../dirty";
import { useDraft } from "../use-draft";
import { draftKey } from "@/lib/admin/drafts";
import { BLANK_PROJECT, cleanExtras, cleanProject, mergeProjectDraft, validateProjectImport, type ProjectValue } from "../_lib/project-forms";
import { MediaUploader } from "./media-uploader";
import { ProjectExtras, type PhotoChoice } from "./project-extras";
import { BookingEditor } from "./booking-editor";
import { deleteRecordsForever, importProjects, reorderRecords, restoreVisibility, setRecordsVisibility } from "../record-actions";
import { diffValues, moveItem } from "../_lib/record-forms";
import { downloadJson, narrowScreen, PREVIEW_URL, PreviewPane, Toast, useToast, VisibilityPill } from "./shared";
import type { Settings } from "@/lib/settings/schema";

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  visibility: string;
  featured: boolean;
  role: string;
  techStack: string;
  deployedUrl: string;
  repoUrl: string;
  demoVideoUrl: string;
  /** The story and media stored in the project's data (the Netflix trailer's fields). */
  story: Record<string, unknown>;
  assets: Record<string, unknown>;
  order: number;
  photoChoices: PhotoChoice[];
  media: { id: string; thumbUrl: string; alt: string; entryId: string }[];
};

export type BookingProps = { draft: Settings["netflix"]; live: Settings["netflix"] };

type Sel = string | "new" | null;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const VIS_LABEL: Record<string, string> = { public: "Public", unlisted: "Unlisted", private: "Hidden" };

/** The form's value for a saved project (or a blank one). */
function valueOf(row?: ProjectRow): ProjectValue {
  if (!row) return clone(BLANK_PROJECT);
  return { title: row.title, summary: row.summary, body: row.body, role: row.role, techStack: row.techStack, deployedUrl: row.deployedUrl, repoUrl: row.repoUrl, demoVideoUrl: row.demoVideoUrl, visibility: row.visibility, featured: row.featured, story: clone(row.story), assets: clone(row.assets) };
}

function FieldInput({ f, value, onChange }: { f: CollectionField; value: string | boolean; onChange: (v: string | boolean) => void }) {
  if (f.type === "check") {
    return (
      <label className="adm-check">
        <input name={f.key} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {f.label}
      </label>
    );
  }
  return (
    <label className="adm-field is-block">
      <span className="adm-label">
        {f.label}
        {f.required ? " *" : ""} {f.hint ? <span className="adm-hint">({f.hint})</span> : null}
      </span>
      {f.type === "long" ? (
        <textarea name={f.key} rows={5} className="adm-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      ) : f.type === "visibility" ? (
        <select name={f.key} className="adm-input" value={String(value ?? "private")} onChange={(e) => onChange(e.target.value)}>
          <option value="private">Hidden: not on the site</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public: shown on the site</option>
        </select>
      ) : (
        <input name={f.key} type={f.type === "url" ? "url" : "text"} required={f.required} placeholder={f.placeholder} className="adm-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Editor({ col, row, booking, onSaved, onClose, onPreview }: { col: Collection; row?: ProjectRow; booking?: BookingProps; onSaved: (id: string) => void; onClose: () => void; onPreview: (manual: boolean) => void }) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [busy, startBusy] = useTransition();
  const initial = useMemo(() => valueOf(row), [row]);
  const [v, setV] = useState<ProjectValue>(initial);
  const [review, setReview] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const reviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (review) reviewRef.current?.scrollIntoView?.({ block: "center" });
  }, [review]);

  const cleaned = useMemo(() => cleanProject(v), [v]);
  const base = useMemo(() => cleanProject(initial), [initial]);
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(base);
  const diff = useMemo(() => diffValues({ ...base, visibility: VIS_LABEL[String(base.visibility)] }, { ...cleaned, visibility: VIS_LABEL[String(cleaned.visibility)] }), [base, cleaned]);
  const set = (key: keyof ProjectValue, val: unknown) => setV((cur) => ({ ...cur, [key]: val }));

  // Drafts follow Ratul between devices: the server copy loads first, the browser copy is the offline fallback.
  const draft = useDraft<ProjectValue>({ key: draftKey("project", row?.id ?? "new"), dirty, value: v, apply: (d) => setV(mergeProjectDraft(initial, d)) });
  useEffect(() => {
    setAdminDirty(dirty);
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => setAdminDirty(false), []);
  useEffect(() => {
    if (!draft.savedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [draft.savedAt]);

  const revert = () => {
    setV(clone(initial));
    setReview(false);
    setNote(null);
    setProblems([]);
    draft.clear();
  };
  const askSave = () => {
    const p = [!cleaned.title && "Give the project a title first."].filter(Boolean) as string[];
    setProblems(p);
    setNote(null);
    setReview(p.length === 0);
  };
  const confirmSave = () =>
    startBusy(async () => {
      const x = cleanExtras(v.story, v.assets);
      const r = await saveProject({ id: row?.id, title: String(cleaned.title), summary: String(cleaned.summary), body: String(cleaned.body), role: String(cleaned.role), techStack: cleaned.techStack as string[], deployedUrl: String(cleaned.deployedUrl), repoUrl: String(cleaned.repoUrl), demoVideoUrl: String(cleaned.demoVideoUrl), visibility: v.visibility, featured: v.featured, story: x.story, assets: x.assets });
      if (r.error) return setNote({ ok: false, text: r.error });
      setNote({ ok: true, text: r.message ?? "Saved." });
      setReview(false);
      draft.clear();
      setAdminDirty(false);
      router.refresh();
      onPreview(false);
      if (!row && r.entryId) onSaved(r.entryId);
    });

  const run = (fn: () => Promise<ActionState>, after: (r: ActionState) => void) =>
    startBusy(async () => {
      const r = await fn();
      if (r.error) setNote({ ok: false, text: r.error });
      else {
        router.refresh();
        onPreview(false);
        after(r);
      }
    });

  const ago = draft.savedAt ? Math.max(0, Math.round((now - draft.savedAt) / 1000)) : null;
  const text = (k: keyof ProjectValue) => String(v[k] ?? "");
  return (
    <div className="adm-editor">
      <div className="adm-editor-head">
        <h2>{row ? row.title : `New ${col.singular}`}</h2>
        <div className="adm-actions">
          <button type="button" className="adm-btn adm-previewbtn" onClick={() => onPreview(true)}>
            Preview
          </button>
          <button type="button" className="adm-btn is-ghost adm-close" onClick={onClose}>
            Close
          </button>
        </div>
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
        {col.fields.map((f) => (
          <FieldInput key={f.key} f={f} value={f.type === "check" ? v.featured : text(f.key as keyof ProjectValue)} onChange={(val) => set(f.key as keyof ProjectValue, f.type === "check" ? Boolean(val) : val)} />
        ))}
        {col.id === "projects" ? <ProjectExtras story={v.story} assets={v.assets} photos={row?.photoChoices ?? []} onStory={(s) => set("story", s)} onAssets={(a) => set("assets", a)} /> : null}
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
              <button type="button" className="adm-btn is-primary" disabled={busy} onClick={confirmSave}>
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
          <button type="button" className="adm-btn is-primary" disabled={busy || (!dirty && !!row)} onClick={askSave}>
            {row ? "Save" : `Create ${col.singular}`}
          </button>
          <button type="button" className="adm-btn" disabled={busy || !dirty} onClick={revert}>
            Revert
          </button>
          <span className="adm-hint adm-saved" aria-live="polite">
            {dirty ? (ago === null ? "Unsaved changes" : `Draft saved ${draft.server === "ok" ? "to your account" : "in this browser"} ${ago < 2 ? "just now" : `${ago} s ago`} (not published)`) : "Nothing to save"}
          </span>
        </div>
        {row ? (
          <div className="adm-actions">
            <button type="button" className="adm-btn" disabled={busy} onClick={() => run(() => duplicateProject(row.id), (r) => r.entryId && onSaved(r.entryId))}>
              Duplicate
            </button>
            {row.visibility !== "private" ? (
              <button
                type="button"
                className="adm-btn is-ghost"
                disabled={busy}
                onClick={() => {
                  const was = row.visibility;
                  run(() => setRecordsVisibility("project", [row.id], "private"), () => show("Hidden from the site.", () => void restoreVisibility("project", [{ id: row.id, visibility: was }]).then(() => router.refresh())));
                }}
              >
                Hide (delete, can undo)
              </button>
            ) : (
              <button
                type="button"
                className="adm-btn is-ghost is-danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete "${row.title}" forever? Its photos go with it.`) && window.confirm("Really delete forever? This cannot be undone.")) run(() => deleteRecordsForever("project", [row.id]), () => onClose());
                }}
              >
                Delete forever
              </button>
            )}
          </div>
        ) : null}
      </div>
      {col.id === "projects" && booking ? (
        <details className="adm-set">
          <summary className="adm-h2">Book a call (one link, shared by every project)</summary>
          <BookingEditor draft={booking.draft} live={booking.live} />
        </details>
      ) : null}
      <Toast toast={toast} />
      {col.uploads && row ? <Media row={row} /> : null}
    </div>
  );
}

function Media({ row }: { row: ProjectRow }) {
  return (
    <div className="adm-media">
      <h3 className="adm-h2">Photos ({row.media.length})</h3>
      {row.media.length ? (
        <div className="adm-thumbs">
          {row.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.thumbUrl} alt={m.alt} loading="lazy" />
          ))}
        </div>
      ) : null}
      <MediaUploader entryId={row.id} />
    </div>
  );
}

export function CollectionScreen({ collection, rows, initialId, startNew, booking }: { collection: Collection; rows: ProjectRow[]; initialId?: string; startNew?: boolean; booking?: BookingProps }) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [busy, start] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const sig = rows.map((r) => r.id).join(",");
  // The shown order follows the server's rows; a local move overrides it until the rows change.
  const [ord, setOrd] = useState({ sig, ids: sig ? sig.split(",") : [] });
  if (ord.sig !== sig) setOrd({ sig, ids: sig ? sig.split(",") : [] });
  const ids = ord.ids;
  const setIds = (next: string[]) => setOrd({ sig: ord.sig, ids: next });
  const [sel, setSel] = useState<Sel>(startNew ? "new" : (rows.find((r) => r.id === initialId)?.id ?? null));
  const [q, setQ] = useState("");
  const [vis, setVis] = useState("all");
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const preview = (manual: boolean) => {
    if (manual && narrowScreen()) window.open(PREVIEW_URL, "_blank", "noopener");
    else if (manual || previewOpen) {
      setPreviewOpen(true);
      setPreviewKey((k) => k + 1);
    }
  };
  const plan = useMemo(() => (importing && text.trim() ? validateProjectImport(text, rows.map((r) => r.slug)) : null), [importing, text, rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((i) => byId.get(i)).filter((r): r is ProjectRow => !!r);
    return ordered.filter((r) => (vis === "all" || r.visibility === vis) && (!needle || `${r.title} ${r.slug} ${r.techStack}`.toLowerCase().includes(needle)));
  }, [rows, ids, q, vis]);
  const filtering = q.trim() !== "" || vis !== "all";
  const pickedIds = [...picked].filter((i) => rows.some((r) => r.id === i));
  const move = (from: number, to: number) => {
    const next = moveItem(ids, from, to);
    setIds(next);
    start(async () => {
      const r = await reorderRecords("project", next);
      show(r.error ?? "Order saved.");
      if (!r.error) router.refresh();
    });
  };

  const current = sel && sel !== "new" ? rows.find((r) => r.id === sel) : undefined;
  const close = () => {
    setAdminDirty(false);
    setSel(null);
  };
  const open = (s: Sel) => setSel(s);

  const isMedia = collection.kind === "media";
  return (
    <section className={`adm-master${sel ? " has-sheet" : ""}${previewOpen && sel ? " has-preview" : ""}`}>
      <div className="adm-list">
        <div className="adm-listbar">
          <h1>{collection.label}</h1>
          {!isMedia ? (
            <button type="button" className="adm-btn is-primary" onClick={() => open("new")}>
              New {collection.singular}
            </button>
          ) : null}
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
          <button
            type="button"
            className="adm-btn is-ghost"
            disabled={!rows.length}
            onClick={() => downloadJson(`${collection.id}.json`, rows.map((r) => ({ slug: r.slug, title: r.title, visibility: r.visibility, order: r.order, summary: r.summary, body: r.body, featured: r.featured, data: { role: r.role, techStack: r.techStack.split(",").map((x) => x.trim()).filter(Boolean), deployedUrl: r.deployedUrl, repoUrl: r.repoUrl, demoVideoUrl: r.demoVideoUrl, story: r.story, media: r.assets } })))}
          >
            Export JSON
          </button>
          {!isMedia ? (
            <button type="button" className="adm-btn is-ghost" onClick={() => setImporting((x) => !x)} aria-expanded={importing}>
              Import JSON
            </button>
          ) : null}
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
                    <li key={e.index}>
                      {e.index >= 0 ? `Project ${e.index + 1}: ` : ""}
                      {e.message}
                    </li>
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
                      const r = await importProjects(text);
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
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="adm-btn"
                disabled={busy}
                onClick={() => {
                  const before = pickedIds.map((id) => ({ id, visibility: rows.find((r) => r.id === id)!.visibility }));
                  start(async () => {
                    const r = await setRecordsVisibility("project", pickedIds, v);
                    if (r.error) return show(r.error);
                    router.refresh();
                    show(r.message ?? "Done.", () => void restoreVisibility("project", before).then(() => router.refresh()));
                  });
                }}
              >
                {v === "public" ? "Make public" : "Hide"}
              </button>
            ))}
            <button
              type="button"
              className="adm-btn is-ghost"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`Delete ${pickedIds.length} forever? Only hidden ones are deleted.`) || !window.confirm("Really delete forever?")) return;
                start(async () => {
                  const r = await deleteRecordsForever("project", pickedIds);
                  show(r.error ?? r.message ?? "Done.");
                  setPicked(new Set());
                  router.refresh();
                });
              }}
            >
              Delete forever
            </button>
            <button type="button" className="adm-btn is-ghost" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </div>
        ) : null}
        {shown.length === 0 ? (
          <p className="adm-hint">{rows.length ? "No match." : `No ${collection.label.toLowerCase()} yet.`}</p>
        ) : (
          <ul className="adm-records adm-reclist">
            {shown.map((r) => {
              const i = ids.indexOf(r.id);
              return (
                <li key={r.id}>
                  <input
                    type="checkbox"
                    className="adm-pick"
                    aria-label={`Select ${r.title}`}
                    checked={picked.has(r.id)}
                    onChange={() =>
                      setPicked((s) => {
                        const n = new Set(s);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                  />
                  <button type="button" className="adm-recmain" aria-current={sel === r.id ? "true" : undefined} onClick={() => open(r.id)}>
                    <strong>{r.title}</strong>
                    <span className="adm-hint">
                      /{r.slug} · {r.media.length} photo{r.media.length === 1 ? "" : "s"}
                    </span>
                    <VisibilityPill v={r.visibility} />
                  </button>
                  {!filtering && !isMedia ? (
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
          <Editor key="new" col={collection} booking={booking} onSaved={(id) => setSel(id)} onClose={close} onPreview={preview} />
        ) : current ? (
          isMedia ? (
            <div className="adm-editor">
              <div className="adm-editor-head">
                <h2>{current.title}</h2>
                <button type="button" className="adm-btn is-ghost adm-close" onClick={close}>
                  Close
                </button>
              </div>
              <Media row={current} />
            </div>
          ) : (
            <Editor key={current.id} col={collection} row={current} booking={booking} onSaved={(id) => setSel(id)} onClose={close} onPreview={preview} />
          )
        ) : (
          <p className="adm-hint adm-empty">Pick a record on the left, or press New to add one.</p>
        )}
      </div>

      {previewOpen && sel ? <PreviewPane refreshKey={previewKey} onClose={() => setPreviewOpen(false)} /> : null}
      <Toast toast={toast} />
      {!isMedia && !sel ? (
        <button type="button" className="adm-fab" onClick={() => open("new")} aria-label={`Quick add ${collection.singular}`}>
          + Quick add
        </button>
      ) : null}
    </section>
  );
}

"use client";

/**
 * Add and manage on one screen: the records on the left (search, visibility filter), the editor on the
 * right (New, edit, duplicate, delete with confirm, attach photos). On phones the list is the page and the
 * editor is a full-screen sheet; a floating Quick add button opens a new record. Fields come from the
 * collection constant (`../collections.ts`).
 */
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject, deleteProject, duplicateProject, updateProject, type ActionState } from "../entry-actions";
import type { Collection, CollectionField } from "../collections";
import { setAdminDirty } from "../dirty";
import { MediaUploader } from "./media-uploader";

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
  media: { id: string; thumbUrl: string; alt: string; entryId: string }[];
};

type Sel = string | "new" | null;

function FieldInput({ f, row }: { f: CollectionField; row?: ProjectRow }) {
  const value = row ? ((row as unknown as Record<string, unknown>)[f.key] as string | boolean | undefined) : undefined;
  if (f.type === "check") {
    return (
      <label className="adm-check">
        <input name={f.key} type="checkbox" defaultChecked={Boolean(value)} /> {f.label}
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
        <textarea name={f.key} rows={5} className="adm-input" defaultValue={String(value ?? "")} />
      ) : f.type === "visibility" ? (
        <select name={f.key} className="adm-input" defaultValue={String(value ?? "private")}>
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
      ) : (
        <input name={f.key} type={f.type === "url" ? "url" : "text"} required={f.required} placeholder={f.placeholder} className="adm-input" defaultValue={String(value ?? "")} />
      )}
    </label>
  );
}

function Editor({ col, row, onSaved, onClose }: { col: Collection; row?: ProjectRow; onSaved: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(row ? updateProject : createProject, {});
  const [busy, startBusy] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok && state.entryId) {
      setAdminDirty(false);
      router.refresh();
      if (!row) onSaved(state.entryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const run = (fn: () => Promise<ActionState>, after: (r: ActionState) => void) =>
    startBusy(async () => {
      const r = await fn();
      if (r.error) setNote(r.error);
      else {
        router.refresh();
        after(r);
      }
    });

  return (
    <div className="adm-editor">
      <div className="adm-editor-head">
        <h2>{row ? row.title : `New ${col.singular}`}</h2>
        <button type="button" className="adm-btn is-ghost adm-close" onClick={onClose}>
          Close
        </button>
      </div>
      <form action={action} className="adm-form" onChange={() => setAdminDirty(true)}>
        {row ? <input type="hidden" name="id" value={row.id} /> : null}
        {col.fields.map((f) => (
          <FieldInput key={f.key} f={f} row={row} />
        ))}
        {state.error || note ? <p className="adm-note is-bad">{state.error ?? note}</p> : null}
        {state.ok ? <p className="adm-note is-ok">{state.message ?? "Created. You can add photos now."}</p> : null}
        <div className="adm-actions">
          <button type="submit" className="adm-btn is-primary" disabled={pending}>
            {pending ? "Saving…" : row ? "Save" : `Create ${col.singular}`}
          </button>
          {row ? (
            <>
              <button type="button" className="adm-btn" disabled={busy} onClick={() => run(() => duplicateProject(row.id), (r) => r.entryId && onSaved(r.entryId))}>
                Duplicate
              </button>
              <button
                type="button"
                className="adm-btn is-ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete "${row.title}"? Its photos go with it. This cannot be undone.`)) run(() => deleteProject(row.id), () => onClose());
                }}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      </form>
      {col.uploads && row ? <Media row={row} /> : null}
      {col.uploads && !row && state.entryId ? <MediaUploader entryId={state.entryId} /> : null}
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

export function CollectionScreen({ collection, rows, initialId, startNew }: { collection: Collection; rows: ProjectRow[]; initialId?: string; startNew?: boolean }) {
  const [sel, setSel] = useState<Sel>(startNew ? "new" : (rows.find((r) => r.id === initialId)?.id ?? null));
  const [q, setQ] = useState("");
  const [vis, setVis] = useState("all");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (vis === "all" || r.visibility === vis) && (!needle || `${r.title} ${r.slug} ${r.techStack}`.toLowerCase().includes(needle)));
  }, [rows, q, vis]);

  const current = sel && sel !== "new" ? rows.find((r) => r.id === sel) : undefined;
  const close = () => {
    setAdminDirty(false);
    setSel(null);
  };
  const open = (s: Sel) => setSel(s);

  const isMedia = collection.kind === "media";
  return (
    <section className={`adm-master${sel ? " has-sheet" : ""}`}>
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
            <option value="private">Private</option>
          </select>
        </div>
        {shown.length === 0 ? (
          <p className="adm-hint">{rows.length ? "No match." : `No ${collection.label.toLowerCase()} yet.`}</p>
        ) : (
          <ul className="adm-records">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" aria-current={sel === r.id ? "true" : undefined} onClick={() => open(r.id)}>
                  <strong>{r.title}</strong>
                  <span className="adm-hint">
                    /{r.slug} · {r.media.length} photo{r.media.length === 1 ? "" : "s"}
                  </span>
                  <em className={`adm-pill${r.visibility === "public" ? " is-ok" : ""}`}>{r.visibility}</em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="adm-detail" role="region" aria-label="Editor">
        {sel === "new" ? (
          <Editor key="new" col={collection} onSaved={(id) => setSel(id)} onClose={close} />
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
            <Editor key={current.id} col={collection} row={current} onSaved={(id) => setSel(id)} onClose={close} />
          )
        ) : (
          <p className="adm-hint adm-empty">Pick a record on the left, or press New to add one.</p>
        )}
      </div>

      {!isMedia && !sel ? (
        <button type="button" className="adm-fab" onClick={() => open("new")} aria-label={`Quick add ${collection.singular}`}>
          + Quick add
        </button>
      ) : null}
    </section>
  );
}

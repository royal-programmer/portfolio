"use client";

/**
 * Add and manage on one screen: the records on the left (search, visibility filter), the editor on the
 * right (New, edit, duplicate, delete with confirm, attach photos). On phones the list is the page and the
 * editor is a full-screen sheet; a floating Quick add button opens a new record. Fields come from the
 * collection constant (`../collections.ts`).
 */
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject, duplicateProject, updateProject, type ActionState } from "../entry-actions";
import type { Collection, CollectionField } from "../collections";
import { setAdminDirty } from "../dirty";
import { MediaUploader } from "./media-uploader";
import { ProjectExtras, type PhotoChoice } from "./project-extras";
import { BookingEditor } from "./booking-editor";
import { deleteRecordsForever, reorderRecords, restoreVisibility, setRecordsVisibility } from "../record-actions";
import { moveItem } from "../_lib/record-forms";
import { downloadJson, Toast, useToast, VisibilityPill } from "./shared";
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

function Editor({ col, row, booking, onSaved, onClose }: { col: Collection; row?: ProjectRow; booking?: BookingProps; onSaved: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const { toast, show } = useToast();
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
        {col.id === "projects" ? <ProjectExtras story={row?.story ?? {}} assets={row?.assets ?? {}} photos={row?.photoChoices ?? []} /> : null}
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
            </>
          ) : null}
        </div>
      </form>
      {col.id === "projects" && booking ? (
        <details className="adm-set">
          <summary className="adm-h2">Book a call (one link, shared by every project)</summary>
          <BookingEditor draft={booking.draft} live={booking.live} />
        </details>
      ) : null}
      <Toast toast={toast} />
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
        <div className="adm-actions adm-toolrow">
          <button
            type="button"
            className="adm-btn is-ghost"
            disabled={!rows.length}
            onClick={() => downloadJson(`${collection.id}.json`, rows.map((r) => ({ slug: r.slug, title: r.title, visibility: r.visibility, order: r.order, summary: r.summary, body: r.body, featured: r.featured, data: { role: r.role, techStack: r.techStack.split(",").map((x) => x.trim()).filter(Boolean), deployedUrl: r.deployedUrl, repoUrl: r.repoUrl, demoVideoUrl: r.demoVideoUrl, story: r.story, media: r.assets } })))}
          >
            Export JSON
          </button>
        </div>
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
          <Editor key="new" col={collection} booking={booking} onSaved={(id) => setSel(id)} onClose={close} />
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
            <Editor key={current.id} col={collection} row={current} booking={booking} onSaved={(id) => setSel(id)} onClose={close} />
          )
        ) : (
          <p className="adm-hint adm-empty">Pick a record on the left, or press New to add one.</p>
        )}
      </div>

      <Toast toast={toast} />
      {!isMedia && !sel ? (
        <button type="button" className="adm-fab" onClick={() => open("new")} aria-label={`Quick add ${collection.singular}`}>
          + Quick add
        </button>
      ) : null}
    </section>
  );
}

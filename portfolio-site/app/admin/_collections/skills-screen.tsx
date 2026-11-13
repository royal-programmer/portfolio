"use client";

/**
 * Skill groups: each skill can link the projects, roles and certificates that used it (what the site's skill
 * panel shows). Pick from the existing records by title, reorder, remove; save as a draft (private) or publish.
 * The links are record slugs, validated against the record's own schema on the server.
 */
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSkillGroup, type ActionState } from "../entry-actions";
import { setAdminDirty } from "../dirty";

export type PickOption = { slug: string; label: string };
export type SkillItemRow = { name: string; projects: string[]; experience: string[]; certifications: string[] };
export type SkillGroupRow = { id: string; slug: string; visibility: string; group: string; items: SkillItemRow[] };
export type SkillOptions = { projects: PickOption[]; experience: PickOption[]; certifications: PickOption[] };

type LinkKey = "projects" | "experience" | "certifications";
const KINDS: Array<{ key: LinkKey; label: string }> = [
  { key: "projects", label: "Projects" },
  { key: "experience", label: "Work (roles)" },
  { key: "certifications", label: "Certificates" },
];

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function Picker({ label, options, value, onChange }: { label: string; options: PickOption[]; value: string[]; onChange: (v: string[]) => void }) {
  const title = (slug: string) => options.find((o) => o.slug === slug)?.label ?? `${slug} (no such record)`;
  const free = options.filter((o) => !value.includes(o.slug));
  return (
    <div className="adm-field is-block">
      <span className="adm-label">{label}</span>
      {value.length ? (
        <ul className="adm-records" aria-label={`${label} linked`}>
          {value.map((s, i) => (
            <li key={s} className="adm-row-inline">
              <span style={{ flex: 1 }}>{title(s)}</span>
              <button type="button" className="adm-btn is-ghost" aria-label={`Move ${title(s)} up`} disabled={i === 0} onClick={() => onChange(move(value, i, -1))}>
                Up
              </button>
              <button type="button" className="adm-btn is-ghost" aria-label={`Move ${title(s)} down`} disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))}>
                Down
              </button>
              <button type="button" className="adm-btn is-ghost" aria-label={`Remove ${title(s)}`} onClick={() => onChange(value.filter((x) => x !== s))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <span className="adm-hint">None linked: the site matches by name instead.</span>
      )}
      <select
        className="adm-input is-narrow"
        aria-label={`Add to ${label}`}
        value=""
        disabled={!free.length}
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
      >
        <option value="">{free.length ? "Add…" : "Nothing left to add"}</option>
        {free.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Editor({ row, options, onSaved, onClose }: { row?: SkillGroupRow; options: SkillOptions; onSaved: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [group, setGroup] = useState(row?.group ?? "");
  const [items, setItems] = useState<SkillItemRow[]>(row?.items ?? []);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSkillGroup, {});
  const payload = useMemo(
    () =>
      JSON.stringify({
        group,
        items: items.map((i) => ({
          name: i.name,
          ...(i.projects.length ? { projects: i.projects } : {}),
          ...(i.experience.length ? { experience: i.experience } : {}),
          ...(i.certifications.length ? { certifications: i.certifications } : {}),
        })),
      }),
    [group, items],
  );

  useEffect(() => {
    if (state.ok) {
      setAdminDirty(false);
      router.refresh();
      if (!row && state.entryId) onSaved(state.entryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const patch = (i: number, p: Partial<SkillItemRow>) => {
    setAdminDirty(true);
    setItems((all) => all.map((x, k) => (k === i ? { ...x, ...p } : x)));
  };

  return (
    <div className="adm-editor">
      <div className="adm-editor-head">
        <h2>{row ? row.group : "New skill group"}</h2>
        <button type="button" className="adm-btn is-ghost adm-close" onClick={onClose}>
          Close
        </button>
      </div>
      <form action={action} className="adm-form">
        {row ? <input type="hidden" name="id" value={row.id} /> : null}
        <input type="hidden" name="payload" value={payload} />
        <label className="adm-field is-block">
          <span className="adm-label">Group name *</span>
          <input
            className="adm-input"
            value={group}
            onChange={(e) => {
              setAdminDirty(true);
              setGroup(e.target.value);
            }}
          />
        </label>
        {row ? (
          <p className="adm-hint">
            Status: <em className={`adm-pill${row.visibility === "public" ? " is-ok" : ""}`}>{row.visibility === "public" ? "published" : "draft"}</em>
          </p>
        ) : null}
        {items.map((it, i) => (
          <fieldset key={i} className="adm-set">
            <legend>{it.name || "New skill"}</legend>
            <div className="adm-row-inline is-stretch">
              <input className="adm-input" aria-label="Skill name" placeholder="Skill name, e.g. C#" value={it.name} onChange={(e) => patch(i, { name: e.target.value })} />
              <button type="button" className="adm-btn is-ghost" aria-label={`Move ${it.name || "skill"} up`} disabled={i === 0} onClick={() => setItems((a) => move(a, i, -1))}>
                Up
              </button>
              <button type="button" className="adm-btn is-ghost" aria-label={`Move ${it.name || "skill"} down`} disabled={i === items.length - 1} onClick={() => setItems((a) => move(a, i, 1))}>
                Down
              </button>
              <button type="button" className="adm-btn is-ghost" onClick={() => setItems((a) => a.filter((_, k) => k !== i))}>
                Remove skill
              </button>
            </div>
            {KINDS.map((k) => (
              <Picker key={k.key} label={k.label} options={options[k.key]} value={it[k.key]} onChange={(v) => patch(i, { [k.key]: v })} />
            ))}
          </fieldset>
        ))}
        <div>
          <button
            type="button"
            className="adm-btn"
            onClick={() => {
              setAdminDirty(true);
              setItems((a) => [...a, { name: "", projects: [], experience: [], certifications: [] }]);
            }}
          >
            Add a skill
          </button>
        </div>
        {state.error ? <p className="adm-note is-bad">{state.error}</p> : null}
        {state.ok ? <p className="adm-note is-ok">{state.message}</p> : null}
        <div className="adm-actions">
          <button type="submit" name="intent" value="draft" className="adm-btn" disabled={pending}>
            {pending ? "Saving…" : "Save as draft"}
          </button>
          <button type="submit" name="intent" value="publish" className="adm-btn is-primary" disabled={pending}>
            Publish
          </button>
        </div>
      </form>
    </div>
  );
}

export function SkillsScreen({ rows, options, initialId }: { rows: SkillGroupRow[]; options: SkillOptions; initialId?: string }) {
  const [sel, setSel] = useState<string | "new" | null>(rows.find((r) => r.id === initialId)?.id ?? null);
  const current = sel && sel !== "new" ? rows.find((r) => r.id === sel) : undefined;
  const close = () => {
    setAdminDirty(false);
    setSel(null);
  };
  return (
    <section className={`adm-master${sel ? " has-sheet" : ""}`}>
      <div className="adm-list">
        <div className="adm-listbar">
          <h1>Skills</h1>
          <button type="button" className="adm-btn is-primary" onClick={() => setSel("new")}>
            New skill group
          </button>
        </div>
        <p className="adm-hint">Link what each skill was used for. A skill with no links is matched by name in the projects, roles and certificates.</p>
        {rows.length === 0 ? (
          <p className="adm-hint">No skill groups yet. Run the content importer (section 7 of 16-admin-console.md) or add one.</p>
        ) : (
          <ul className="adm-records">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" aria-current={sel === r.id ? "true" : undefined} onClick={() => setSel(r.id)}>
                  <strong>{r.group}</strong>
                  <span className="adm-hint">
                    {r.items.length} skills · {r.items.filter((i) => i.projects.length + i.experience.length + i.certifications.length).length} linked
                  </span>
                  <em className={`adm-pill${r.visibility === "public" ? " is-ok" : ""}`}>{r.visibility === "public" ? "published" : "draft"}</em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="adm-detail" role="region" aria-label="Editor">
        {sel === "new" ? (
          <Editor key="new" options={options} onSaved={(id) => setSel(id)} onClose={close} />
        ) : current ? (
          <Editor key={current.id} row={current} options={options} onSaved={(id) => setSel(id)} onClose={close} />
        ) : (
          <p className="adm-hint adm-empty">Pick a group on the left, or press New skill group.</p>
        )}
      </div>
    </section>
  );
}

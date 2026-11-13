"use client";

/**
 * The inputs a record form is built from, driven by the field lists in `_lib/record-forms.ts`: text, long text,
 * month pickers with a `present` toggle, an ordered bullets editor (Up/Down, no drag needed on a phone), a select,
 * nested rows (diagram boxes and arrows) and an optional block (the contact list entry). Controlled: the parent
 * owns the value and cleans it before saving.
 */
import { useId } from "react";
import { moveItem, type RField } from "../_lib/record-forms";

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function FieldList({ fields, value, onChange, suggest }: { fields: RField[]; value: Obj; onChange: (v: Obj) => void; suggest?: Record<string, string[]> }) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  return (
    <>
      {fields
        .filter((f) => !f.when || value[f.when[0]] === f.when[1])
        .map((f) => (
          <Field key={f.key} f={f} value={value[f.key]} onChange={(v) => set(f.key, v)} suggest={suggest?.[f.key]} />
        ))}
    </>
  );
}

function Label({ f }: { f: RField }) {
  return (
    <span className="adm-label">
      {f.label}
      {f.required ? " *" : ""} {f.hint ? <span className="adm-hint">({f.hint})</span> : null}
    </span>
  );
}

function Field({ f, value, onChange, suggest }: { f: RField; value: unknown; onChange: (v: unknown) => void; suggest?: string[] }) {
  const listId = useId();
  switch (f.kind) {
    case "check":
      return (
        <label className="adm-check">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      );
    case "select":
      return (
        <label className="adm-field is-block">
          <Label f={f} />
          <select className="adm-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "long":
      return (
        <label className="adm-field is-block">
          <Label f={f} />
          <textarea className="adm-input" rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case "month":
      return (
        <label className="adm-field is-block">
          <Label f={f} />
          <input className="adm-input is-narrow" type="month" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case "period": {
      const p = asObj(value);
      const present = p.end === "present";
      return (
        <div className="adm-field is-block">
          <Label f={f} />
          <div className="adm-row-inline">
            <label className="adm-row-inline">
              <span className="adm-hint">From</span>
              <input className="adm-input is-narrow" type="month" aria-label={`${f.label}: from`} value={String(p.start ?? "")} onChange={(e) => onChange({ ...p, start: e.target.value })} />
            </label>
            <label className="adm-row-inline">
              <span className="adm-hint">To</span>
              <input className="adm-input is-narrow" type="month" aria-label={`${f.label}: to`} disabled={present} value={present ? "" : String(p.end ?? "")} onChange={(e) => onChange({ ...p, end: e.target.value })} />
            </label>
            <label className="adm-check">
              <input type="checkbox" checked={present} onChange={(e) => onChange({ ...p, end: e.target.checked ? "present" : "" })} /> Still here (present)
            </label>
          </div>
        </div>
      );
    }
    case "datenull": {
      const open = value === null || value === undefined || value === "";
      return (
        <div className="adm-field is-block">
          <Label f={f} />
          <div className="adm-row-inline">
            <input className="adm-input is-narrow" type="text" placeholder="YYYY-MM" disabled={open} value={open ? "" : String(value)} onChange={(e) => onChange(e.target.value)} aria-label={f.label} />
            <label className="adm-check">
              <input type="checkbox" checked={open} onChange={(e) => onChange(e.target.checked ? null : "")} /> No end (still going)
            </label>
          </div>
        </div>
      );
    }
    case "bullets": {
      const list = asList(value).map(String);
      return (
        <div className="adm-field is-block">
          <Label f={f} />
          <ol className="adm-bullets">
            {list.map((b, i) => (
              <li key={i} className="adm-row-inline is-stretch">
                {f.long ? (
                  <textarea className="adm-input" rows={2} aria-label={`${f.label} ${i + 1}`} value={b} onChange={(e) => onChange(list.map((x, k) => (k === i ? e.target.value : x)))} />
                ) : (
                  <input className="adm-input" aria-label={`${f.label} ${i + 1}`} value={b} onChange={(e) => onChange(list.map((x, k) => (k === i ? e.target.value : x)))} />
                )}
                <button type="button" className="adm-icon" aria-label={`Move ${f.label} ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moveItem(list, i, i - 1))}>
                  Up
                </button>
                <button type="button" className="adm-icon" aria-label={`Move ${f.label} ${i + 1} down`} disabled={i === list.length - 1} onClick={() => onChange(moveItem(list, i, i + 1))}>
                  Down
                </button>
                <button type="button" className="adm-icon is-danger" aria-label={`Remove ${f.label} ${i + 1}`} onClick={() => onChange(list.filter((_, k) => k !== i))}>
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <div>
            <button type="button" className="adm-btn" onClick={() => onChange([...list, ""])}>
              Add {f.label.toLowerCase().replace(/s$/, "")}
            </button>
          </div>
        </div>
      );
    }
    case "optobj": {
      const on = typeof value === "object" && value !== null;
      return (
        <fieldset className="adm-set">
          <legend>
            <label className="adm-check">
              <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? { ...f.empty } : undefined)} /> {f.label}
            </label>
          </legend>
          {on ? <FieldList fields={f.fields} value={asObj(value)} onChange={onChange} /> : <span className="adm-hint">Off.</span>}
        </fieldset>
      );
    }
    case "rows": {
      const list = asList(value);
      const rowObj = (r: unknown): Obj => (f.tuple ? Object.fromEntries(asList(r).map((x, i) => [String(i), x])) : asObj(r));
      const toRow = (o: Obj): unknown => (f.tuple ? [o["0"] ?? "", o["1"] ?? "", o["2"] ?? ""] : o);
      return (
        <div className="adm-field is-block">
          <Label f={f} />
          {list.map((r, i) => (
            <fieldset key={i} className="adm-set">
              <legend>
                {f.label} {i + 1}
              </legend>
              <FieldList fields={f.fields} value={rowObj(r)} onChange={(o) => onChange(list.map((x, k) => (k === i ? toRow(o) : x)))} />
              <div className="adm-actions">
                <button type="button" className="adm-icon" aria-label={`Move ${f.label} ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moveItem(list, i, i - 1))}>
                  Up
                </button>
                <button type="button" className="adm-icon" aria-label={`Move ${f.label} ${i + 1} down`} disabled={i === list.length - 1} onClick={() => onChange(moveItem(list, i, i + 1))}>
                  Down
                </button>
                <button type="button" className="adm-icon is-danger" aria-label={`Remove ${f.label} ${i + 1}`} onClick={() => onChange(list.filter((_, k) => k !== i))}>
                  Remove
                </button>
              </div>
            </fieldset>
          ))}
          <div>
            <button type="button" className="adm-btn" onClick={() => onChange([...list, f.tuple ? ["", "", ""] : { ...f.empty }])}>
              Add one
            </button>
          </div>
        </div>
      );
    }
    default:
      return (
        <label className="adm-field is-block">
          <Label f={f} />
          <input
            className="adm-input"
            type={f.kind === "url" ? "url" : f.kind === "number" ? "number" : "text"}
            inputMode={f.kind === "number" ? "numeric" : undefined}
            placeholder={f.placeholder}
            list={suggest ? listId : undefined}
            value={String(value ?? "")}
            onChange={(e) => onChange(f.kind === "number" ? e.target.value : e.target.value)}
          />
          {suggest ? (
            <datalist id={listId}>
              {suggest.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          ) : null}
        </label>
      );
  }
}

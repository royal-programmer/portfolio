"use client";

/**
 * Forms generated from the Zod schemas. `<SchemaForm schema value onChange fallback />` walks the schema
 * (Zod 4 `_zod.def`) and draws: string -> input / textarea / colour / month, number -> number input with
 * the schema's min/max, boolean -> switch, enum -> select, string[] -> chips, object[] -> sortable rows
 * (drag handle, up/down, add, duplicate, delete), tuple -> inline cells, record -> key/value rows,
 * optional / nullable -> an add / clear button. Every node shows its default as a muted hint and a
 * "reset to default" link where it differs. Anything unrecognised falls back to a JSON box.
 */
import { useId, useState, type ReactNode } from "react";
import { z } from "zod";

type ZDef = {
  type: string;
  innerType?: ZNode;
  shape?: Record<string, ZNode>;
  element?: ZNode;
  items?: ZNode[];
  entries?: Record<string, string>;
  keyType?: ZNode;
  valueType?: ZNode;
};
type ZNode = { _zod: { def: ZDef }; minValue?: number | null; maxValue?: number | null; isInt?: boolean; maxLength?: number | null; description?: string };
type Json = unknown;

const asNode = (s: unknown) => s as ZNode;
const uiOf = (n: ZNode): string | undefined => (z.globalRegistry.get(n as never) as { ui?: string } | undefined)?.ui;

/** Strip optional / nullable / default wrappers; remember which were there and any widget tag. */
function unwrap(n: ZNode): { node: ZNode; optional: boolean; nullable: boolean; ui?: string } {
  let node = n;
  let optional = false;
  let nullable = false;
  let ui = uiOf(n);
  for (let i = 0; i < 6; i++) {
    const t = node._zod.def.type;
    if (t === "optional" || t === "default" || t === "prefault") optional = true;
    else if (t === "nullable") nullable = true;
    else break;
    node = node._zod.def.innerType as ZNode;
    ui ??= uiOf(node);
  }
  return { node, optional, nullable, ui };
}

/** A blank value for a node, used by "add". */
function blank(n: ZNode): Json {
  const { node } = unwrap(n);
  const d = node._zod.def;
  switch (d.type) {
    case "string":
      return uiOf(n) === "month" ? new Date().toISOString().slice(0, 7) : uiOf(n) === "color" ? "#888888" : "";
    case "number":
      return node.minValue ?? 0;
    case "boolean":
      return false;
    case "enum":
      return Object.values(d.entries ?? {})[0] ?? "";
    case "array":
      return [];
    case "object":
      return Object.fromEntries(
        Object.entries(d.shape ?? {})
          .filter(([, c]) => !unwrap(c).optional)
          .map(([k, c]) => [k, blank(c)]),
      );
    case "tuple":
      return (d.items ?? []).filter((c) => !unwrap(c).optional).map(blank);
    case "record":
      return {};
    default:
      return null;
  }
}

const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);
const short = (v: Json) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 70 ? `${s.slice(0, 67)}...` : s;
};
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/[._-]/g, " ").toLowerCase();

function Meta({ def, value, onReset, hint = true }: { def: Json; value: Json; onReset: () => void; hint?: boolean }) {
  if (def === undefined || same(def, value)) return null;
  return (
    <span className="adm-meta">
      {hint ? <span className="adm-hint">default: {short(def)}</span> : null}
      <button type="button" className="adm-link" onClick={onReset}>
        reset to default
      </button>
    </span>
  );
}

type FieldProps = { node: ZNode; value: Json; def: Json; onChange: (v: Json) => void; name: string; bare?: boolean };

export function Field({ node: raw, value, def, onChange, name, bare }: FieldProps) {
  const id = useId();
  const { node, optional, nullable, ui } = unwrap(raw);
  const d = node._zod.def;

  const wrap = (control: ReactNode, opts: { block?: boolean } = {}) =>
    bare ? (
      <>{control}</>
    ) : (
      <div className={`adm-field${opts.block ? " is-block" : ""}`}>
        <label className="adm-label" htmlFor={id}>
          {label(name)}
        </label>
        {control}
        <Meta def={def} value={value} onReset={() => onChange(def)} hint={d.type !== "object" && d.type !== "array"} />
      </div>
    );

  if (value === undefined && (optional || nullable)) {
    return (
      <div className="adm-field">
        <span className="adm-label">{label(name)}</span>
        <button type="button" className="adm-btn is-ghost" onClick={() => onChange(blank(raw))}>
          + add
        </button>
      </div>
    );
  }
  if (value === null && nullable) {
    return (
      <div className="adm-field">
        <span className="adm-label">{label(name)}</span>
        <span className="adm-hint">none (still going)</span>
        <button type="button" className="adm-btn is-ghost" onClick={() => onChange(blank(unwrap(raw).node))}>
          set
        </button>
      </div>
    );
  }
  const clearable = optional || nullable ? (
    <button type="button" className="adm-link" onClick={() => onChange(nullable ? null : undefined)}>
      {nullable ? "clear" : "remove"}
    </button>
  ) : null;

  switch (d.type) {
    case "string": {
      const v = typeof value === "string" ? value : "";
      if (ui === "color")
        return wrap(
          <span className="adm-row-inline">
            <input id={id} type="color" className="adm-color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#000000"} onChange={(e) => onChange(e.target.value)} />
            <input className="adm-input is-mono" value={v} maxLength={7} onChange={(e) => onChange(e.target.value)} aria-label={`${label(name)} hex`} />
            {clearable}
          </span>,
        );
      if (ui === "month")
        return wrap(
          <span className="adm-row-inline">
            <input
              id={id}
              type="month"
              className="adm-input"
              value={v.slice(0, 7)}
              onChange={(e) => onChange(e.target.value ? `${e.target.value}${v.slice(7)}` : "")}
            />
            {v.length > 7 ? <span className="adm-hint">day {v.slice(8)} kept</span> : null}
            {clearable}
          </span>,
        );
      if (ui === "long")
        return wrap(
          <span className="adm-row-inline is-stretch">
            <textarea id={id} className="adm-input" rows={3} maxLength={node.maxLength ?? undefined} value={v} onChange={(e) => onChange(e.target.value)} />
            {clearable}
          </span>,
          { block: true },
        );
      return wrap(
        <span className="adm-row-inline is-stretch">
          <input id={id} className="adm-input" value={v} maxLength={node.maxLength ?? undefined} onChange={(e) => onChange(e.target.value)} />
          {clearable}
        </span>,
      );
    }
    case "number": {
      return wrap(
        <input
          id={id}
          type="number"
          className="adm-input is-narrow"
          value={typeof value === "number" ? value : ""}
          min={node.minValue ?? undefined}
          max={node.maxValue ?? undefined}
          step={node.isInt ? 1 : "any"}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />,
      );
    }
    case "boolean":
      return wrap(
        <button id={id} type="button" role="switch" aria-checked={value === true} className={`adm-switch${value === true ? " is-on" : ""}`} onClick={() => onChange(!(value === true))}>
          <span />
        </button>,
      );
    case "enum": {
      const opts = Object.values(d.entries ?? {});
      return wrap(
        <select id={id} className="adm-input is-narrow" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {opts.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>,
      );
    }
    case "array": {
      const el = asNode(d.element);
      const list = Array.isArray(value) ? (value as Json[]) : [];
      const defList = Array.isArray(def) ? (def as Json[]) : undefined;
      if (unwrap(el).node._zod.def.type === "string" && !uiOf(el)?.startsWith("long") && uiOf(el) !== "long") {
        return wrap(<Chips id={id} list={list as string[]} onChange={onChange} />, { block: true });
      }
      return wrap(<Rows node={el} list={list} def={defList} onChange={onChange} name={name} />, { block: true });
    }
    case "object": {
      const shape = d.shape ?? {};
      const obj = (value && typeof value === "object" ? value : {}) as Record<string, Json>;
      const defObj = (def && typeof def === "object" ? def : {}) as Record<string, Json>;
      const body = (
        <div className="adm-group">
          {Object.entries(shape).map(([k, child]) => (
            <Field key={k} name={k} node={child} value={obj[k]} def={defObj[k]} onChange={(nv) => onChange(nv === undefined ? omit(obj, k) : { ...obj, [k]: nv })} />
          ))}
        </div>
      );
      return bare ? body : (
        <fieldset className="adm-set">
          <legend>
            {label(name)} {clearable}
            <Meta def={def} value={value} onReset={() => onChange(def)} hint={false} />
          </legend>
          {body}
        </fieldset>
      );
    }
    case "tuple": {
      const items = d.items ?? [];
      const arr = Array.isArray(value) ? [...(value as Json[])] : [];
      const defArr = Array.isArray(def) ? (def as Json[]) : [];
      return wrap(
        <span className="adm-row-inline">
          {items.map((c, i) => (
            <span key={i} className="adm-cell">
              <Field bare name={`${name}-${i}`} node={c} value={arr[i]} def={defArr[i]} onChange={(nv) => onChange(setAt(arr, i, nv, items.length))} />
            </span>
          ))}
        </span>,
      );
    }
    case "record": {
      const rec = (value && typeof value === "object" ? value : {}) as Record<string, Json>;
      const defRec = (def && typeof def === "object" ? def : {}) as Record<string, Json>;
      const vt = asNode(d.valueType);
      return wrap(
        <div className="adm-group">
          {Object.entries(rec).map(([k, v]) => (
            <div key={k} className="adm-rec">
              <input
                className="adm-input is-narrow is-mono"
                defaultValue={k}
                aria-label="key"
                onBlur={(e) => {
                  const nk = e.target.value.trim();
                  if (!nk || nk === k || nk in rec) return void (e.target.value = k);
                  onChange(Object.fromEntries(Object.entries(rec).map(([ok, ov]) => [ok === k ? nk : ok, ov])));
                }}
              />
              <Field bare name={k} node={vt} value={v} def={defRec[k]} onChange={(nv) => onChange({ ...rec, [k]: nv })} />
              <button type="button" className="adm-icon" aria-label={`delete ${k}`} onClick={() => onChange(omit(rec, k))}>
                x
              </button>
            </div>
          ))}
          <button type="button" className="adm-btn is-ghost" onClick={() => onChange({ ...rec, [uniqueKey(rec)]: blank(vt) })}>
            + add entry
          </button>
        </div>,
        { block: true },
      );
    }
    default:
      return wrap(<JsonBox value={value} onChange={onChange} />, { block: true });
  }
}

const omit = (o: Record<string, Json>, k: string) => Object.fromEntries(Object.entries(o).filter(([x]) => x !== k));
const uniqueKey = (o: Record<string, Json>) => {
  let i = Object.keys(o).length + 1;
  while (`key${i}` in o) i++;
  return `key${i}`;
};
function setAt(arr: Json[], i: number, v: Json, len: number): Json[] {
  const out = [...arr];
  out[i] = v;
  while (out.length > 0 && out[out.length - 1] === undefined && out.length > len) out.pop();
  // A trailing optional cell cleared: drop it rather than store undefined.
  while (out.length > 0 && (out[out.length - 1] === undefined || out[out.length - 1] === "") && i === out.length - 1 && v === undefined) out.pop();
  return out;
}

function Chips({ id, list, onChange }: { id: string; list: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !list.includes(t)) onChange([...list, t]);
    setDraft("");
  };
  return (
    <span className="adm-chips">
      {list.map((c, i) => (
        <span key={`${c}-${i}`} className="adm-chip">
          {c}
          <button type="button" aria-label={`remove ${c}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
            x
          </button>
        </span>
      ))}
      <input
        id={id}
        className="adm-chip-input"
        placeholder="add, Enter"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && list.length) onChange(list.slice(0, -1));
        }}
        onBlur={add}
      />
    </span>
  );
}

function Rows({ node, list, def, onChange, name }: { node: ZNode; list: Json[]; def: Json[] | undefined; onChange: (v: Json[]) => void; name: string }) {
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  const inner = unwrap(node).node._zod.def.type;
  const compact = inner !== "object";
  return (
    <div className="adm-rows">
      {list.map((item, i) => (
        <div
          key={i}
          className={`adm-rowitem${drag === i ? " is-drag" : ""}`}
          onDragOver={(e) => drag !== null && e.preventDefault()}
          onDrop={() => {
            if (drag !== null) move(drag, i);
            setDrag(null);
          }}
        >
          <div className="adm-rowbar">
            <span className="adm-handle" draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} title="drag to reorder" aria-hidden="true">
              ::
            </span>
            <span className="adm-rownum">{i + 1}</span>
            <button type="button" className="adm-icon" aria-label="move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
              ^
            </button>
            <button type="button" className="adm-icon" aria-label="move down" onClick={() => move(i, i + 1)} disabled={i === list.length - 1}>
              v
            </button>
            <button type="button" className="adm-icon" aria-label="duplicate" onClick={() => onChange([...list.slice(0, i + 1), structuredClone(item), ...list.slice(i + 1)])}>
              ++
            </button>
            <button type="button" className="adm-icon is-danger" aria-label="delete" onClick={() => onChange(list.filter((_, j) => j !== i))}>
              x
            </button>
          </div>
          <div className={compact ? "adm-rowbody is-compact" : "adm-rowbody"}>
            <Field bare name={`${name} ${i + 1}`} node={node} value={item} def={undefined} onChange={(nv) => onChange(list.map((x, j) => (j === i ? nv : x)))} />
          </div>
        </div>
      ))}
      <span className="adm-row-inline">
        <button type="button" className="adm-btn is-ghost" onClick={() => onChange([...list, blank(node)])}>
          + add row
        </button>
        {def && !same(def, list) ? (
          <button type="button" className="adm-link" onClick={() => onChange(structuredClone(def))}>
            reset list to default ({def.length} rows)
          </button>
        ) : null}
      </span>
    </div>
  );
}

function JsonBox({ value, onChange }: { value: Json; onChange: (v: Json) => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <span className="adm-row-inline is-stretch">
      <textarea
        className={`adm-input is-mono${bad ? " is-bad" : ""}`}
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
    </span>
  );
}

/** The whole form for one key. `schema` is the key's Zod schema; `fallback` the code default. */
export function SchemaForm({ schema, value, fallback, onChange }: { schema: unknown; value: Json; fallback: Json; onChange: (v: Json) => void }) {
  return <Field bare node={asNode(schema)} name="root" value={value} def={fallback} onChange={onChange} />;
}

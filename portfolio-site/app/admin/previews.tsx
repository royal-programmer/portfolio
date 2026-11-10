"use client";

/**
 * Read-only previews under the forms: the timeline grid (the terminal's own `terminal-os-tl` classes),
 * the `arch` diagrams (the terminal's ArchView + layoutArch), the themes' swatches with a contrast check,
 * and the views' list. They render the DRAFT being edited, so a change shows before it is saved.
 */
import { Fragment, useMemo, type CSSProperties } from "react";
import { ArchView } from "@/app/components/views/terminal-arch";
import { layoutArch } from "@/lib/site/terminal-arch";
import type { Settings } from "@/lib/settings/schema";

const PREVIEW_VARS = {
  "--ink": "#f3f1ec",
  "--ink-dim": "#a9a7a1",
  "--term-faint": "#6d6b67",
  "--ink-faint": "#6d6b67",
  "--c": "#3b82f6",
  "--term-green": "#4ade80",
  "--term-yellow": "#facc15",
  "--term-violet": "#a78bfa",
  "--term-win": "#0a0a0f",
} as CSSProperties;

const monthName = (m: string) => ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][Number(m) - 1] ?? m;

export function TimelinePreview({ value }: { value: Settings["engineer.timeline"] }) {
  const rows = useMemo(() => {
    const sorted = value.entries.map((e, i) => ({ e, i })).sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i);
    let prev = "";
    return sorted.map(({ e }) => {
      const [y, m] = e.date.split("-");
      const year = y !== prev ? y : "";
      prev = y;
      return { year, mon: monthName(m ?? ""), e };
    });
  }, [value.entries]);
  return (
    <div className="adm-preview" style={PREVIEW_VARS}>
      <div className="adm-preview-title">preview: timeline (newest first, as the terminal prints it)</div>
      <div className="terminal-os-tl">
        {rows.map((r, i) => {
          const dim = r.e.branch !== "main";
          return (
            <Fragment key={i}>
              <span className={`tl-year${dim ? " is-dim" : ""}`}>{r.year}</span>
              <span className={`tl-mon${dim ? " is-dim" : ""}`}>{r.mon}</span>
              <span className={`tl-subj${dim ? " is-dim" : ""}`}>
                <span className="tl-text">
                  {r.e.branch === "life" ? "● " : ""}
                  {r.e.subject}
                </span>
                {r.e.tag ? <b className="tl-tag tone-accent">{`  ${r.e.tag}`}</b> : null}
                {r.e.grade ? <b className="tl-grade">{`  ${r.e.grade}`}</b> : null}
              </span>
            </Fragment>
          );
        })}
      </div>
      <div className="adm-preview-title" style={{ marginTop: 16 }}>
        periods
      </div>
      <ul className="adm-plain">
        {value.periods.map((p) => (
          <li key={p.id}>
            {p.from} to {p.to ?? "now"}: {p.label}
            {p.grade ? ` · ${p.grade}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArchPreview({ value }: { value: Settings["engineer.arch"] }) {
  return (
    <div className="adm-preview" style={PREVIEW_VARS}>
      <div className="adm-preview-title">preview: arch diagrams</div>
      {value.diagrams.map((d) => {
        let lines;
        try {
          lines = layoutArch({ ...d, edges: d.edges.map((e) => [e[0], e[1], e[2]] as [string, string, string?]) }, 100).lines;
        } catch {
          return (
            <p key={d.id} className="adm-error">
              {d.title}: could not lay out (check the edges name existing nodes).
            </p>
          );
        }
        return (
          <div key={d.id} className="adm-arch">
            <div className="adm-arch-title">{d.title}</div>
            <ArchView title={d.title} lines={lines} edges={d.edges.map((e) => [e[0], e[1]] as [string, string])} notes={d.notes} />
          </div>
        );
      })}
    </div>
  );
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 0;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function ThemesPreview({ value }: { value: Settings["engineer.themes"] }) {
  return (
    <div className="adm-preview">
      <div className="adm-preview-title">preview: swatches and contrast (text on the window background, 4.5:1 to pass)</div>
      <div className="adm-swatches">
        {value.palettes.map((p) => {
          const checks = [
            ["ink", p.ink],
            ["dim", p.dim],
            ["faint", p.faint],
            ["accent", p.accent],
          ] as const;
          return (
            <div key={p.id} className="adm-swatch" style={{ background: p.bg, color: p.ink, borderColor: p.faint }}>
              <div className="adm-swatch-head" style={{ background: p.void }}>
                {p.id}
              </div>
              <div className="adm-swatch-body">
                <span style={{ color: p.ink }}>ink</span> <span style={{ color: p.dim }}>dim</span> <span style={{ color: p.faint }}>faint</span> <span style={{ color: p.accent }}>accent</span>{" "}
                <span style={{ color: p.ok }}>ok</span> <span style={{ color: p.violet }}>violet</span>
              </div>
              <ul className="adm-contrast">
                {checks.map(([n, c]) => {
                  const r = contrast(c, p.bg);
                  return (
                    <li key={n} className={r >= 4.5 ? "is-pass" : "is-fail"}>
                      {n} {r.toFixed(1)}:1 {r >= 4.5 ? "pass" : "fail"}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ViewsPreview({ value }: { value: Settings["engineer.views"] }) {
  const enabled = value.views.filter((v) => v.enabled);
  const defaultOk = enabled.some((v) => v.id === value.defaultView);
  return (
    <div className="adm-preview">
      <div className="adm-preview-title">preview: the picker</div>
      <ul className="adm-plain">
        {enabled.map((v) => (
          <li key={v.id}>
            {v.id === value.defaultView ? "* " : ""}
            <b>{v.name}</b> /{v.id}: {v.line}
          </li>
        ))}
        {enabled.length === 0 ? <li>No view enabled: the page offers none.</li> : null}
      </ul>
      {!defaultOk ? <p className="adm-error">The default view is not an enabled view.</p> : <p className="adm-hint">* the default view</p>}
    </div>
  );
}

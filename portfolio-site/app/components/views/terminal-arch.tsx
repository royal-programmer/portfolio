"use client";

import { useState } from "react";
import { ARCH_GLYPH, ARCH_KINDS, type ArchRun } from "@/lib/site/terminal-arch";

/**
 * One `arch` diagram. The boxes and arrows are text; hovering or focusing a box lights it and the arrows
 * that touch it, and dims the rest.
 */
export function ArchView({ title, lines, edges, notes }: { title: string; lines: ArchRun[][]; edges: Array<[string, string]>; notes: string[] }) {
  const [hot, setHot] = useState<string | null>(null);
  const touches = (r: ArchRun) => (hot ? r.node === hot || !!r.edges?.some((i) => edges[i]?.[0] === hot || edges[i]?.[1] === hot) : false);
  const labels = new Map<string, string>();
  for (const row of lines) for (const r of row) if (r.node && !labels.has(r.node)) labels.set(r.node, r.t);
  return (
    <div className={`terminal-arch${hot ? " has-hot" : ""}`} role="group" aria-label={`${title}: diagram`} onMouseLeave={() => setHot(null)}>
      <pre className="terminal-arch-pre" aria-hidden="true">
        {lines.map((row, y) => (
          <span key={y} className="terminal-arch-row">
            {row.map((r, i) => {
              const cls = ["terminal-arch-run", r.kind ? `k-${r.kind}` : "", r.node ? "is-node" : r.edges ? "is-edge" : "", touches(r) ? "is-hot" : ""].filter(Boolean).join(" ");
              return r.node ? (
                <span key={i} className={cls} onMouseEnter={() => setHot(r.node!)}>
                  {r.t}
                </span>
              ) : (
                <span key={i} className={cls}>
                  {r.t}
                </span>
              );
            })}
            {"\n"}
          </span>
        ))}
      </pre>
      <ul className="terminal-arch-focus sr-only" role="list">
        {[...new Set(lines.flat().map((r) => r.node).filter((n): n is string => !!n))].map((id) => {
          const out = edges.filter((e) => e[0] === id).map((e) => e[1]);
          const into = edges.filter((e) => e[1] === id).map((e) => e[0]);
          return (
            <li key={id}>
              <button type="button" onFocus={() => setHot(id)} onBlur={() => setHot((h) => (h === id ? null : h))}>
                {`${id}: from ${into.join(", ") || "nothing"}, to ${out.join(", ") || "nothing"}`}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="terminal-arch-legend" aria-hidden="true">
        {ARCH_KINDS.map((k) => (
          <span key={k} className={`k-${k}`}>
            {`${ARCH_GLYPH[k]} ${k}`}
          </span>
        ))}
      </div>
      {notes.map((n) => (
        <span key={n} className="is-out is-dim terminal-arch-note">
          {n}
        </span>
      ))}
    </div>
  );
}

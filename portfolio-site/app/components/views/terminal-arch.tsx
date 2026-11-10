"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ARCH_GLYPH, ARCH_KINDS, type ArchRun } from "@/lib/site/terminal-arch";

/**
 * One `arch` diagram. The boxes and arrows are text; hovering or focusing a box lights it and the arrows
 * that touch it, and dims the rest.
 */
/** The kind glyphs come from fallback fonts of unequal width: each sits in a one-character cell so the box edge stays straight. */
const PIECE = /([▣⚙▤≋⇄⏱▶]|[─│┌┐└┘├┤┬┴┼]+)/;
const GLYPH = /^[▣⚙▤≋⇄⏱▶]$/;
/** Box-drawing characters too (they also come from a fallback font); letter-spacing, measured below, makes their rows as wide as the text's. */
const glyphs = (t: string) =>
  t.split(PIECE).map((p, i) =>
    i % 2 ? (
      <span key={i} className={GLYPH.test(p) ? "terminal-arch-g" : "terminal-arch-bx"}>
        {p}
      </span>
    ) : (
      p
    ),
  );

export function ArchView({ title, lines, edges, notes }: { title: string; lines: ArchRun[][]; edges: Array<[string, string]>; notes: string[] }) {
  const [hot, setHot] = useState<string | null>(null);
  const pre = useRef<HTMLPreElement>(null);
  // Line characters and text may come from different fonts: measure the difference once and spread it.
  useLayoutEffect(() => {
    const el = pre.current;
    if (!el) return;
    const probe = (ch: string) => {
      const s = document.createElement("span");
      s.style.cssText = "position:absolute;visibility:hidden;white-space:pre;display:inline";
      s.textContent = ch.repeat(40);
      el.appendChild(s);
      const w = s.getBoundingClientRect().width;
      el.removeChild(s);
      return w;
    };
    const d = (probe("0") - probe("─")) / 40;
    el.style.setProperty("--bx-ls", `${Math.abs(d) < 0.02 ? 0 : d}px`);
  }, [lines]);
  const touches = (r: ArchRun) => (hot ? r.node === hot || !!r.edges?.some((i) => edges[i]?.[0] === hot || edges[i]?.[1] === hot) : false);
  const labels = new Map<string, string>();
  for (const row of lines) for (const r of row) if (r.node && !labels.has(r.node)) labels.set(r.node, r.t);
  return (
    <div className={`terminal-arch${hot ? " has-hot" : ""}`} role="group" aria-label={`${title}: diagram`} onMouseLeave={() => setHot(null)}>
      <pre ref={pre} className="terminal-arch-pre" aria-hidden="true">
        {lines.map((row, y) => (
          <span key={y} className="terminal-arch-row">
            {row.map((r, i) => {
              const cls = ["terminal-arch-run", r.kind ? `k-${r.kind}` : "", r.node ? "is-node" : r.edges ? "is-edge" : "", touches(r) ? "is-hot" : ""].filter(Boolean).join(" ");
              return r.node ? (
                <span key={i} className={cls} onMouseEnter={() => setHot(r.node!)}>
                  {glyphs(r.t)}
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

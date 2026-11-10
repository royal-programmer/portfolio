"use client";

import { memo, useState, type CSSProperties } from "react";
import { cellTitle, langBlocks, type HeatCell, type HeatMonth, type StatsData } from "@/lib/site/terminal-stats";

const WEEKDAYS: Array<[number, string]> = [
  [1, "M"],
  [3, "W"],
  [5, "F"],
];

/** The contribution grid: month labels on top, weekday letters at the left, one cell per day. */
export const Heatmap = memo(function Heatmap({ weeks, months, narrow }: { weeks: HeatCell[][]; months: HeatMonth[]; narrow: boolean }) {
  const [hover, setHover] = useState("");
  const n = weeks.length;
  const style = { "--hm-n": n, "--hm-w": narrow ? "2.4ch" : "2ch" } as CSSProperties;
  return (
    <div className="terminal-hm" style={style} role="img" aria-label={`GitHub contributions, last ${n} weeks`} onMouseLeave={() => setHover("")}>
      <div className="terminal-hm-grid" style={{ gridTemplateColumns: `1.4ch repeat(${n}, minmax(0, 1fr))` }}>
        {months.map((m) => (
          <span key={m.col} className="terminal-hm-mon" style={{ gridColumn: m.col + 2, gridRow: 1 }}>
            {m.label}
          </span>
        ))}
        {WEEKDAYS.map(([r, l]) => (
          <span key={l} className="terminal-hm-wd" style={{ gridColumn: 1, gridRow: r + 2 }}>
            {l}
          </span>
        ))}
        {weeks.map((w, c) =>
          w.map((cell, r) =>
            cell ? (
              <span
                key={`${c}-${r}`}
                className="terminal-hm-c"
                data-l={cell.level}
                title={cellTitle(cell)}
                style={{ gridColumn: c + 2, gridRow: r + 2, animationDelay: `${Math.round((c * 600) / n)}ms` }}
                onMouseEnter={() => setHover(cellTitle(cell))}
              />
            ) : null,
          ),
        )}
      </div>
      <div className="terminal-hm-status" aria-hidden="true">
        {hover || "\u00a0"}
      </div>
    </div>
  );
});

/** The language bar: one line of `█` runs in the accent with alternating strength, the labels under it. */
export const LangBar = memo(function LangBar({ langs, width }: { langs: StatsData["languages"]; width: number }) {
  const blocks = langBlocks(langs, width);
  return (
    <div className="terminal-lb">
      <div className="terminal-lb-bar" aria-hidden="true">
        {langs.map((l, i) => (
          <span key={l.name} className={i % 2 ? "is-alt" : undefined}>
            {"█".repeat(blocks[i])}
          </span>
        ))}
      </div>
      <div className="terminal-lb-labels">
        {langs.map((l, i) => (
          <span key={l.name}>
            {i ? " · " : ""}
            <b className={i % 2 ? "is-alt" : undefined}>■</b> {l.name} {l.pct}%
          </span>
        ))}
      </div>
    </div>
  );
});

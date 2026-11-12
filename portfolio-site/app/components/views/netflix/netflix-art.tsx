"use client";

/**
 * One inline SVG of generated key art (17-persona-views.md §21, C1), plus the impact figure as its focal text.
 * Decorative (`aria-hidden`: the figure is also in the item's own text), memoised per seed, tone, shape and figure.
 * The colour is the parent's `--b`; `data-live` (the hero and the modal billboard only) lets the rays drift slowly.
 */
import { memo } from "react";
import { artFor, type ArtShape } from "@/lib/site/netflix-art";
import type { Metric } from "@/lib/site/netflix-data";

type Props = { seed: string; tone: string; shape?: ArtShape; metric?: Metric; /** The large kind: hero and modal billboard. */ big?: boolean; live?: boolean };

export const NfArt = memo(function NfArt({ seed, tone, shape = "wide", metric, big, live }: Props) {
  const a = artFor(seed, tone, shape);
  return (
    <span className="nf-art2" aria-hidden data-big={big || undefined} data-live={live || undefined} data-shape={shape}>
      <svg viewBox={`0 0 ${a.w} ${a.h}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        {a.paths.map((p, i) => (
          <path key={i} d={p.d} className={`nf-art2-${p.kind}`} style={{ opacity: p.opacity }} strokeWidth={p.width} />
        ))}
        {a.circles.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} className="nf-art2-ring" style={{ opacity: c.opacity }} strokeWidth={c.width} />
        ))}
      </svg>
      {metric ? (
        <span className="nf-art2-m" style={{ "--len": Math.max(3, metric.value.length) } as React.CSSProperties}>
          <b>{metric.value}</b>
          <i>{metric.label}</i>
        </span>
      ) : null}
    </span>
  );
});

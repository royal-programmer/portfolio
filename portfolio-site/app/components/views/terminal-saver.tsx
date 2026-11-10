"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { portraitSampler, renderPortrait, type PortraitArt, type PortraitConfig } from "@/lib/site/portrait-gen";

const NL = String.fromCharCode(10);
const clock = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * The screensaver: the portrait in matrix mode, its brightness threshold drifting slowly so it breathes,
 * the local time, and one dim line. Fades in over 600 ms, out over 200 ms (`leaving`). The parent owns
 * the keys: any of them dismisses it.
 */
export function TerminalSaver({ cfg, narrow, line, leaving, reduce }: { cfg: PortraitConfig; narrow: boolean; line: string; leaving: boolean; reduce: boolean }) {
  const [art, setArt] = useState<PortraitArt | null>(null);
  const [shown, setShown] = useState(false);
  const [time, setTime] = useState(clock);
  const cols = narrow ? 40 : 100;

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let live = true;
    let timer = 0;
    portraitSampler(cfg).then(
      ({ sample, aspect }) => {
        if (!live) return;
        const draw = (bias: number) => live && setArt(renderPortrait("matrix", cols, aspect, sample, bias));
        draw(0);
        if (reduce) return;
        const t0 = performance.now();
        // About 7 frames a second: the threshold swings a little either way every nine seconds.
        timer = window.setInterval(() => {
          if (document.visibilityState === "visible") draw(0.16 * Math.sin(((performance.now() - t0) / 9000) * Math.PI * 2));
        }, 140);
      },
      () => {},
    );
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [cfg, cols, reduce]);

  useEffect(() => {
    const id = window.setInterval(() => setTime(clock()), 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`terminal-saver${shown && !leaving ? " is-in" : ""}`} role="img" aria-label={`Screensaver. ${time}. ${line}`}>
      {art ? (
        <pre className="terminal-os-portrait is-matrix terminal-saver-art" aria-hidden="true" style={{ "--p-cols": art.cols, "--p-rows": art.rows, "--p-adv": art.adv } as CSSProperties}>
          {art.lines.map((runs, y) => (
            <Fragment key={y}>
              {runs.map((r, i) => (
                <span key={i} style={{ color: r.c, fontWeight: r.bold ? 700 : undefined }}>
                  {r.t}
                </span>
              ))}
              {NL}
            </Fragment>
          ))}
        </pre>
      ) : null}
      <div className="terminal-saver-clock" aria-hidden="true">
        {time}
      </div>
      <div className="terminal-saver-line" aria-hidden="true">
        {line}
      </div>
    </div>
  );
}

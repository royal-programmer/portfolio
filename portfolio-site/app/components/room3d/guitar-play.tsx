"use client";

/**
 * The guitar app (round 37d): when the camera is at the guitar's close-up (the hidden `guitar-play` zone), this overlay is the
 * instrument. A fretboard fills the view (six strings, twelve frets spaced like a real neck, marker dots, string names and
 * numbers, an "open" strip before the nut), laid across on a wide screen and up and down on a phone held upright. Tap a
 * string between two frets and that exact note plays (recorded samples, pitch-shifted); swipe across the strings and they sound
 * in order, 30 ms apart; the chord buttons strum a shape. The overlay owns the pointer (camera drag is off, and says so), Esc or
 * Back leaves. Sound comes from lib/room3d/guitar-audio.ts and only while the site's Sound is on.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { FRETS, MARKERS, STRING_NAMES, STRING_NUMBERS, fretAt, fretLine, fretMid, swipeStart, CHORD_SHAPES, type ChordId } from "@/lib/room3d/guitar";
import { loadSamples, playNote, samplesReady, strumChordNotes } from "@/lib/room3d/guitar-audio";

/** The part of the neck's length before the nut that is the open-string strip. */
const OPEN = 0.1;
const THICK = [3.4, 2.9, 2.3, 1.8, 1.4, 1.1];

type Dot = { id: number; string: number; fret: number };

export function GuitarPlay({ chords, sound, onBack, onSilent }: { chords: readonly ChordId[]; sound: boolean; onBack: () => void; onSilent: () => void }) {
  const neck = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  const [pulse, setPulse] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [dots, setDots] = useState<Dot[]>([]);
  const [status, setStatus] = useState<"loading" | "samples" | "synth">(samplesReady() ? "samples" : "loading");
  const down = useRef<{ band: number; nextFree: number } | null>(null);
  const dotId = useRef(0);

  // The samples load the first time the guitar is zoomed; until they are in (or if they fail) the plucked-string synth answers.
  useEffect(() => {
    let live = true;
    void loadSamples().then((ok) => live && setStatus(ok ? "samples" : "synth"));
    return () => {
      live = false;
    };
  }, []);

  // Laid out along the longer side of the space the neck has.
  useEffect(() => {
    const el = neck.current;
    if (!el) return;
    const measure = () => setWide(el.clientWidth >= el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flashDot = useCallback((string: number, fret: number) => {
    const id = ++dotId.current;
    setDots((d) => [...d.slice(-8), { id, string, fret }]);
    window.setTimeout(() => setDots((d) => d.filter((x) => x.id !== id)), 650);
  }, []);
  const shiver = useCallback((string: number) => setPulse((p) => p.map((v, i) => (i === string ? v + 1 : v))), []);

  /** The string band and the fret under a point of the neck. */
  const at = useCallback(
    (cx: number, cy: number) => {
      const r = neck.current!.getBoundingClientRect();
      const along = wide ? (cx - r.left) / r.width : (cy - r.top) / r.height;
      const across = wide ? (cy - r.top) / r.height : (cx - r.left) / r.width;
      const band = Math.max(0, Math.min(5, Math.floor(across * 6)));
      const u = (along - OPEN) / (1 - OPEN);
      return { band, fret: along < OPEN || u <= 0 ? 0 : fretAt(u) };
    },
    [wide],
  );

  const sound1 = (string: number, fret: number, delay: number) => {
    shiver(string);
    flashDot(string, fret);
    if (!sound) return onSilent();
    playNote(string, fret, delay);
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e.clientX, e.clientY);
    down.current = { band: p.band, nextFree: performance.now() };
    sound1(p.band, p.fret, 0);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = down.current;
    if (!d) return;
    const p = at(e.clientX, e.clientY);
    if (p.band === d.band) return;
    // Every string the finger crossed since the last one, in order, each at least 30 ms after the one before.
    const dir = p.band > d.band ? 1 : -1;
    for (let s = d.band + dir; dir > 0 ? s <= p.band : s >= p.band; s += dir) {
      const now = performance.now() / 1000;
      const start = swipeStart(now, d.nextFree / 1000);
      d.nextFree = start * 1000;
      sound1(s, p.fret, start - now);
    }
    d.band = p.band;
  };
  const onUp = () => {
    down.current = null;
  };

  const chord = (id: ChordId) => {
    CHORD_SHAPES[id].forEach((f, s) => f >= 0 && (shiver(s), flashDot(s, f)));
    if (!sound) return onSilent();
    strumChordNotes(id);
  };

  // Where things sit: along the neck and across it, as left/top for the current orientation.
  const pos = (along: number, across: number) => (wide ? { left: `${along * 100}%`, top: `${across * 100}%` } : { left: `${across * 100}%`, top: `${along * 100}%` });
  const fretX = (n: number) => OPEN + (1 - OPEN) * fretLine(n);
  const midX = (n: number) => (n === 0 ? OPEN / 2 : OPEN + (1 - OPEN) * fretMid(n));
  const row = (i: number) => (i + 0.5) / 6;

  return (
    <div className="gp" data-wide={wide ? "true" : "false"} role="group" aria-label="Guitar. Tap a string between two frets to play that note, swipe across the strings to strum.">
      <div className="gp-bar">
        <button type="button" className="rx-btn gp-back" onClick={onBack}>
          <span aria-hidden>←</span> Back
        </button>
        <span className="gp-title">Guitar</span>
        <span className="gp-hint">Drag is off while you play. Tap a string between frets, swipe to strum. Esc leaves.</span>
      </div>
      <div ref={neck} className="gp-neck" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()}>
        <div className="gp-board" style={wide ? { left: `${OPEN * 100}%`, right: 0, top: 0, bottom: 0 } : { top: `${OPEN * 100}%`, bottom: 0, left: 0, right: 0 }} />
        <div className="gp-nut" style={wide ? { left: `${OPEN * 100}%`, top: 0, bottom: 0 } : { top: `${OPEN * 100}%`, left: 0, right: 0 }} />
        {Array.from({ length: FRETS }, (_, i) => i + 1).map((n) => (
          <div key={`f${n}`} className="gp-fret" style={wide ? { left: `${fretX(n) * 100}%`, top: 0, bottom: 0 } : { top: `${fretX(n) * 100}%`, left: 0, right: 0 }} />
        ))}
        {MARKERS.map((n) =>
          n === 12 ? (
            [2, 4].map((k) => <span key={`m12${k}`} className="gp-marker" style={pos(midX(n), k / 6)} />)
          ) : (
            <span key={`m${n}`} className="gp-marker" style={pos(midX(n), 0.5)} />
          ),
        )}
        {Array.from({ length: FRETS }, (_, i) => i + 1).map((n) => (
          <span key={`n${n}`} className="gp-fretno" data-marker={(MARKERS as readonly number[]).includes(n) ? "true" : "false"} style={wide ? { left: `${midX(n) * 100}%`, bottom: 4 } : { top: `${midX(n) * 100}%`, right: 6 }}>
            {n}
          </span>
        ))}
        <span className="gp-open" style={wide ? { left: `${(OPEN / 2) * 100}%`, bottom: 4 } : { top: `calc(${OPEN * 100}% - 12px)`, left: 8 }}>
          open
        </span>
        {STRING_NAMES.map((name, i) => (
          <div key={`s${i}`} className="gp-stringrow" style={wide ? { top: `${row(i) * 100}%`, left: 0, right: 0 } : { left: `${row(i) * 100}%`, top: 0, bottom: 0 }}>
            <span key={pulse[i]} className="gp-string" data-hit={pulse[i] > 0 ? "true" : "false"} style={wide ? { height: THICK[i], background: i < 3 ? "#d8b36a" : "#dfe6f2" } : { width: THICK[i], background: i < 3 ? "#d8b36a" : "#dfe6f2" }} />
            <span className="gp-label" style={wide ? { left: 6, top: "50%" } : { left: "50%", top: 6 }}>
              {STRING_NUMBERS[i]} <b>{name}</b>
            </span>
          </div>
        ))}
        {dots.map((d) => (
          <span key={d.id} className="gp-dot" style={pos(midX(d.fret), row(d.string))} />
        ))}
      </div>
      <div className="gp-chords" role="group" aria-label="Chords">
        {chords.map((id) => (
          <button key={id} type="button" className="rx-btn gp-chord" onClick={() => chord(id)}>
            {id}
          </button>
        ))}
        <span className="gp-status" role="status">
          {!sound ? "Sound is off. Turn Sound on to hear it." : status === "loading" ? "Loading the guitar..." : status === "samples" ? "Recorded guitar" : "Synth guitar (the recording could not load)"}
        </span>
      </div>
    </div>
  );
}

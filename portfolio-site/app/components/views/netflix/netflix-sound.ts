/**
 * Two tiny WebAudio sounds, synthesized from our own notes (no samples, nothing borrowed): a two-note
 * "ta-dum" chime when the modal opens, and a 30 ms tick when a card expands. Only called when unmuted.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(c: AudioContext, freq: number, start: number, dur: number, peak: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** ~400 ms: a low note, then a fifth above it. */
export function chime() {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  note(c, 130.8, t, 0.2, 0.22, "triangle");
  note(c, 196, t + 0.14, 0.26, 0.2, "triangle");
}

export function tick() {
  const c = context();
  if (!c) return;
  note(c, 880, c.currentTime, 0.03, 0.05);
}

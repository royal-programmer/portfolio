/**
 * The football's kick sound (round 37d), synthesised with Web Audio, no file: a short burst of noise through a band-pass (the
 * slap of the foot) over a sine that drops in pitch (the body of the ball), both with a quick decay. Call it from a click, and
 * only while the site's sound is on (the page decides).
 */
let ctx: AudioContext | null = null;

/** The envelope of the thud as numbers (checked in `scripts/room3d-check.mjs`): the sine's start and end pitch (Hz) and the whole sound's length (s). */
export const THUD = { from: 150, to: 48, length: 0.22 } as const;

export function thud(power = 1): boolean {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx ??= new AC();
  const c = ctx;
  if (c.state === "suspended") void c.resume();
  const t0 = c.currentTime + 0.005;
  const gain = Math.min(1, 0.35 + 0.65 * power);
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.8 * gain, t0 + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + THUD.length);
  out.connect(c.destination);
  const n = Math.round(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 180;
  band.Q.value = 0.9;
  noise.connect(band).connect(out);
  noise.start(t0);
  const body = c.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(THUD.from, t0);
  body.frequency.exponentialRampToValueAtTime(THUD.to, t0 + 0.12);
  const bg = c.createGain();
  bg.gain.value = 0.9;
  body.connect(bg).connect(out);
  body.start(t0);
  body.stop(t0 + THUD.length + 0.02);
  window.setTimeout(() => out.disconnect(), (THUD.length + 0.2) * 1000);
  return true;
}

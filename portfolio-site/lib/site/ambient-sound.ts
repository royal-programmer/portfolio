/**
 * Ambient sound for the VR journey (D38) — synthesised with Web Audio, no
 * audio files. Off by default; starts only from a user gesture.
 *
 *   drone      two soft low tones + filtered "air", slowly breathing
 *   depth      journey progress opens the filter (the world brightens)
 *   rush       the approach: wind rises with the light's speed
 *   timeScale  slowing time: pitch falls, the filter closes, a sub swells and
 *              a thin high shimmer appears — the "underwater" feeling. Follows
 *              the scene's real time scale, so it glides rather than switches.
 *   chime      a glassy shimmer when the light strikes / you enter a world
 *   impact     the strike: a sub drop under the chime
 */
type Engine = {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  oscs: OscillatorNode[];
  wind: GainNode;
  windBand: BiquadFilterNode;
  sub: GainNode;
  subOsc: OscillatorNode;
  shimmer: GainNode;
  depth: number;
  scale: number;
};

let engine: Engine | null = null;

function build(): Engine | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.7;
  filter.connect(master);
  master.connect(ctx.destination);

  const tone = (freq: number, type: OscillatorType, gain: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    o.start();
    return o;
  };
  const oscs = [tone(55, "sine", 0.32), tone(82.4, "triangle", 0.1), tone(110.3, "sine", 0.12), tone(164.8, "sine", 0.035)];

  // Slow breathing on the upper partial.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 4;
  lfo.connect(lfoGain).connect(oscs[2].detune);
  lfo.start();

  // "Air": looped filtered noise. Also the wind of the approach.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const windBand = ctx.createBiquadFilter();
  windBand.type = "bandpass";
  windBand.frequency.value = 900;
  windBand.Q.value = 0.6;
  const wind = ctx.createGain();
  wind.gain.value = 0.025;
  noise.connect(windBand).connect(wind).connect(filter);
  noise.start();

  // Sub: felt more than heard; swells when time slows and on impact.
  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.value = 36;
  const sub = ctx.createGain();
  sub.gain.value = 0;
  subOsc.connect(sub).connect(master);
  subOsc.start();

  // Shimmer: a thin, slowly beating high pair that surfaces when time slows.
  const shimmer = ctx.createGain();
  shimmer.gain.value = 0;
  for (const f of [1318.5, 1324.5]) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    o.connect(g).connect(shimmer);
    o.start();
  }
  shimmer.connect(master);

  return { ctx, master, filter, oscs, wind, windBand, sub, subOsc, shimmer, depth: 0, scale: 1 };
}

function applyFilter(e: Engine) {
  // Depth opens the filter; slowed time closes it again (muffled, underwater).
  const open = 380 + Math.pow(e.depth, 1.3) * 2200;
  const f = open * (0.18 + 0.82 * e.scale);
  e.filter.frequency.setTargetAtTime(f, e.ctx.currentTime, 0.25);
}

export const ambient = {
  /** Must be called from a user gesture (click / key). */
  start() {
    if (!engine) engine = build();
    if (!engine) return;
    const { ctx, master } = engine;
    void ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2);
  },
  stop() {
    if (!engine) return;
    const { ctx, master } = engine;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  },
  /** 0…1 journey progress → filter opens. */
  depth(p: number) {
    if (!engine) return;
    engine.depth = Math.min(1, Math.max(0, p));
    applyFilter(engine);
  },
  /** 0…1 how fast the light is rushing at you: the wind rises and sharpens. */
  rush(speed: number) {
    if (!engine) return;
    const s = Math.min(1, Math.max(0, speed));
    const now = engine.ctx.currentTime;
    engine.wind.gain.setTargetAtTime(0.025 + s * s * 0.16, now, 0.2);
    engine.windBand.frequency.setTargetAtTime(900 + s * 1900, now, 0.2);
  },
  /** Time scale: 1 = normal, 0.1 = fully slowed. Glides; call as often as it changes. */
  timeScale(s: number) {
    if (!engine) return;
    const k = Math.min(1, Math.max(0, (s - 0.1) / 0.9)); // 1 normal … 0 slowed
    engine.scale = k;
    const now = engine.ctx.currentTime;
    const cents = (1 - k) * -700;
    for (const o of engine.oscs) o.detune.setTargetAtTime(cents, now, 0.3);
    engine.sub.gain.setTargetAtTime((1 - k) * 0.2, now, 0.35);
    engine.shimmer.gain.setTargetAtTime((1 - k) * 0.012, now, 0.5);
    applyFilter(engine);
  },
  chime(pitch = 1) {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx } = engine;
    const now = ctx.currentTime;
    [1, 1.5, 2.01, 3.02].forEach((m, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 660 * pitch * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.06 / (i + 1), now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4 - i * 0.3);
      o.connect(g).connect(engine!.master);
      o.start(now);
      o.stop(now + 2.5);
    });
  },
  /** The strike: a sub drop under the chime, then the wind falls away. */
  impact() {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx, sub, subOsc, wind } = engine;
    const now = ctx.currentTime;
    subOsc.frequency.cancelScheduledValues(now);
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(36, now + 1.4);
    sub.gain.cancelScheduledValues(now);
    sub.gain.setValueAtTime(0.5, now);
    sub.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    wind.gain.setTargetAtTime(0.025, now, 0.6);
    this.chime(1);
  },
};

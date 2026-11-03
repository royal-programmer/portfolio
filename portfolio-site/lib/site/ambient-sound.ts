/**
 * Ambient sound for the light journey (D36) — synthesised with Web Audio, no
 * audio files. Off by default; starts only from a user gesture.
 *
 *   drone   two soft low tones + filtered "air", slowly breathing
 *   depth   scroll progress opens the filter (the world brightens as you travel)
 *   hold    holding "slows time": the drone detunes downward
 *   chime   a glassy shimmer when the light strikes the prism / you enter a world
 */
type Engine = {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  oscs: OscillatorNode[];
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

  // "Air": looped filtered noise.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 900;
  band.Q.value = 0.6;
  const ng = ctx.createGain();
  ng.gain.value = 0.025;
  noise.connect(band).connect(ng).connect(filter);
  noise.start();

  return { ctx, master, filter, oscs };
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
    const f = 380 + Math.pow(Math.min(1, Math.max(0, p)), 1.3) * 2200;
    engine.filter.frequency.setTargetAtTime(f, engine.ctx.currentTime, 0.3);
  },
  /** Time-bend while holding: 1 = normal, 0 = fully slowed. */
  timeScale(s: number) {
    if (!engine) return;
    const cents = (1 - s) * -240;
    for (const o of engine.oscs) o.detune.setTargetAtTime(cents, engine.ctx.currentTime, 0.25);
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
};

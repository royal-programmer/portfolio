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
 *   scene      the soundscape under everything — Ambient (the drone), Night wind,
 *              Rain, Deep hum — the visitor's pick, remembered
 */
export type SoundScene = "ambient" | "wind" | "rain" | "hum";
export const SOUND_SCENES: ReadonlyArray<{ id: SoundScene; label: string }> = [
  { id: "ambient", label: "Ambient" },
  { id: "wind", label: "Night wind" },
  { id: "rain", label: "Rain" },
  { id: "hum", label: "Deep hum" },
];
type Engine = {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  oscs: OscillatorNode[];
  oscGains: GainNode[];
  oscBase: number[];
  wind: GainNode;
  windBand: BiquadFilterNode;
  windLfo: GainNode;
  rain: GainNode;
  rainFlutter: GainNode;
  sub: GainNode;
  subOsc: OscillatorNode;
  shimmer: GainNode;
  depth: number;
  scale: number;
  /** The drone is on (start was called, stop was not). */
  on: boolean;
  /** 1 normally (kept for a future layer that sits over the drone). */
  duck: number;
  scene: SoundScene;
  /** Per-scene shaping. */
  windBase: number;
  filterScale: number;
  subBase: number;
};

let engine: Engine | null = null;
let pendingScene: SoundScene = "ambient";

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

  const oscGains: GainNode[] = [];
  const tone = (freq: number, type: OscillatorType, gain: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    o.start();
    oscGains.push(g);
    return o;
  };
  // Sines only: the triangle's harmonics read as a buzz through the filter (Ratul, round B).
  const oscBase = [0.26, 0.09, 0.1, 0.03];
  const oscs = [tone(55, "sine", oscBase[0]), tone(82.4, "sine", oscBase[1]), tone(110.3, "sine", oscBase[2]), tone(164.8, "sine", oscBase[3])];

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
  // Night wind: the band wanders slowly (gusts) — the LFO's depth is 0 unless that scene is on.
  const windLfoOsc = ctx.createOscillator();
  windLfoOsc.frequency.value = 0.045;
  const windLfo = ctx.createGain();
  windLfo.gain.value = 0;
  windLfoOsc.connect(windLfo).connect(windBand.frequency);
  windLfoOsc.start();
  // Rain: the same noise, high and thin, straight to the master (not through the drone's filter),
  // with a slow flutter so it never reads as a flat hiss.
  const rainBand = ctx.createBiquadFilter();
  rainBand.type = "bandpass";
  rainBand.frequency.value = 3800;
  rainBand.Q.value = 0.35;
  const rainHp = ctx.createBiquadFilter();
  rainHp.type = "highpass";
  rainHp.frequency.value = 1400;
  const rain = ctx.createGain();
  rain.gain.value = 0;
  const rainFlutterOsc = ctx.createOscillator();
  rainFlutterOsc.frequency.value = 0.23;
  const rainFlutter = ctx.createGain();
  rainFlutter.gain.value = 0;
  rainFlutterOsc.connect(rainFlutter).connect(rain.gain);
  rainFlutterOsc.start();
  noise.connect(rainHp).connect(rainBand).connect(rain).connect(master);
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

  return { ctx, master, filter, oscs, oscGains, oscBase, wind, windBand, windLfo, rain, rainFlutter, sub, subOsc, shimmer, depth: 0, scale: 1, on: false, duck: 1, scene: "ambient", windBase: 0.025, filterScale: 1, subBase: 0 };
}

function applyFilter(e: Engine) {
  // Depth opens the filter; slowed time closes it again (muffled, underwater).
  const open = (380 + Math.pow(e.depth, 1.3) * 2200) * e.filterScale;
  const f = open * (0.18 + 0.82 * e.scale);
  e.filter.frequency.setTargetAtTime(f, e.ctx.currentTime, 0.25);
}

/** The soundscape: what sits under the journey. Glides between scenes over a couple of seconds. */
function applyScene(e: Engine) {
  const now = e.ctx.currentTime;
  const T = 1.6;
  const set = (p: AudioParam, v: number, t = T) => {
    p.cancelScheduledValues(now);
    p.setTargetAtTime(v, now, t / 3);
  };
  // drone level · wind level · wind band · gust depth · rain level · flutter · filter · sub
  const S: Record<SoundScene, [number, number, number, number, number, number, number, number]> = {
    ambient: [1, 0.025, 900, 0, 0, 0, 1, 0],
    wind: [0.4, 0.11, 700, 420, 0, 0, 1.1, 0],
    rain: [0.3, 0.012, 900, 0, 0.055, 0.012, 0.9, 0],
    hum: [1.25, 0.008, 900, 0, 0, 0, 0.6, 0.11],
  };
  const [drone, windLv, band, gust, rainLv, flutter, filt, sub] = S[e.scene];
  e.oscGains.forEach((g, i) => set(g.gain, e.oscBase[i] * drone));
  e.windBase = windLv;
  set(e.wind.gain, windLv);
  set(e.windBand.frequency, band);
  set(e.windLfo.gain, gust);
  set(e.rain.gain, rainLv);
  set(e.rainFlutter.gain, flutter);
  e.filterScale = filt;
  e.subBase = sub;
  set(e.sub.gain, sub + (1 - e.scale) * 0.2);
  applyFilter(e);
}

export const ambient = {
  /** Must be called from a user gesture (click / key). */
  start() {
    if (!engine) {
      engine = build();
      if (engine && pendingScene !== "ambient") {
        engine.scene = pendingScene;
        applyScene(engine);
      }
    }
    if (!engine) return;
    const { ctx, master } = engine;
    void ctx.resume();
    engine.on = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.55 * engine.duck, ctx.currentTime, 1.2);
  },
  /** The soundscape (Ambient / Night wind / Rain / Deep hum). Safe before start: applied when it builds. */
  scene(scene: SoundScene) {
    pendingScene = scene;
    if (!engine) return;
    if (engine.scene === scene) return;
    engine.scene = scene;
    applyScene(engine);
  },
  /** After a reload the context starts suspended: resume on the first gesture. */
  resume() {
    if (!engine || engine.ctx.state !== "suspended") return;
    void engine.ctx.resume();
  },
  stop() {
    if (!engine) return;
    engine.on = false;
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
    engine.wind.gain.setTargetAtTime(engine.windBase + s * s * 0.16, now, 0.2);
    if (engine.scene !== "wind") engine.windBand.frequency.setTargetAtTime(900 + s * 1900, now, 0.2);
  },
  /** Time scale: 1 = normal, 0.1 = fully slowed. Glides; call as often as it changes. */
  timeScale(s: number) {
    if (!engine) return;
    const k = Math.min(1, Math.max(0, (s - 0.1) / 0.9)); // 1 normal … 0 slowed
    engine.scale = k;
    const now = engine.ctx.currentTime;
    const cents = (1 - k) * -700;
    for (const o of engine.oscs) o.detune.setTargetAtTime(cents, now, 0.3);
    engine.sub.gain.setTargetAtTime(engine.subBase + (1 - k) * 0.2, now, 0.35);
    engine.shimmer.gain.setTargetAtTime((1 - k) * 0.012, now, 0.5);
    applyFilter(engine);
  },
  /** One keystroke: a short filtered click. */
  key() {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx } = engine;
    const now = ctx.currentTime;
    const len = 0.03;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2600 + Math.random() * 1400;
    band.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    src.connect(band).connect(g).connect(engine.master);
    src.start(now);
  },
  /** Focus lock: two quick high beeps. */
  lock() {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx } = engine;
    const now = ctx.currentTime;
    [0, 0.09].forEach((dt) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 2200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + dt);
      g.gain.linearRampToValueAtTime(0.08, now + dt + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.06);
      o.connect(g).connect(engine!.master);
      o.start(now + dt);
      o.stop(now + dt + 0.08);
    });
  },
  /** The shutter: mirror up, curtain, mirror down — three clicks and a thump. */
  shutter() {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx } = engine;
    const now = ctx.currentTime;
    const click = (at: number, gain: number, f: number) => {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.02), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = f;
      band.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(band).connect(g).connect(engine!.master);
      src.start(now + at);
    };
    click(0, 0.35, 1800);
    click(0.07, 0.25, 900);
    click(0.16, 0.3, 1400);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    o.connect(g).connect(engine.master);
    o.start(now);
    o.stop(now + 0.15);
  },
  /** Target hit: a rising two-note tick. */
  target() {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx } = engine;
    const now = ctx.currentTime;
    [[880, 0], [1320, 0.12]].forEach(([f, dt]) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + dt);
      g.gain.linearRampToValueAtTime(0.09, now + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.35);
      o.connect(g).connect(engine!.master);
      o.start(now + dt);
      o.stop(now + dt + 0.4);
    });
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
  /** The rewind: the drone winds down like a tape stop, a whoosh falls through the wind, then silence. */
  rewind() {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx, oscs, wind, windBand, master } = engine;
    const now = ctx.currentTime;
    for (const o of oscs) {
      o.detune.cancelScheduledValues(now);
      o.detune.setValueAtTime(o.detune.value, now);
      o.detune.linearRampToValueAtTime(-2400, now + 1.4);
    }
    wind.gain.cancelScheduledValues(now);
    wind.gain.setValueAtTime(Math.max(0.02, wind.gain.value), now);
    wind.gain.linearRampToValueAtTime(0.22, now + 1.0);
    wind.gain.linearRampToValueAtTime(0.0001, now + 1.6);
    windBand.frequency.cancelScheduledValues(now);
    windBand.frequency.setValueAtTime(900, now);
    windBand.frequency.exponentialRampToValueAtTime(3400, now + 1.2);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(1400, now);
    o.frequency.exponentialRampToValueAtTime(50, now + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + 1.6);
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.setTargetAtTime(0, now + 1.25, 0.2);
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
    wind.gain.setTargetAtTime(engine.windBase, now, 0.6);
    this.chime(1);
  },
};

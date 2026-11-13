/**
 * Procedural textures for the 3D room (18-3d-room-plan.md P0): drawn on a canvas, 512 px at most, so the
 * room ships no image files. A small seeded random keeps every load identical.
 */
import * as THREE from "three";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number], aniso = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Wood planks with grain: long streaks, per-plank tone, dark seams. */
export function woodTexture(size: number, base = "#7a5233", repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const r = rng(7);
  const planks = 6;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const tone = (r() - 0.5) * 0.18;
    g.fillStyle = base;
    g.fillRect(p * pw, 0, pw, size);
    g.fillStyle = tone > 0 ? `rgba(255,220,170,${tone})` : `rgba(0,0,0,${-tone})`;
    g.fillRect(p * pw, 0, pw, size);
    for (let i = 0; i < 70; i++) {
      const x = p * pw + r() * pw;
      const w = 0.5 + r() * 1.6;
      const dark = r() < 0.6;
      g.strokeStyle = dark ? `rgba(40,20,8,${0.05 + r() * 0.12})` : `rgba(255,230,190,${0.03 + r() * 0.07})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, 0);
      const wob = (r() - 0.5) * 6;
      g.bezierCurveTo(x + wob, size * 0.3, x - wob, size * 0.7, x + wob * 0.5, size);
      g.stroke();
    }
    g.fillStyle = "rgba(20,10,4,0.55)";
    g.fillRect(p * pw, 0, 1.5, size);
  }
  return finish(c, true, repeat);
}

/** A woven fabric: crossing threads on a tinted ground. */
export function fabricTexture(size: number, base = "#3c4466", repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const r = rng(11);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const o = (x / step + y / step) % 2 === 0;
      g.fillStyle = o ? `rgba(255,255,255,${0.04 + r() * 0.05})` : `rgba(0,0,0,${0.06 + r() * 0.06})`;
      g.fillRect(x, y, step - 1, step - 1);
    }
  }
  return finish(c, true, repeat);
}

/** A soft plaster/noise height field, as a tangent-space normal map (a subtle surface, not bumps). */
export function noiseNormal(size: number, strength = 1.2, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const h = new Float32Array(size * size);
  const r = rng(23);
  // Value noise at three scales.
  const grid = (n: number) => Float32Array.from({ length: (n + 1) * (n + 1) }, () => r());
  const layers = [grid(8), grid(32), grid(128)];
  const amp = [0.55, 0.3, 0.15];
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (let l = 0; l < 3; l++) {
        const n = [8, 32, 128][l];
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = sm(fx - x0);
        const ty = sm(fy - y0);
        const G = layers[l];
        const w = n + 1;
        const a = G[y0 * w + x0];
        const b = G[y0 * w + (x0 + 1) % n];
        const c2 = G[((y0 + 1) % n) * w + x0];
        const d = G[((y0 + 1) % n) * w + (x0 + 1) % n];
        v += amp[l] * (a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty);
      }
      h[y * size + x] = v;
    }
  }
  const c = canvas(size);
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
      const dy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
      const nx = -dx * strength * 8;
      const ny = -dy * strength * 8;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, false, repeat);
}

/** A code-editor look for a monitor: dark ground, coloured token runs, a status bar. */
export function screenTexture(w: number, h: number, accent = "#7aa2ff"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const r = rng(3);
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#0c1020");
  grd.addColorStop(1, "#141a33");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#0a0d1a";
  g.fillRect(0, 0, w * 0.12, h);
  g.fillRect(0, h - 18, w, 18);
  g.fillStyle = accent;
  g.fillRect(0, h - 18, w * 0.2, 18);
  const colours = ["#7aa2ff", "#c792ea", "#89ddff", "#c3e88d", "#f78c6c", "#9aa5ce"];
  for (let line = 0; line < 22; line++) {
    let x = w * 0.15 + (line % 5 === 0 ? 0 : (line % 3) * 14);
    const y = 14 + line * 11;
    for (let run = 0; run < 3 + Math.floor(r() * 4); run++) {
      const len = 12 + r() * 60;
      g.fillStyle = colours[Math.floor(r() * colours.length)];
      g.globalAlpha = 0.85;
      g.fillRect(x, y, len, 4);
      x += len + 6;
    }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Screens and drifting-pane atlases for the other worlds (D38 round C), drawn
 * in code. Nothing here claims to be a record: charts are random walks with
 * percentages, camera readouts are settings, routes are lines with pins, and
 * the gamer's screen shows the handle. Ratul's own screenshots and photos
 * replace the drawn pictures as they arrive (`public/hub/<persona>/`).
 */
import * as THREE from "three";
import { spectrumHue } from "@/lib/site/spectrum";
import { ATLAS_N, ATLAS_TILES, display, drawChart, drawGlyph, makeTexture, mono, palette } from "./screens";

const TW = 512;
const TH = 256;

function atlas(t: number, tile: (ctx: CanvasRenderingContext2D, i: number, x: number, y: number) => void): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = TW * ATLAS_N;
  canvas.height = TH * ATLAS_N;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => {
    ctx.fillStyle = "#0b0b11";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < ATLAS_TILES; i++) tile(ctx, i, (i % ATLAS_N) * TW, Math.floor(i / ATLAS_N) * TH);
  });
}

function lcg(seed: number) {
  let a = (seed * 9301 + 49297) % 233280;
  return () => (a = (a * 9301 + 49297) % 233280) / 233280;
}

function hsl(t: number, l = 62, a = 1) {
  return `hsla(${spectrumHue(t)} 90% ${l}% / ${a})`;
}

// ---------------------------------------------------------------------------
// Trader: the desk's two monitors
// ---------------------------------------------------------------------------
export function makeTraderScreen(t: number, variant: 0 | 1): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => {
    const P = palette(t);
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, 1024, 640);
    // Header: timeframe tabs.
    ctx.font = `20px ${mono()}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ["1H", "4H", "1D", "1W"].forEach((tf, i) => {
      const on = (variant === 0 && tf === "4H") || (variant === 1 && tf === "1D");
      ctx.fillStyle = on ? P.accent : P.com;
      ctx.fillText(tf, 36 + i * 64, 34);
      if (on) ctx.fillRect(36 + i * 64, 50, 28, 2);
    });
    drawChart(ctx, 0, 70, 1024, 440, t, variant === 0 ? 4 : 7, 22);
    // Footer: the journal's numbers, no money.
    const items = variant === 0 ? [["R multiple", "+1.8 R"], ["Risk", "0.5 %"], ["Win rate", "58 %"]] : [["Setups", "3 / day"], ["Review", "daily"], ["Max DD", "4 %"]];
    items.forEach(([k, v], i) => {
      const x = 36 + i * 330;
      ctx.textAlign = "left";
      ctx.fillStyle = P.com;
      ctx.font = `16px ${mono()}`;
      ctx.fillText(k.toUpperCase(), x, 560);
      ctx.fillStyle = i === 0 ? P.accent : P.id;
      ctx.font = `30px ${mono()}`;
      ctx.fillText(v, x, 598);
    });
  });
}

// ---------------------------------------------------------------------------
// Photographer: the camera's back display
// ---------------------------------------------------------------------------
function drawViewfinder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, big: boolean, readout = true) {
  const P = palette(t);
  const ink = "rgba(243,241,236,0.85)";
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#07070a";
  ctx.fillRect(x, y, w, h);
  // A soft scene behind the frame: light, not a photograph.
  const g = ctx.createRadialGradient(x + w * 0.62, y + h * 0.42, 10, x + w * 0.62, y + h * 0.42, w * 0.6);
  g.addColorStop(0, hsl(t, 60, 0.28));
  g.addColorStop(0.5, hsl(t + 0.08, 50, 0.1));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Thirds.
  ctx.strokeStyle = "rgba(243,241,236,0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 3, y);
    ctx.lineTo(x + (w * i) / 3, y + h);
    ctx.moveTo(x, y + (h * i) / 3);
    ctx.lineTo(x + w, y + (h * i) / 3);
    ctx.stroke();
  }
  // Corner brackets and the focus box.
  const m = w * 0.05;
  const L = w * 0.06;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  [[x + m, y + m, 1, 1], [x + w - m, y + m, -1, 1], [x + m, y + h - m, 1, -1], [x + w - m, y + h - m, -1, -1]].forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * L);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * L, cy);
    ctx.stroke();
  });
  const fb = w * 0.09;
  ctx.strokeStyle = P.accent;
  ctx.strokeRect(x + w * 0.62 - fb / 2, y + h * 0.42 - fb / 2, fb, fb);
  if (readout) {
    const fs = big ? 26 : 20;
    ctx.font = `${fs}px ${mono()}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = ink;
    const line = ["ISO 400", "1/250", "f/2.8", "−⅓"];
    line.forEach((s, i) => ctx.fillText(s, x + m + i * (w * 0.2), y + h - m - fs * 0.4));
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(243,241,236,0.5)";
    ctx.fillText("RAW · 35mm", x + w - m, y + m + fs);
    // Histogram, small, in the corner.
    const hx = x + w - m - w * 0.16;
    const hy = y + h - m - fs * 2.6;
    const rnd = lcg(5);
    ctx.fillStyle = "rgba(243,241,236,0.35)";
    for (let i = 0; i < 24; i++) {
      const v = Math.exp(-Math.pow((i - 11) / 6, 2)) * 0.9 + rnd() * 0.1;
      ctx.fillRect(hx + i * (w * 0.16) / 24, hy + fs * 1.2 * (1 - v), (w * 0.16) / 24 - 1, fs * 1.2 * v);
    }
  }
  ctx.restore();
}

export function makeViewfinderScreen(t: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 683;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => drawViewfinder(ctx, 0, 0, 1024, 683, t, true));
}

// ---------------------------------------------------------------------------
// Artist: a canvas whose strokes carry their turn in alpha (painted in by power)
// ---------------------------------------------------------------------------
function strokePalette(t: number) {
  return [hsl(t, 62), hsl(t + 0.06, 58), hsl(t - 0.05, 66), "hsl(38 80% 68%)", "#f3f1ec", hsl(t + 0.5, 55)];
}

function stroke(ctx: CanvasRenderingContext2D, rnd: () => number, w: number, h: number, color: string, width: number) {
  const x0 = w * (0.1 + rnd() * 0.8);
  const y0 = h * (0.1 + rnd() * 0.8);
  const len = w * (0.12 + rnd() * 0.3);
  const ang = rnd() * Math.PI * 2;
  const bend = (rnd() - 0.5) * len * 0.8;
  const x1 = x0 + Math.cos(ang) * len;
  const y1 = y0 + Math.sin(ang) * len;
  const cx = (x0 + x1) / 2 - Math.sin(ang) * bend;
  const cy = (y0 + y1) / 2 + Math.cos(ang) * bend;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
}

export function makeArtworkTexture(t: number): THREE.Texture {
  const W = 768;
  const H = 576;
  const colour = document.createElement("canvas");
  colour.width = W;
  colour.height = H;
  const order = document.createElement("canvas");
  order.width = W;
  order.height = H;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const cc = colour.getContext("2d")!;
  const oc = order.getContext("2d")!;
  const rnd = lcg(21);
  const rnd2 = lcg(21);
  const pal = strokePalette(t);
  const N = 42;
  // Linen: a warm dark ground.
  cc.fillStyle = "#15130f";
  cc.fillRect(0, 0, W, H);
  oc.fillStyle = "#000";
  oc.fillRect(0, 0, W, H);
  for (let i = 0; i < N; i++) {
    const width = 10 + rnd() * 34;
    const color = pal[Math.floor(rnd() * pal.length)];
    stroke(cc, rnd, W, H, color, width);
    // Same stroke, same randoms, its turn as grey (kept ≥ 0.3 so alpha survives premultiplication).
    const turn = 0.3 + 0.7 * ((i + 1) / N);
    const v = Math.round(turn * 255);
    const r2 = () => rnd2();
    r2(); // width
    r2(); // colour
    stroke(oc, rnd2, W, H, `rgb(${v},${v},${v})`, width);
  }
  const ci = cc.getImageData(0, 0, W, H);
  const oi = oc.getImageData(0, 0, W, H);
  const o = out.getContext("2d")!;
  const img = o.createImageData(W, H);
  for (let i = 0; i < W * H * 4; i += 4) {
    img.data[i] = ci.data[i];
    img.data[i + 1] = ci.data[i + 1];
    img.data[i + 2] = ci.data[i + 2];
    img.data[i + 3] = oi.data[i]; // 0 = ground (never shown), ≥ 77 = a stroke's turn
  }
  o.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = false;
  return tex;
}

// ---------------------------------------------------------------------------
// Ride: a route panel — glowing line, light pins, no map tiles
// ---------------------------------------------------------------------------
function drawRoute(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, seed: number, pins: number, big: boolean) {
  const rnd = lcg(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#08080c";
  ctx.fillRect(x, y, w, h);
  // Faint graticule.
  ctx.strokeStyle = "rgba(243,241,236,0.05)";
  ctx.lineWidth = 1;
  const step = w / 10;
  for (let gx = x; gx < x + w; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += step) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  // The route: a wandering line from left to right.
  const pts: [number, number][] = [];
  const n = 9;
  let py = y + h * (0.3 + rnd() * 0.4);
  for (let i = 0; i < n; i++) {
    const px = x + w * 0.08 + (w * 0.84 * i) / (n - 1);
    py += (rnd() - 0.5) * h * 0.35;
    py = Math.min(y + h * 0.85, Math.max(y + h * 0.15, py));
    pts.push([px, py]);
  }
  const col = hsl(t, 64);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  };
  ctx.strokeStyle = hsl(t, 64, 0.25);
  ctx.lineWidth = big ? 16 : 9;
  path();
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = big ? 4 : 2.5;
  ctx.shadowColor = col;
  ctx.shadowBlur = big ? 18 : 10;
  path();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Pins: light, no names.
  for (let i = 0; i < pins; i++) {
    const p = pts[Math.round(((n - 1) * i) / Math.max(1, pins - 1))];
    const r = big ? 7 : 4;
    ctx.fillStyle = "#f3f1ec";
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsl(t, 70, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r * 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (big) {
    ctx.font = `20px ${mono()}`;
    ctx.fillStyle = "rgba(243,241,236,0.5)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("N ↑", x + 28, y + 24);
  }
  ctx.restore();
}

export function makeRouteScreen(t: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => drawRoute(ctx, 0, 0, 1024, 640, t, 11, 5, true));
}

function drawSpeedo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, frac: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#08080c";
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h * 0.72;
  const R = h * 0.62;
  const a0 = Math.PI * 1.05;
  const a1 = Math.PI * 1.95;
  ctx.strokeStyle = "rgba(243,241,236,0.18)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a1);
  ctx.stroke();
  const col = hsl(t, 64);
  ctx.strokeStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * frac);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(243,241,236,0.4)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((a1 - a0) * i) / 12;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14));
    ctx.lineTo(cx + Math.cos(a) * (R - (i % 3 ? 22 : 30)), cy + Math.sin(a) * (R - (i % 3 ? 22 : 30)));
    ctx.stroke();
  }
  ctx.font = `${Math.round(h * 0.1)}px ${mono()}`;
  ctx.fillStyle = "rgba(243,241,236,0.6)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("km/h", cx, cy - R * 0.25);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Gamer: the monitor — the handle, scanlines, press start
// ---------------------------------------------------------------------------
export function makeGamerScreen(t: number, handle: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext("2d")!;
  return makeTexture(canvas, () => {
    ctx.fillStyle = "#07070b";
    ctx.fillRect(0, 0, 1024, 576);
    const g = ctx.createRadialGradient(512, 300, 20, 512, 300, 620);
    g.addColorStop(0, hsl(t, 55, 0.22));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 576);
    ctx.font = `italic 150px ${display()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f3f1ec";
    ctx.shadowColor = hsl(t, 60, 0.9);
    ctx.shadowBlur = 40;
    ctx.fillText(handle, 512, 262);
    ctx.shadowBlur = 0;
    ctx.font = `22px ${mono()}`;
    ctx.fillStyle = hsl(t, 68);
    ctx.fillText("P R E S S   S T A R T", 512, 400);
    // Scanlines.
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    for (let y = 0; y < 576; y += 4) ctx.fillRect(0, y, 1024, 1.5);
    // HUD corners.
    ctx.strokeStyle = "rgba(243,241,236,0.35)";
    ctx.lineWidth = 2;
    [[40, 40, 1, 1], [984, 40, -1, 1], [40, 536, 1, -1], [984, 536, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * 40);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * 40, cy);
      ctx.stroke();
    });
  });
}

function drawHud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, kind: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#08080c";
  ctx.fillRect(x, y, w, h);
  const col = hsl(t, 64);
  const ink = "rgba(243,241,236,0.8)";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (kind === 0) {
    // Crosshair.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * 10, cy + dy * 10);
      ctx.lineTo(cx + dx * 34, cy + dy * 34);
      ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
  } else if (kind === 1) {
    // Minimap.
    ctx.strokeStyle = "rgba(243,241,236,0.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    const rnd = lcg(3);
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * h * 0.3;
      ctx.fillStyle = i ? "rgba(243,241,236,0.6)" : col;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i ? 3 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 2) {
    // Health and armour bars.
    ctx.fillStyle = "rgba(243,241,236,0.15)";
    ctx.fillRect(x + w * 0.12, cy - 22, w * 0.76, 14);
    ctx.fillRect(x + w * 0.12, cy + 8, w * 0.76, 14);
    ctx.fillStyle = col;
    ctx.fillRect(x + w * 0.12, cy - 22, w * 0.76 * 0.82, 14);
    ctx.fillStyle = ink;
    ctx.fillRect(x + w * 0.12, cy + 8, w * 0.76 * 0.5, 14);
  } else {
    // Ammo.
    ctx.font = `${Math.round(h * 0.34)}px ${mono()}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.fillText("25", cx + w * 0.1, cy);
    ctx.font = `${Math.round(h * 0.16)}px ${mono()}`;
    ctx.fillStyle = "rgba(243,241,236,0.45)";
    ctx.textAlign = "left";
    ctx.fillText("/ 75", cx + w * 0.13, cy + h * 0.06);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Drifting-pane atlases per persona
// ---------------------------------------------------------------------------
const PHOTO_GLYPHS = ["ISO 400", "1/250", "f/2.8", "RAW", "24mm", "85mm", "−⅓ EV", "AF"];
const RIDE_GLYPHS = ["N", "NE", "E", "km/h", "rpm", "4th", "6 %", "fuel"];
const GAME_GLYPHS = ["GG", "ACE", "1v3", "MVP", "K/D", "HS %", "WASD", "clutch"];

export function makePhotographerAtlas(t: number): THREE.Texture {
  return atlas(t, (ctx, i, x, y) => {
    if (i < 8) drawViewfinder(ctx, x, y, TW, TH, t + (i % 3) * 0.03, false, i % 2 === 0);
    else drawGlyph(ctx, x, y, TW, TH, PHOTO_GLYPHS[i - 8], t);
  });
}

export function makeArtistAtlas(t: number): THREE.Texture {
  return atlas(t, (ctx, i, x, y) => {
    const rnd = lcg(40 + i);
    const pal = strokePalette(t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TW, TH);
    ctx.clip();
    ctx.fillStyle = "#15130f";
    ctx.fillRect(x, y, TW, TH);
    ctx.translate(x, y);
    const n = i < 8 ? 4 + Math.floor(rnd() * 4) : 1;
    for (let k = 0; k < n; k++) stroke(ctx, rnd, TW, TH, pal[Math.floor(rnd() * pal.length)], i < 8 ? 10 + rnd() * 24 : 60 + rnd() * 40);
    ctx.restore();
  });
}

export function makeRideAtlas(t: number): THREE.Texture {
  return atlas(t, (ctx, i, x, y) => {
    if (i < 8) {
      if (i % 2 === 0) drawRoute(ctx, x, y, TW, TH, t, 20 + i, 3, false);
      else drawSpeedo(ctx, x, y, TW, TH, t, 0.35 + (i % 4) * 0.15);
    } else drawGlyph(ctx, x, y, TW, TH, RIDE_GLYPHS[i - 8], t);
  });
}

export function makeGamerAtlas(t: number): THREE.Texture {
  return atlas(t, (ctx, i, x, y) => {
    if (i < 8) drawHud(ctx, x, y, TW, TH, t, i % 4);
    else drawGlyph(ctx, x, y, TW, TH, GAME_GLYPHS[i - 8], t);
  });
}

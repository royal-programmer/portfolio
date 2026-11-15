/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script that loads Playwright from a path */
/**
 * Measures the 3D room on this machine (round 37d): for each tier at 1280 x 800, per camera zone, the draw calls, the
 * triangles and the frame time (median and p95 over 120 requestAnimationFrame deltas), plus the GPU the headless
 * Chrome reported. Needs the app running (dev server, default http://localhost:3000) and Playwright (set
 * PLAYWRIGHT_PATH to its folder; the default is the global @playwright/mcp copy) and installed Chrome. It does NOT
 * pass --disable-gpu, so a real GPU is used when there is one (the report says which).
 *
 *   node scripts/room3d-perf.cjs                      all tiers, all zones
 *   TIERS=high ZONES=desk,sleep node scripts/room3d-perf.cjs
 *   PAD=150 node scripts/room3d-perf.cjs              pad the scene with extra unmergeable meshes until the frame
 *                                                     draws at least PAD calls (to find out what the cap could be)
 *   UNCAP=1 ...                                       drop the 60 Hz frame limit so the delta is the real cost
 */
const path = require("node:path");
const fs = require("node:fs");
const PW = process.env.PLAYWRIGHT_PATH || path.join(process.env.APPDATA || "", "npm/node_modules/@playwright/mcp/node_modules/playwright");
const { chromium } = require(PW);

const BASE = process.env.BASE || "http://localhost:3000";
const EXE = process.env.EXE || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TIERS = (process.env.TIERS || "low,medium,high").split(",");
const ONLY = process.env.ZONES ? process.env.ZONES.split(",") : null;
const PAD = Number(process.env.PAD || 0);
const HOUR = process.env.HOUR || "13";
const SIZES = { low: { w: 393, h: 852, dpr: 3, mobile: true }, medium: { w: 1280, h: 800, dpr: 1, mobile: false }, high: { w: 1280, h: 800, dpr: 1, mobile: false } };

const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};

async function run() {
  const args = ["--ignore-gpu-blocklist"];
  if (process.env.UNCAP) args.push("--disable-frame-rate-limit", "--disable-gpu-vsync");
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args });
  const report = { gpu: null, pad: PAD, tiers: {} };
  for (const tier of TIERS) {
    const sz = process.env.DESKTOP_LOW && tier === "low" ? { w: 1280, h: 800, dpr: 1, mobile: false } : SIZES[tier];
    const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: sz.dpr, isMobile: sz.mobile, hasTouch: sz.mobile, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
    // The dev server's error overlay would sit over the page and swallow clicks.
    await page.addInitScript(() => {
      const add = () => document.documentElement.appendChild(Object.assign(document.createElement("style"), { textContent: "nextjs-portal{display:none!important}" }));
      if (document.documentElement) add();
      else document.addEventListener("DOMContentLoaded", add);
    });
    await page.goto(`${BASE}/engineer/stage?q=${tier}&hour=${HOUR}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForFunction(() => window.__room && window.__room.frameMs.length > 8 && window.__roomCam, null, { timeout: 180000 });
    if (!report.gpu) {
      report.gpu = await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const e = gl && gl.getExtension("WEBGL_debug_renderer_info");
        return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown";
      });
    }
    // Shadow accumulation (high, medium) ends when the call count is steady.
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      await page.waitForTimeout(2500);
      const steady = await page.evaluate(() => { const l = window.__room.callsLog; if (l.length < 60) return false; const t = l.slice(-40); return t.every((v) => v === t[0]); }).catch(() => false);
      if (steady) break;
    }
    const zones = await page.$$eval(".rx-chip", (els) => els.map((e) => e.textContent));
    const out = {};
    for (const z of zones) {
      if (ONLY && !ONLY.includes(z.toLowerCase())) continue;
      await page.click(`.rx-chip:has-text("${z}")`);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForFunction(() => { const r = window.__roomCam.rig; return r.eye.distanceTo(r.want) < 0.03 && r.look.distanceTo(r.wantLook) < 0.03; }, null, { timeout: 60000, polling: 200 });
      await page.waitForTimeout(1200);
      if (PAD) {
        // Pad the scene with clones of a small mesh that is in view (each clone is one more draw call, two with a shadow pass)
        // until a frame draws at least PAD calls. The clones are removed again after the measurement.
        await page.evaluate(() => (window.__pad = []));
        for (let i = 0; i < 40; i++) {
          const cur = await page.evaluate(() => Math.max(...window.__room.callsLog.slice(-6)));
          if (cur >= PAD) break;
          await page.evaluate((n) => {
            const scene = window.__room.scene();
            let src = null;
            scene.traverse((o) => {
              if (!src && o.isMesh && o.visible && !o.isInstancedMesh && o.castShadow && o.geometry && o.geometry.attributes.position.count < 600) src = o;
            });
            if (!src) return;
            for (let k = 0; k < n; k++) {
              const c = src.clone();
              c.raycast = () => {};
              scene.add(c);
              window.__pad.push(c);
            }
          }, 6);
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(500);
      }
      // 120 rAF deltas
      const deltas = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const d = [];
            let last = performance.now();
            const tick = (t) => {
              d.push(t - last);
              last = t;
              if (d.length < 121) requestAnimationFrame(tick);
              else resolve(d.slice(1));
            };
            requestAnimationFrame(tick);
          }),
      );
      const r = await page.evaluate(() => { const l = window.__room.callsLog.slice(-12); return { calls: Math.max(...l), tris: window.__room.triangles }; });
      if (PAD) await page.evaluate(() => { for (const c of window.__pad || []) c.removeFromParent(); window.__pad = []; });
      out[z] = { calls: r.calls, tris: r.tris, medianMs: +pct(deltas, 0.5).toFixed(2), p95Ms: +pct(deltas, 0.95).toFixed(2) };
      console.log(tier, z, JSON.stringify(out[z]));
    }
    report.tiers[tier] = { viewport: `${sz.w}x${sz.h}@${sz.dpr}`, zones: out, errors: errs.slice(0, 3) };
    await ctx.close();
  }
  await browser.close();
  console.log("GPU:", report.gpu);
  const file = process.env.OUT;
  if (file) fs.writeFileSync(file, JSON.stringify(report, null, 1));
  return report;
}

run().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});

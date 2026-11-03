/**
 * Device analysis for the entry gate (D36). Runs once in the browser and
 * suggests a quality level — like a game's "detected settings". The visitor
 * can override it; the in-scene governor then fine-tunes from real frame rate.
 */
import type { Quality } from "./experience";

export type DeviceReport = {
  webgl: boolean;
  /** Human-readable GPU name, when the browser exposes it. */
  gpu: string | null;
  cores: number | null;
  memoryGb: number | null;
  mobile: boolean;
  /** Physical pixels the scene would have to fill at DPR 1.5. */
  megapixels: number;
  tier: 0 | 1 | 2 | 3; // 0 = no WebGL / software, 1 low, 2 mid, 3 high
  suggested: Quality;
  /** True when Normal view is the honest recommendation. */
  preferNormal: boolean;
};

function cleanGpuName(raw: string): string {
  // "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)"
  const angle = raw.match(/ANGLE \([^,]*,\s*([^,(]+(?:\([^)]*\))?[^,(]*)/);
  let name = angle ? angle[1] : raw;
  name = name.replace(/\(R\)|\(TM\)|\(0x[0-9a-f]+\)/gi, "").replace(/Direct3D.*$/i, "");
  return name.replace(/\s+/g, " ").trim();
}

export function analyseDevice(): DeviceReport {
  type Nav = Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  const nav = navigator as Nav;
  const cores = nav.hardwareConcurrency ?? null;
  const memoryGb = nav.deviceMemory ?? null;
  const mobile =
    nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const megapixels = (window.innerWidth * dpr * window.innerHeight * dpr) / 1e6;

  let gpu: string | null = null;
  let webgl = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      webgl = true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const raw = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : null;
      gpu = raw ? cleanGpuName(raw) : null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl = false;
  }

  const name = (gpu ?? "").toLowerCase();
  let tier: DeviceReport["tier"] = 2;
  if (!webgl || /swiftshader|llvmpipe|software|microsoft basic/.test(name)) tier = 0;
  else if (/rtx|radeon rx|geforce gtx 1[6-9]|geforce gtx [2-9]|apple m[1-9]|arc a/.test(name)) tier = 3;
  else if (/apple gpu|apple a1[5-9]|adreno \(tm\) 7|adreno 7|mali-g7[1-9]|iris xe|radeon(?! r[0-9] )/.test(name)) tier = 2;
  else if (/intel.*(hd|uhd)|mali-[gt][0-5]|adreno [3-5]|powervr|geforce [0-9]{3}m?$/.test(name)) tier = 1;
  else tier = 2; // unknown/masked GPU: assume mid, the governor corrects

  // CPU / memory ceilings.
  if (cores !== null && cores <= 2) tier = Math.min(tier, 1) as DeviceReport["tier"];
  if (memoryGb !== null && memoryGb <= 2) tier = Math.min(tier, 1) as DeviceReport["tier"];
  if (mobile && tier === 3) tier = 2;

  // Big screens cost fill-rate: step down one notch past ~4 MP on low/mid GPUs.
  let suggested: Quality = tier >= 3 ? "best" : tier === 2 ? "balanced" : "performance";
  if (suggested === "balanced" && megapixels > 4.5) suggested = "performance";

  return { webgl, gpu, cores, memoryGb, mobile, megapixels, tier, suggested, preferNormal: tier === 0 };
}

/** One-line, human summary for the gate. */
export function describeDevice(r: DeviceReport): string {
  const parts: string[] = [];
  if (r.gpu) parts.push(r.gpu);
  if (r.cores) parts.push(`${r.cores} cores`);
  if (r.memoryGb) parts.push(`${r.memoryGb}+ GB`);
  return parts.join(" · ") || (r.mobile ? "Mobile device" : "This device");
}

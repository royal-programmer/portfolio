/**
 * The continuous spectrum (D32). Personas are points on one gradient of light,
 * not a fixed set of colours, so there is no limit on how many there can be.
 *
 *   t = 0 → rose · red · amber · yellow · green · cyan · blue · t = 1 → violet
 *
 * Colour = f(t). Each persona's t is either PINNED (stable brand colour) or
 * AUTO: spread evenly by rank among the unpinned ones. The same hue formula is
 * mirrored in GLSL (`SPECTRUM_GLSL`) so the 3D light and the page text match.
 */
import type { PersonaSlug } from "@/lib/content/types";

/** Hue (degrees) at the start of the spectrum and the span it sweeps. */
const HUE_START = -15; // rose
const HUE_SPAN = 285; // → violet (270°)
const SAT = 90;
const LIGHT = 62;

export function spectrumHue(t: number): number {
  return (((HUE_START + Math.min(1, Math.max(0, t)) * HUE_SPAN) % 360) + 360) % 360;
}

export function spectrumColor(t: number, lightness = LIGHT): string {
  return `hsl(${spectrumHue(t).toFixed(1)} ${SAT}% ${lightness}%)`;
}

/**
 * Pinned spectrum positions. Temporary home: these move to the persona record
 * (admin-editable "pin colour") with the Stage 2 content work.
 * Values keep today's brand colours: photographer rose, trader green, engineer blue.
 */
export const SPECTRUM_PINS: Partial<Record<PersonaSlug, number>> = {
  photographer: 0,
  trader: 0.56,
  engineer: 0.825,
};

export type SpectrumPoint = { slug: PersonaSlug; t: number; color: string };

/**
 * Place ranked personas on the spectrum. Pinned ones keep their t; the rest
 * are spread evenly (by rank) across the whole range, nudged off any pin they
 * would collide with.
 */
export function placeOnSpectrum(
  ranked: PersonaSlug[],
  pins: Partial<Record<PersonaSlug, number>> = SPECTRUM_PINS,
): SpectrumPoint[] {
  const free = ranked.filter((s) => pins[s] === undefined);
  const pinnedTs = ranked.map((s) => pins[s]).filter((t): t is number => t !== undefined);
  const MIN_GAP = 0.06;

  const autoT = new Map<PersonaSlug, number>();
  free.forEach((slug, i) => {
    let t = free.length === 1 ? 0.5 : i / (free.length - 1);
    for (const p of pinnedTs) {
      if (Math.abs(t - p) < MIN_GAP) t = p + (t >= p ? MIN_GAP : -MIN_GAP);
    }
    autoT.set(slug, Math.min(1, Math.max(0, t)));
  });

  return ranked.map((slug) => {
    const t = pins[slug] ?? autoT.get(slug) ?? 0.5;
    return { slug, t, color: spectrumColor(t) };
  });
}

/** GLSL mirror of `spectrumHue` + HSL→RGB, for shaders. */
export const SPECTRUM_GLSL = /* glsl */ `
vec3 hsl2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}
vec3 spectrum(float t) {
  float h = mod(${HUE_START.toFixed(1)} + clamp(t, 0.0, 1.0) * ${HUE_SPAN.toFixed(1)}, 360.0) / 360.0;
  return hsl2rgb(vec3(h, ${(SAT / 100).toFixed(2)}, ${(LIGHT / 100).toFixed(2)}));
}
`;

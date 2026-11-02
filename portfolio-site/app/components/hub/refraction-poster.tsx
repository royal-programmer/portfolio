/**
 * Static "Refraction" poster — the Lite-mode backdrop and the instant first
 * paint while the 3D scene loads. Same composition as the scene: a beam falls
 * onto a prism and disperses into one continuous spectrum with brighter bands.
 * Pure SVG, no JS, no animation.
 */
import { spectrumColor } from "@/lib/site/spectrum";

type Band = { t: number; lit: boolean };

const E = { x: 1034, y: 455 }; // spectrum origin (prism exit)
const A0 = 16;
const A1 = -40;
const R = 1100;

const at = (t: number, r: number) => {
  const a = ((A0 + (A1 - A0) * t) * Math.PI) / 180;
  return { x: E.x + Math.cos(a) * r, y: E.y - Math.sin(a) * r };
};

export function RefractionPoster({ bands }: { bands: Band[] }) {
  const WEDGES = 56;
  return (
    <svg
      aria-hidden
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      <defs>
        <radialGradient id="poster-fade" cx={E.x} cy={E.y} r={R} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.75" stopColor="#07070a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#07070a" stopOpacity="1" />
        </radialGradient>
        <linearGradient id="poster-beam" x1="380" y1="0" x2="910" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="#07070a" />

      {/* Continuous spectrum wash */}
      {Array.from({ length: WEDGES }, (_, i) => {
        const t0 = i / WEDGES;
        const t1 = (i + 1) / WEDGES;
        const p0 = at(t0, R);
        const p1 = at(t1, R);
        const edge = Math.min(1, Math.min(t0, 1 - t1) * 12 + 0.15);
        return (
          <polygon
            key={i}
            points={`${E.x},${E.y} ${p0.x},${p0.y} ${p1.x},${p1.y}`}
            fill={spectrumColor((t0 + t1) / 2)}
            opacity={0.13 * edge}
          />
        );
      })}

      {/* Persona bands */}
      {bands.map((b, i) => {
        const w = b.lit ? 0.012 : 0.005;
        const p0 = at(b.t - w, R);
        const p1 = at(b.t + w, R);
        return (
          <polygon
            key={i}
            points={`${E.x},${E.y - 1} ${E.x},${E.y + 1} ${p0.x},${p0.y} ${p1.x},${p1.y}`}
            fill={spectrumColor(b.t, b.lit ? 66 : 50)}
            opacity={b.lit ? 0.9 : 0.35}
          />
        );
      })}

      <rect width="1600" height="900" fill="url(#poster-fade)" />

      {/* Beam + prism */}
      <line x1="380" y1="0" x2="910" y2="440" stroke="url(#poster-beam)" strokeWidth="2.5" />
      <line x1="910" y1="440" x2={E.x} y2={E.y} stroke="#fff" strokeOpacity="0.7" strokeWidth="2" />
      <polygon
        points="968,330 1060,505 876,505"
        fill="rgba(243,241,236,0.05)"
        stroke="rgba(243,241,236,0.55)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon points="968,330 995,382 941,382" fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

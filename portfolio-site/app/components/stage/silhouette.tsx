/**
 * The Stage's first paint (S8): an inline SVG of the desk's outline in the persona accent at 15%
 * opacity. It is part of the server-rendered page, so the stage is never an empty black box; it
 * fades out when the first WebGL frame has been drawn. The shapes are hand-authored once, from the
 * assembly's bounding boxes (desk slab, laptop, lamp, window) seen from the stage's resting camera.
 */
export function StageSilhouette({ color, gone }: { color: string; gone: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 300"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: gone ? 0 : 1, transition: "opacity 420ms ease-out" }}
    >
      <g fill={color} fillOpacity="0.15" stroke={color} strokeOpacity="0.15" strokeWidth="1.5" strokeLinejoin="round">
        {/* The window behind the desk, two by two panes. */}
        <rect x="236" y="62" width="150" height="104" rx="2" />
        <path d="M311 62v104M236 114h150" fill="none" strokeOpacity="0.3" />
        {/* The desk slab: a long trapezoid, front edge nearer. */}
        <path d="M122 214l62-34h236l58 34z" />
        <rect x="122" y="214" width="356" height="7" />
        {/* The laptop: lid and base. */}
        <path d="M262 176l8-56h66l6 56z" />
        <path d="M252 178h106l12 10H240z" />
        {/* The lamp: base, arm, shade. */}
        <ellipse cx="170" cy="190" rx="12" ry="3" />
        <path d="M170 189l4-52 28-12" fill="none" strokeWidth="2.5" />
        <path d="M196 124l22 4-12 14z" />
        {/* The props: mug, notebook, phone. */}
        <rect x="396" y="178" width="12" height="14" rx="2" />
        <path d="M188 198l40-4 8 8-38 6z" />
        <path d="M380 200l24-3 6 6-24 4z" />
      </g>
    </svg>
  );
}

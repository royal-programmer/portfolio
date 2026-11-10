/**
 * The terminal's colour palettes, in one place: the client reads them as CSS variables (`themeCss()`
 * below, rendered once by the terminal) and the preview image (`app/og/route.tsx`) reads the same values,
 * so a shared link looks like the terminal it opens. `accent` is a CSS colour for the swatch only; the
 * default theme follows the page's own persona colour, so it carries a fixed fallback for the image.
 */
export type ThemePalette = {
  id: string;
  /** Terminal window background (`--term-win`). */
  bg: string;
  /** Page backdrop behind the window (`--void`). */
  void: string;
  ink: string;
  dim: string;
  faint: string;
  /** The accent (`--c`); the default theme has none here and uses the persona colour. */
  accent: string;
  ok: string;
  violet: string;
  yellow?: string;
  link?: string;
};

/** The default theme: dark, the persona colour as accent (the Engineer's blue, for images). */
export const DEFAULT_PALETTE: ThemePalette = {
  id: "accent",
  bg: "#0a0a0f",
  void: "#050507",
  ink: "#f3f1ec",
  dim: "#a9a7a1",
  faint: "#6d6b67",
  accent: "#3b82f6",
  ok: "#4ade80",
  violet: "#a78bfa",
};

/** The ten named themes (the default, `accent`, has no CSS block: it is the base). */
export const THEME_PALETTES: ThemePalette[] = [
  { id: "amber", accent: "#ffb000", void: "#0b0a07", bg: "#100d08", ink: "#ffd98a", dim: "#d4a84f", faint: "#a08040", ok: "#c9d65a", violet: "#e0a060" },
  { id: "green", accent: "#33ff66", void: "#050a06", bg: "#07100a", ink: "#a8ffbd", dim: "#5fd37d", faint: "#44a45f", ok: "#33ff66", violet: "#7fe0c0" },
  { id: "paper", accent: "#0b57d0", link: "#0b57d0", void: "#f4f1ea", bg: "#fbf9f4", ink: "#1f2328", dim: "#4b5059", faint: "#5a6068", ok: "#1a7f37", yellow: "#9a6700", violet: "#8250df" },
  { id: "dracula", accent: "#bd93f9", void: "#1e1f29", bg: "#282a36", ink: "#f8f8f2", dim: "#c3c8e0", faint: "#8995ba", ok: "#50fa7b", violet: "#ff79c6" },
  { id: "nord", accent: "#88c0d0", void: "#242933", bg: "#2e3440", ink: "#eceff4", dim: "#d8dee9", faint: "#949fb3", ok: "#a3be8c", violet: "#b48ead" },
  { id: "gruvbox", accent: "#fabd2f", void: "#1d2021", bg: "#282828", ink: "#ebdbb2", dim: "#bdae93", faint: "#9e9284", ok: "#b8bb26", violet: "#d3869b" },
  { id: "solarized", accent: "#268bd2", void: "#001f27", bg: "#002b36", ink: "#93a1a1", dim: "#8a9ca0", faint: "#819397", ok: "#859900", yellow: "#b58900", violet: "#6c71c4" },
  { id: "monokai", accent: "#a6e22e", void: "#1e1f1c", bg: "#272822", ink: "#f8f8f2", dim: "#cfcfc2", faint: "#939080", ok: "#a6e22e", violet: "#ae81ff" },
  { id: "matrix", accent: "#00ff41", void: "#000000", bg: "#020a02", ink: "#b6ffc4", dim: "#6fe08a", faint: "#3fbf5a", ok: "#00ff41", violet: "#7fffd4" },
  { id: "cyberpunk", accent: "#ff2a6d", void: "#070115", bg: "#0d0221", ink: "#05d9e8", dim: "#6cc4d4", faint: "#428499", ok: "#00ff9f", violet: "#d1a1ff" },
];

/** Palette for a theme id; unknown ids get the default. */
export function paletteFor(id: string | null | undefined): ThemePalette {
  return THEME_PALETTES.find((p) => p.id === id) ?? DEFAULT_PALETTE;
}

/** The `.terminal-root[data-theme=…]` blocks, generated from the palettes. */
export function themeCss(): string {
  return THEME_PALETTES.map((p) => {
    const v: Array<[string, string | undefined]> = [
      ["--c", p.accent],
      ["--link", p.link],
      ["--void", p.void],
      ["--term-win", p.bg],
      ["--ink", p.ink],
      ["--ink-dim", p.dim],
      ["--term-faint", p.faint],
      ["--ink-faint", p.faint],
      ["--term-green", p.ok],
      ["--term-yellow", p.yellow],
      ["--term-violet", p.violet],
    ];
    return `.terminal-root[data-theme="${p.id}"]{${v.filter(([, x]) => x).map(([k, x]) => `${k}:${x}`).join(";")}}`;
  }).join("\n");
}

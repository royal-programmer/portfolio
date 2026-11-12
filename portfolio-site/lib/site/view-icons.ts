/**
 * The tab icon each view wears while it is mounted (round 25, E5). Data: the next view adds one entry. The icon is an
 * inline SVG data URI (a rounded square, our own letter shape, no wordmark); `theme` colours the phone's browser bar.
 */
export type ViewIcon = { bg: string; fg: string; letter: string; theme: string };

export const VIEW_ICONS: Record<string, ViewIcon> = {
  // A red R on black: our R shape, not another brand's N or ribbon.
  netflix: { bg: "#000000", fg: "#e50914", letter: "R", theme: "#000000" },
};

/** `data:image/svg+xml,...` for a view's icon. */
export function viewIconHref(icon: ViewIcon): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${icon.bg}"/><text x="32" y="47" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="44" font-weight="700" fill="${icon.fg}">${icon.letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Put a view's icon and theme colour on the tab; the returned function restores whatever was there. Every icon link is
 * changed in place (and the ones the framework adds later too, via an observer on the head), so the page's own icon returns
 * when the view unmounts.
 */
export function applyViewIcon(id: string): () => void {
  const icon = VIEW_ICONS[id];
  if (!icon || typeof document === "undefined") return () => {};
  const href = viewIconHref(icon);
  const saved = new Map<HTMLLinkElement, { href: string | null; type: string | null; sizes: string | null }>();
  const savedMeta = new Map<HTMLMetaElement, string | null>();
  let made: HTMLLinkElement | null = null;
  let madeMeta: HTMLMetaElement | null = null;

  const paint = () => {
    const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')).filter((l) => l !== made);
    for (const l of links) {
      if (!saved.has(l)) saved.set(l, { href: l.getAttribute("href"), type: l.getAttribute("type"), sizes: l.getAttribute("sizes") });
      if (l.getAttribute("href") !== href) {
        l.setAttribute("href", href);
        l.setAttribute("type", "image/svg+xml");
        l.removeAttribute("sizes");
      }
    }
    if (!links.length && !made) {
      made = document.createElement("link");
      made.rel = "icon";
      made.type = "image/svg+xml";
      made.href = href;
      document.head.appendChild(made);
    }
    const metas = Array.from(document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).filter((m) => m !== madeMeta);
    for (const m of metas) {
      if (!savedMeta.has(m)) savedMeta.set(m, m.getAttribute("content"));
      m.setAttribute("content", icon.theme);
    }
    if (!metas.length && !madeMeta) {
      madeMeta = document.createElement("meta");
      madeMeta.name = "theme-color";
      madeMeta.content = icon.theme;
      document.head.appendChild(madeMeta);
    }
  };
  paint();
  const mo = new MutationObserver(paint);
  mo.observe(document.head, { childList: true });
  return () => {
    mo.disconnect();
    made?.remove();
    madeMeta?.remove();
    for (const [l, o] of saved) {
      if (o.href == null) l.removeAttribute("href");
      else l.setAttribute("href", o.href);
      if (o.type == null) l.removeAttribute("type");
      else l.setAttribute("type", o.type);
      if (o.sizes != null) l.setAttribute("sizes", o.sizes);
    }
    for (const [m, c] of savedMeta) {
      if (c == null) m.removeAttribute("content");
      else m.setAttribute("content", c);
    }
  };
}

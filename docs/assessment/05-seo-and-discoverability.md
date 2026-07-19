# 05 — SEO & Discoverability

A portfolio that recruiters and clients can't find (or that shows them nothing when they do) is doing half its job. This is currently the weakest *strategic* area after content.

---

## What exists today

Just this, in `layout.tsx`:

```ts
export const metadata: Metadata = {
  title: "Ratul Roy | Multi Persona Portfolio",
  description: "Modern dual-mode portfolio with easter-egg identity switch.",
};
```

That's the entire SEO surface. Note it even says "**dual**-mode" while the site has three personas — a stale description.

---

## Flaw 1 — Crawlers only ever see "Engineer"

The persona is chosen **client-side after load**, and every full load forces Engineer (`persona-provider.tsx`). So:

- Googlebot, LinkedIn's unfurler, Twitter/X, iMessage, Slack — all fetch the server HTML, which is always the Engineer view. **Trader and Photographer content is invisible to every crawler and link preview.**
- Because content is client-rendered (see [02](./02-architecture-and-code.md)), even the Engineer content is JS-dependent. Google *can* render JS, but it's slower, less reliable, and most social scrapers **don't run JS at all** — they'll see a near-empty shell.

**Root cause:** persona lives in React state, not the URL. This is the same root cause that blocks SSR and deep links. Fixing it fixes all three at once.

**Fix:** make personas real, server-rendered URLs.
```
/                      → Engineer (canonical), or a chooser
/persona/trader        → Trader, server-rendered, own metadata
/persona/photographer  → Photographer, server-rendered, own metadata
```
Then the home page can still *switch* client-side for delight, but each persona also has a shareable, crawlable, SSR'd address.

---

## Flaw 2 — No Open Graph / Twitter cards

When someone pastes your URL into LinkedIn, Slack, or a DM, there's **no image, no rich title/description card** — just a bare link. For a *visual* professional (photographer!) and someone selling *design polish* (engineer), shipping a linkless gray rectangle is a self-inflicted wound.

**Fix:** add OG + Twitter metadata, and ideally a **dynamic OG image per persona** using Next's `opengraph-image` / `ImageResponse`:
```
app/opengraph-image.tsx                 → default card
app/persona/[name]/opengraph-image.tsx  → per-persona card (accent-themed)
```
This is a high-impact, low-effort win — a good OG card measurably increases click-through on shared links.

---

## Flaw 3 — No `sitemap.xml`, no `robots.txt`

Neither `app/sitemap.ts` nor `app/robots.ts` exists. Search engines have no manifest of your routes and no crawl directives. Trivial to add in the App Router:
```ts
// app/sitemap.ts
export default function sitemap() {
  return [
    { url: "https://yoursite.com", priority: 1 },
    { url: "https://yoursite.com/persona/trader" },
    { url: "https://yoursite.com/persona/photographer" },
  ];
}
```

---

## Flaw 4 — No structured data (JSON-LD)

For a *person's* portfolio, a `Person` schema (name, job titles, sameAs social links, image) is exactly what Google's knowledge features consume. You already have the data in `SOCIAL_LINKS`. Emitting a `<script type="application/ld+json">` with a `Person` object is a small, high-value addition for "Ratul Roy" branded searches.

---

## Flaw 5 — Metadata is static and singular

Even ignoring personas, there's no:
- `metadataBase` (needed for OG URLs to resolve),
- canonical URL,
- keywords/author,
- per-section titles.

And the description is factually stale ("dual-mode"). Small, but it's the literal first sentence Google shows.

---

## Flaw 6 — Discoverability *within* the site (ties to [04](./04-accessibility-and-ux.md))

SEO gets people to the page; then the **easter-egg-only navigation** hides two-thirds of the site from them. Discoverability is a funnel: findable (SEO) → reachable (visible nav) → shareable (deep links). Right now all three are broken by the same "persona is hidden client state" decision. One architectural change — **persona in the URL, server-rendered** — repairs the whole funnel.

---

## Recommended SEO checklist

- [ ] Add `metadataBase`, fix the stale "dual-mode" description, add author/keywords.
- [ ] Real routes per persona (`/persona/[name]`), server-rendered.
- [ ] `generateMetadata` per persona (unique title/description).
- [ ] `app/opengraph-image.tsx` (+ per-persona), accent-themed via `ImageResponse`.
- [ ] Twitter card metadata.
- [ ] `app/sitemap.ts` and `app/robots.ts`.
- [ ] `Person` JSON-LD with `sameAs` social links.
- [ ] Verify with Google Rich Results Test + a social-card debugger before launch.
- [ ] Register the domain in Google Search Console after deploy.

---

## Why this matters more than it seems

Your `docs/01-objectives.md` names recruiters as the primary audience and lists "acceptable Lighthouse scores" as a success criterion — but Lighthouse also scores **SEO**, and this build would score poorly there despite the polish. More importantly: the single most common real-world path to a portfolio is *someone pastes your link in a hiring channel*. If that paste renders as a bare URL and the crawler sees an empty Engineer shell, the craft never gets seen. **SEO/OG is the difference between "built a beautiful site" and "a beautiful site that gets seen."**

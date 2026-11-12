/**
 * Findability (17-persona-views.md §22, D6): the view is a client app behind a profile gate, so crawlers and no-JS
 * visitors get the content as real server-rendered text (`<noscript>`: titles, years, synopses of the full story)
 * plus JSON-LD (`Person` and an `ItemList` of the Top 10). Plain data in, no state.
 */
import { factsOf, rowItems, top10Of, type NetflixProfileId, type NetflixShow } from "@/lib/site/netflix-data";
import type { TermLink } from "@/lib/site/terminal-data";

const safe = (o: unknown) => JSON.stringify(o).replace(/</g, "\u003c");

export function NetflixSeo({ series, contact }: { series: Record<NetflixProfileId, NetflixShow>; contact: TermLink[] }) {
  const story = series.story;
  const rec = series.recruiter;
  const seen = new Set<string>();
  const items = story.rows.flatMap(rowItems).filter((it) => !seen.has(it.id) && !!seen.add(it.id));
  const sameAs = contact.map((c) => c.href).filter((h) => /^https:\/\//i.test(h));
  const ld = [
    { "@context": "https://schema.org", "@type": "Person", name: rec.hero.title, description: rec.hero.blurb, ...(sameAs.length ? { sameAs } : {}) },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Top 10 by impact",
      itemListElement: top10Of(rec).map((it, i) => {
        const f = factsOf(it);
        return { "@type": "ListItem", position: i + 1, name: f.title, ...(f.blurb ? { description: f.blurb } : {}) };
      }),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safe(ld) }} />
      <noscript>
        <div className="nf-noscript">
          <h1>{story.hero.title}</h1>
          <p>{story.hero.blurb}</p>
          <ul>
            {items.map((it) => {
              const f = factsOf(it);
              return (
                <li key={it.id}>
                  <h2>{f.title}</h2>
                  <p>{[f.season != null ? `S${f.season}${f.n != null ? ` E${f.n}` : ""}` : f.year, f.metric ? `${f.metric.value} ${f.metric.label}` : ""].filter(Boolean).join(" · ")}</p>
                  {f.blurb ? <p>{f.blurb}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </noscript>
    </>
  );
}

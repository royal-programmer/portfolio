import type { Metadata } from "next";
import Link from "next/link";
import { ALL_PERSONAS, listPersonas, type Persona, type PersonaSlug } from "@/lib/content";

export const metadata: Metadata = {
  title: "Who am I | Ratul Roy",
  description: "Pick a door — Engineer, Trader, Photographer, and more personas on the way.",
};

type HubCard =
  | { kind: "live"; persona: Persona }
  | { kind: "soon"; slug: PersonaSlug };

function buildHubCards(published: Persona[]): HubCard[] {
  const bySlug = new Map(published.map((p) => [p.slug, p]));
  return ALL_PERSONAS.map((slug) => {
    const persona = bySlug.get(slug);
    if (persona?.isPublished) return { kind: "live" as const, persona };
    return { kind: "soon" as const, slug };
  });
}

const SOON_LABELS: Record<PersonaSlug, string> = {
  engineer: "Engineer",
  trader: "Trader",
  photographer: "Photographer",
  artist: "Artist",
  ride: "Rider",
  gamer: "Gamer",
};

/**
 * Explicit route (takes precedence over `/[persona]`).
 * Persona card hub — published doors link out; unpublished stay "coming soon".
 */
export default async function WhoAmIPage() {
  const published = await listPersonas();
  const cards = buildHubCards(published);

  return (
    <main className="relative min-h-screen overflow-hidden text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, #efe6d8 0%, transparent 55%), linear-gradient(165deg, #f7f1e8 0%, #e7eef6 45%, #f1e9e1 100%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16 md:px-10 md:py-24">
        <header className="mb-12 max-w-2xl space-y-4">
          <p className="font-mono text-xs tracking-[0.22em] text-stone-500 uppercase">Who am I</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Know me more</h1>
          <p className="text-lg leading-relaxed text-stone-600">
            Each door is a different audience entry. Pick one that fits — or wait for the rooms still
            under construction.
          </p>
        </header>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, idx) => {
            if (card.kind === "live") {
              const { persona } = card;
              return (
                <Link
                  key={persona.slug}
                  href={`/${persona.slug}`}
                  className="group rounded-3xl border border-stone-300/80 bg-white/55 p-6 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-stone-400 hover:bg-white/80"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <span
                    className="mb-4 inline-block h-2 w-10 rounded-full"
                    style={{ backgroundColor: persona.accent }}
                    aria-hidden
                  />
                  <h2 className="text-xl font-semibold tracking-tight">{persona.label}</h2>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                    {persona.eyebrow}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-stone-600">{persona.body}</p>
                  <p
                    className="mt-6 text-sm font-medium underline-offset-4 group-hover:underline"
                    style={{ color: persona.accent }}
                  >
                    Enter →
                  </p>
                </Link>
              );
            }

            return (
              <div
                key={card.slug}
                className="rounded-3xl border border-dashed border-stone-300 bg-white/35 p-6 backdrop-blur"
                aria-disabled="true"
              >
                <span className="mb-4 inline-block h-2 w-10 rounded-full bg-stone-300" aria-hidden />
                <h2 className="text-xl font-semibold tracking-tight text-stone-500">
                  {SOON_LABELS[card.slug]} Mode
                </h2>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">
                  Not on stage yet
                </p>
                <p className="mt-4 text-sm leading-relaxed text-stone-500">
                  This persona is planned. The door stays closed until there is real content behind
                  it.
                </p>
                <p className="mt-6 text-sm font-medium text-stone-400">Coming soon</p>
              </div>
            );
          })}
        </section>

        <p className="mt-12 text-sm text-stone-500">
          Prefer a direct link? Try{" "}
          <Link href="/engineer" className="font-medium text-stone-800 underline-offset-4 hover:underline">
            /engineer
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

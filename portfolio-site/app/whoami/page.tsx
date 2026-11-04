import type { Metadata } from "next";
import { ALL_PERSONAS, listEntries, listPersonas } from "@/lib/content";
import { HUB_COPY } from "@/lib/site/brand";
import { placeOnSpectrum } from "@/lib/site/spectrum";
import { HubExperience, type HubChapter, type HubUpcoming } from "../components/hub/hub-experience";

export const metadata: Metadata = {
  title: `Ratul Roy — ${HUB_COPY.headline}`,
  description:
    "Engineer, trader, photographer — and more perspectives on the way. Follow the light into each world.",
};

/**
 * The hub (served at the bare root domain by proxy.ts, and at /whoami on hosts
 * without subdomain routing). Live personas, in rank order, become chapters;
 * unpublished ones are "more colours on the way". Every persona gets its
 * place on the continuous spectrum (pinned or auto-spread).
 */
export default async function WhoAmIPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Dev only: `?preview=all` shows unpublished personas on the climb (their worlds are built
  // before their content is published). Production ignores it.
  const { preview } = await searchParams;
  const previewAll = process.env.NODE_ENV !== "production" && preview === "all";
  const [allPersonas, engineerEntries] = await Promise.all([listPersonas({ includeNonPublic: previewAll }), listEntries("engineer")]);
  const published = allPersonas.filter((p) => p.isPublished || previewAll).sort((a, b) => a.order - b.order);
  // The code world's terminal lists what is really published there.
  const terminalItems = engineerEntries.filter((e) => e.visibility === "public").map((e) => e.slug);
  const liveSlugs = new Set(published.map((p) => p.slug));
  const upcomingSlugs = ALL_PERSONAS.filter((s) => !liveSlugs.has(s));

  const placed = new Map(
    placeOnSpectrum([...published.map((p) => p.slug), ...upcomingSlugs]).map((pt) => [pt.slug, pt.t]),
  );

  const chapters: HubChapter[] = published.map((p) => ({
    slug: p.slug,
    t: placed.get(p.slug) ?? 0.5,
    body: p.body,
    points: p.points,
  }));
  const upcoming: HubUpcoming[] = upcomingSlugs.map((slug) => ({ slug, t: placed.get(slug) ?? 0.5 }));

  return <HubExperience chapters={chapters} upcoming={upcoming} terminalItems={terminalItems} />;
}

import type { Metadata } from "next";
import { ALL_PERSONAS, listPersonas } from "@/lib/content";
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
export default async function WhoAmIPage() {
  const published = (await listPersonas()).filter((p) => p.isPublished).sort((a, b) => a.order - b.order);
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

  return <HubExperience chapters={chapters} upcoming={upcoming} />;
}

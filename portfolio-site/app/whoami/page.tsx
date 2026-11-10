import type { Metadata } from "next";
import { ALL_PERSONAS, listEntries, listPersonas } from "@/lib/content";
import { getSettingValues } from "@/lib/settings/read";
import { shareMetadata, siteOrigin } from "@/lib/site/share-meta";
import { placeOnSpectrum } from "@/lib/site/spectrum";
import { HubExperience, type HubChapter, type HubUpcoming } from "../components/hub/hub-experience";

export async function generateMetadata(): Promise<Metadata> {
  const { identity, "hub.copy": copy } = await getSettingValues(["identity", "hub.copy"]);
  return shareMetadata({
    title: `${identity.name} — ${copy.headline}`,
    description: "Engineer, trader, photographer — and more perspectives on the way. Follow the light into each world.",
    cmd: "portfolio",
    origin: siteOrigin(null),
  });
}

/**
 * The hub (served at the bare root domain by proxy.ts, and at /whoami on hosts
 * without subdomain routing). Live personas, in rank order, become chapters;
 * unpublished ones are "more colours on the way". Every persona gets its
 * place on the continuous spectrum (pinned or auto-spread).
 */
export default async function WhoAmIPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Every persona climbs by default — all six worlds are built. `?preview=published` shows only
  // the ones whose content is published (what the hub used to do), the rest as colours on the way.
  const { preview } = await searchParams;
  const { identity, "hub.copy": copy } = await getSettingValues(["identity", "hub.copy"]);
  const previewAll = preview !== "published";
  const [adminPersonas, engineerEntries] = await Promise.all([previewAll ? listPersonas({ includeNonPublic: true }) : Promise.resolve([]), listEntries("engineer")]);
  // The admin read needs the server-only key; without it (or on a blip) the public list stands in.
  const allPersonas = adminPersonas.length ? adminPersonas : await listPersonas();
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

  return <HubExperience chapters={chapters} upcoming={upcoming} terminalItems={terminalItems} copy={copy} email={identity.email} />;
}

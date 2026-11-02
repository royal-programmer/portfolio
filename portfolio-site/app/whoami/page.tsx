import type { Metadata } from "next";
import { listPersonas } from "@/lib/content";
import { SPECTRUM_ORDER } from "@/lib/site/brand";
import { PrismHub, type HubDoor } from "../components/hub/prism-hub";

export const metadata: Metadata = {
  title: "Ratul Roy — one light, many colours",
  description:
    "Engineer, trader, photographer — and more wavelengths on the way. Pick a colour to step into that world.",
};

const INTRO =
  "One person, refracted. An engineer who ships, a trader who keeps score, a photographer who chases light. Pick a colour to step into that world — the dark rays are wavelengths I haven’t lit yet.";

/**
 * The hub (served at the bare root domain by proxy.ts, and at /whoami on hosts
 * without subdomain routing). Doors follow the spectrum; unpublished personas
 * render as unlit rays.
 */
export default async function WhoAmIPage() {
  const published = await listPersonas();
  const bySlug = new Map(published.map((p) => [p.slug, p]));

  const doors: HubDoor[] = SPECTRUM_ORDER.map((slug) => {
    const persona = bySlug.get(slug);
    return {
      slug,
      live: Boolean(persona?.isPublished),
      eyebrow: persona?.eyebrow ?? "",
    };
  });

  return <PrismHub doors={doors} intro={INTRO} />;
}

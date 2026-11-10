import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPersona,
  isLaunchedPersona,
  LAUNCHED_PERSONAS,
  type LaunchedPersona,
} from "@/lib/content";
import { placeOnSpectrum } from "@/lib/site/spectrum";
import { HomePage } from "../components/home-page";
import { WorldBoot } from "../components/world-boot";
import { TerminalRoot } from "../components/views/terminal-root";
import { getViews } from "@/lib/content/views";
import { terminalData } from "@/lib/site/terminal-data";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** public/hub/media.json (written by scripts/hub-media.mjs), or nothing. */
async function hubMedia(): Promise<Partial<Record<string, string[]>>> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "public", "hub", "media.json"), "utf8"));
  } catch {
    return {};
  }
}
import { loadHomeContent } from "../load-home-content";
import { loadEngineerTerminalData } from "../load-terminal-data";
import { ogDescription } from "@/lib/site/og-lines";
import { runParam, shareMetadata, siteOrigin } from "@/lib/site/share-meta";
import { SUBDOMAIN_BY_PERSONA } from "@/lib/site/hosts";
import { createShell } from "@/lib/site/terminal-shell";

type PersonaPageProps = {
  params: Promise<{ persona: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return LAUNCHED_PERSONAS.map((persona) => ({ persona }));
}

export async function generateMetadata({ params, searchParams }: PersonaPageProps): Promise<Metadata> {
  const [{ persona }, { run }] = await Promise.all([params, searchParams]);
  if (!isLaunchedPersona(persona)) {
    return {
      title: "Persona not found | Ratul Roy",
      description: "That persona mode isn’t available on this site.",
      robots: { index: false, follow: false },
    };
  }

  const record = await getPersona(persona);
  if (!record) {
    return {
      title: `${persona} | Ratul Roy`,
      description: "Multi-persona portfolio.",
    };
  }

  const title = `${record.label} | Ratul Roy`;
  if (persona !== "engineer") return { title, description: record.body };

  // The Engineer's page is a terminal: a link with ?run=<command> previews that command's output (/og).
  const origin = siteOrigin(SUBDOMAIN_BY_PERSONA[persona]);
  const cmd = runParam(run);
  if (cmd) {
    try {
      const data = await loadEngineerTerminalData();
      const known = createShell(data).commands.some((c) => c.name === cmd.split(/\s+/)[0].toLowerCase());
      if (known) return shareMetadata({ title: `$ ${cmd} · Ratul Roy`, description: ogDescription(data, cmd), cmd, origin, url: `${origin}/?run=${encodeURIComponent(cmd)}` });
    } catch {
      // The plain page metadata below still stands.
    }
  }
  return shareMetadata({ title, description: record.body, cmd: "portfolio", origin });
}

export default async function PersonaPage({ params, searchParams }: PersonaPageProps) {
  const [{ persona }, { via }] = await Promise.all([params, searchParams]);

  if (!isLaunchedPersona(persona)) {
    // The friendly page lives in ./not-found.tsx; calling notFound() makes the status a real 404.
    notFound();
  }

  const [{ personas, engineerEntries, engineerBlogPosts }, media] = await Promise.all([loadHomeContent(), hubMedia()]);
  const launched = persona as LaunchedPersona;
  const accent = personas.find((p) => p.slug === launched)?.accent ?? "#f3f1ec";
  // The same spectrum position the hub gave this persona, so the arriving frame matches.
  const ranked = [...personas].sort((a, b) => a.order - b.order).map((p) => p.slug);
  const t = placeOnSpectrum(ranked).find((p) => p.slug === launched)?.t ?? 0.5;
  const items = engineerEntries.filter((e) => e.visibility === "public").map((e) => e.slug);
  const photo = media.photographer?.[0] ? `/hub/photographer/${media.photographer[0]}` : undefined;
  const viaKind = via === "hub" ? "hub" : via === "normal" ? "normal" : null;
  // The Engineer page is one dataset with many views; its root is the terminal, which lists them
  // (17-persona-views.md). The other personas keep their page until their own rounds.
  if (launched === "engineer") {
    const views = getViews(launched);
    const data = terminalData(personas.find((p) => p.slug === launched), engineerEntries, engineerBlogPosts, views);
    return <TerminalRoot persona={launched} t={t} color={accent} via={viaKind} items={items} views={views} data={data} />;
  }
  return (
    <>
      {/* Opens dark, like the doorway that led here; lifts once the page has drawn. */}
      <WorldBoot slug={launched} color={accent} t={t} via={viaKind} items={items} photo={photo} />
      <HomePage
        routePersona={launched}
        personas={personas}
        engineerEntries={engineerEntries}
        engineerBlogPosts={engineerBlogPosts}
      />
    </>
  );
}

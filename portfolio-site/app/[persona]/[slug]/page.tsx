import type { Metadata } from "next";
import { PersonaLink } from "@/lib/site/persona-link";
import { notFound } from "next/navigation";
import {
  getEntryBySlug,
  getPersona,
  isLaunchedPersona,
  listEntries,
  type LaunchedPersona,
} from "@/lib/content";
import { getView, getViews } from "@/lib/content/views";
import { placeOnSpectrum } from "@/lib/site/spectrum";
import { HomePage } from "../../components/home-page";
import { WorldBoot } from "../../components/world-boot";
import { ViewShell } from "../../components/views/view-shell";
import { SERIES_PROFILES, buildSeries, type Series, type SeriesProfileId } from "@/lib/site/series-data";
import { terminalData } from "@/lib/site/terminal-data";
import { SeriesView } from "../../components/views/series/series-view";
import { loadHomeContent } from "../../load-home-content";
import { shareMetadata, siteOrigin } from "@/lib/site/share-meta";
import { SUBDOMAIN_BY_PERSONA } from "@/lib/site/hosts";

type ProjectDetailProps = {
  params: Promise<{ persona: string; slug: string }>;
  searchParams: Promise<{ via?: string }>;
};

export async function generateStaticParams() {
  const personas: LaunchedPersona[] = ["engineer"];
  const params: Array<{ persona: string; slug: string }> = [];
  for (const persona of personas) {
    // The page's views are branches at the same depth as its entries (17-persona-views.md).
    const views = getViews(persona);
    for (const view of views) params.push({ persona, slug: view.id });
    const entries = await listEntries(persona);
    for (const entry of entries) {
      // A view id wins over an entry slug (the view is checked first below); an entry with that
      // slug would be unreachable, so say so where it is written rather than ship it silently.
      if (views.some((v) => v.id === entry.slug)) {
        console.error(`[views] ${persona}: entry slug "${entry.slug}" collides with a view id and is shadowed`);
        continue;
      }
      params.push({ persona, slug: entry.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: ProjectDetailProps): Promise<Metadata> {
  const { persona, slug } = await params;
  if (!isLaunchedPersona(persona)) {
    return { title: "Not found | Ratul Roy", robots: { index: false, follow: false } };
  }
  const view = getView(persona, slug);
  if (view) {
    const record = await getPersona(persona);
    const origin = siteOrigin(SUBDOMAIN_BY_PERSONA[persona]);
    return shareMetadata({ title: `${view.name} · ${record?.label ?? persona} | Ratul Roy`, description: view.line, cmd: `view ${view.id}`, origin, url: `${origin}/${view.id}` });
  }
  const entry = await getEntryBySlug(persona, slug);
  if (!entry) {
    return { title: "Not found | Ratul Roy", robots: { index: false, follow: false } };
  }
  return {
    title: `${entry.title} | Ratul Roy`,
    description: entry.summary ?? entry.body?.slice(0, 160),
  };
}

export default async function PersonaEntryPage({ params, searchParams }: ProjectDetailProps) {
  const [{ persona, slug }, { via }] = await Promise.all([params, searchParams]);

  if (!isLaunchedPersona(persona)) notFound();

  const view = getView(persona, slug);
  if (view) return <PersonaViewPage persona={persona} view={view.id} fromTerminal={via === "terminal"} via={via} />;

  const entry = await getEntryBySlug(persona, slug);
  if (!entry) notFound();

  const stack = entry.type === "project" ? entry.data.techStack : [];
  const deployedUrl = entry.type === "project" ? entry.data.deployedUrl : undefined;
  const repoUrl = entry.type === "project" ? entry.data.repoUrl : undefined;
  const role = entry.type === "project" ? entry.data.role : undefined;

  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--fg)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 md:px-8 md:py-16 lg:px-10">
        <PersonaLink
          persona={persona}
          className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
        >
          ← Back to {persona}
        </PersonaLink>

        <article className="mt-8 space-y-6">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{entry.type}</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entry.title}</h1>
            {role ? <p className="text-[var(--muted)]">{role}</p> : null}
            {entry.summary ? (
              <p className="text-lg leading-relaxed text-[var(--muted)]">{entry.summary}</p>
            ) : null}
          </header>

          {stack.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {stack.map((tech) => (
                <li
                  key={tech}
                  className="rounded-full border px-3 py-1 text-xs text-[var(--muted)]"
                  style={{ borderColor: "var(--chip-border)", backgroundColor: "var(--chip-bg)" }}
                >
                  {tech}
                </li>
              ))}
            </ul>
          ) : null}

          {entry.body ? (
            <div
              className="rounded-3xl border p-6 leading-relaxed backdrop-blur-xl whitespace-pre-wrap"
              style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
            >
              {entry.body}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 pt-2 text-sm">
            {deployedUrl ? (
              <a
                href={deployedUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Live
              </a>
            ) : null}
            {repoUrl ? (
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Code
              </a>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  );
}

/**
 * A view of the page (17-persona-views.md): the same data, one way of seeing it, inside the shell
 * that remembers the pick and offers Exit. "stage" is the page as it was — the world's stage in 3D,
 * the projects, the writing — opening on its finished window, as from the hub's Normal display.
 */
async function PersonaViewPage({ persona, view, fromTerminal, via }: { persona: LaunchedPersona; view: string; fromTerminal: boolean; via?: string }) {
  const { personas, engineerEntries, engineerBlogPosts } = await loadHomeContent();
  const accent = personas.find((p) => p.slug === persona)?.accent ?? "#f3f1ec";
  const ranked = [...personas].sort((a, b) => a.order - b.order).map((p) => p.slug);
  const t = placeOnSpectrum(ranked).find((p) => p.slug === persona)?.t ?? 0.5;
  const items = engineerEntries.filter((e) => e.visibility === "public").map((e) => e.slug);
  if (view === "stage") {
    return (
      <ViewShell persona={persona} view={view} stripVia={fromTerminal}>
        {/* The terminal already printed this view's boot: no second entry animation. */}
        {fromTerminal ? null : <WorldBoot slug={persona} color={accent} t={t} via="normal" items={items} />}
        <HomePage routePersona={persona} personas={personas} engineerEntries={engineerEntries} engineerBlogPosts={engineerBlogPosts} />
      </ViewShell>
    );
  }
  if (view === "series") {
    // One dataset, three orderings: built here, picked on the client ("Who's watching?").
    const data = terminalData(personas.find((p) => p.slug === persona), engineerEntries, engineerBlogPosts, getViews(persona));
    const series = Object.fromEntries(SERIES_PROFILES.map((p) => [p.id, buildSeries(p.id, data, engineerEntries, engineerBlogPosts)])) as Record<SeriesProfileId, Series>;
    return (
      <ViewShell persona={persona} view={view} stripVia={fromTerminal}>
        <SeriesView accent={accent} series={series} contact={data.contact} status={data.status} portrait={data.portrait} fast={via === "normal"} />
      </ViewShell>
    );
  }
  notFound();
}

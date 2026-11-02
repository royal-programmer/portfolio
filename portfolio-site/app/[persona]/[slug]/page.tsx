import type { Metadata } from "next";
import { PersonaLink } from "@/lib/site/persona-link";
import { notFound } from "next/navigation";
import {
  getEntryBySlug,
  isLaunchedPersona,
  listEntries,
  type LaunchedPersona,
} from "@/lib/content";

type ProjectDetailProps = {
  params: Promise<{ persona: string; slug: string }>;
};

export async function generateStaticParams() {
  const personas: LaunchedPersona[] = ["engineer"];
  const params: Array<{ persona: string; slug: string }> = [];
  for (const persona of personas) {
    const entries = await listEntries(persona);
    for (const entry of entries) {
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
  const entry = await getEntryBySlug(persona, slug);
  if (!entry) {
    return { title: "Not found | Ratul Roy", robots: { index: false, follow: false } };
  }
  return {
    title: `${entry.title} | Ratul Roy`,
    description: entry.summary ?? entry.body?.slice(0, 160),
  };
}

export default async function PersonaEntryPage({ params }: ProjectDetailProps) {
  const { persona, slug } = await params;

  if (!isLaunchedPersona(persona)) notFound();

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

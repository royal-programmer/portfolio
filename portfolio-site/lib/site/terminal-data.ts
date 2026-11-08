/**
 * What the Engineer terminal knows (17-persona-views.md §6). Built on the server from the content
 * layer; pure data, so the shell and the file system can be unit-tested without React.
 */
import type { BlogPost, Entry, Persona, PersonaView } from "@/lib/content/types";
import { HUB_COPY, personaIdentity } from "@/lib/site/brand";

export type TermProject = {
  slug: string;
  title: string;
  year?: string;
  role?: string;
  stack: string[];
  summary?: string;
  repoUrl?: string;
  deployedUrl?: string;
};

export type TermPost = {
  slug: string;
  title: string;
  date?: string;
  excerpt?: string;
  body: string;
};

export type TermLink = { label: string; href: string };

export type TerminalData = {
  /** One-line identity and the longer `about` text. */
  who: string;
  about: string;
  stack: string[];
  uptime: string;
  contact: TermLink[];
  projects: TermProject[];
  posts: TermPost[];
  views: PersonaView[];
  /** Build id, when the deploy exposes one. */
  commit?: string;
};

const MAX_BODY = 6000;

export function terminalData(persona: Persona | undefined, entries: Entry[], posts: BlogPost[], views: PersonaView[]): TerminalData {
  const handle = personaIdentity("engineer").handle ?? "royal-programmer";
  return {
    who: "ratul · software engineer · bengaluru",
    about: persona?.body ?? "",
    stack: ["c#", ".net", "react", "typescript", "python", "fastapi", "sql server", "postgresql", "rabbitmq"],
    uptime: "2 years in production · 200+ users on the last rebuild · 11 automations kept alive",
    contact: [
      { label: "mail", href: `mailto:${HUB_COPY.email}` },
      { label: "github", href: `https://github.com/${handle}` },
    ],
    projects: entries
      .filter((e): e is Extract<Entry, { type: "project" }> => e.type === "project" && e.visibility === "public")
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        slug: e.slug,
        title: e.title,
        year: (e.occurredAt ?? e.createdAt)?.slice(0, 4),
        role: e.data.role,
        stack: e.data.techStack,
        summary: e.summary,
        repoUrl: e.data.repoUrl,
        deployedUrl: e.data.deployedUrl,
      })),
    posts: posts
      .filter((p) => p.visibility === "public")
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .map((p) => ({ slug: p.slug, title: p.title, date: p.publishedAt?.slice(0, 10), excerpt: p.excerpt, body: p.body.slice(0, MAX_BODY) })),
    views,
    commit: process.env.NEXT_PUBLIC_COMMIT || undefined,
  };
}

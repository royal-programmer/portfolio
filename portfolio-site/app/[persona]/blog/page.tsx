import type { Metadata } from "next";
import { PersonaLink } from "@/lib/site/persona-link";
import { notFound } from "next/navigation";
import { isLaunchedPersona, listBlogPosts } from "@/lib/content";
import { SITE_SHELL } from "../../components/site-shell";

type BlogIndexProps = {
  params: Promise<{ persona: string }>;
};

function formatDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export async function generateMetadata({ params }: BlogIndexProps): Promise<Metadata> {
  const { persona } = await params;
  if (!isLaunchedPersona(persona)) {
    return { title: "Not found | Ratul Roy", robots: { index: false, follow: false } };
  }
  return {
    title: `Blog · ${persona} | Ratul Roy`,
    description: `Writing and notes from ${persona} mode.`,
  };
}

export default async function PersonaBlogIndexPage({ params }: BlogIndexProps) {
  const { persona } = await params;
  if (!isLaunchedPersona(persona)) notFound();

  const posts = await listBlogPosts(persona);

  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--fg)]">
      <div className={`${SITE_SHELL} py-12 md:py-16`}>
        <PersonaLink
          persona={persona}
          className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
        >
          ← Back to {persona}
        </PersonaLink>

        <header className="mt-8 mb-10 max-w-2xl space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Writing</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Blog</h1>
          <p className="text-[var(--muted)]">Notes, explainers, and longer-form updates.</p>
        </header>

        {posts.length === 0 ? (
          <div
            className="rounded-3xl border border-dashed px-5 py-12 text-center backdrop-blur-xl"
            style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
          >
            <h2 className="mb-2 text-xl font-semibold">No posts yet</h2>
            <p className="mx-auto max-w-md text-[var(--muted)]">
              When posts are published for this persona, they will list here.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {posts.map((post) => {
              const dateLabel = formatDate(post.publishedAt);
              return (
                <li key={post.id}>
                  <PersonaLink
                    persona={persona}
                    path={`/blog/${post.slug}`}
                    className="block rounded-3xl border p-5 backdrop-blur-xl transition hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--surface-border))] sm:p-6"
                    style={{
                      backgroundColor: "var(--surface-bg)",
                      borderColor: "var(--surface-border)",
                    }}
                  >
                    {dateLabel ? (
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{dateLabel}</p>
                    ) : null}
                    <h2 className="mt-2 text-xl font-semibold">{post.title}</h2>
                    <p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">
                      {post.excerpt ?? post.body.slice(0, 180)}
                    </p>
                  </PersonaLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

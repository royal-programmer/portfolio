import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost, isLaunchedPersona, listBlogPosts } from "@/lib/content";

type BlogPostPageProps = {
  params: Promise<{ persona: string; postSlug: string }>;
};

export async function generateStaticParams() {
  const personas = ["engineer", "trader", "photographer"] as const;
  const params: Array<{ persona: string; postSlug: string }> = [];
  for (const persona of personas) {
    const posts = await listBlogPosts(persona);
    for (const post of posts) {
      params.push({ persona, postSlug: post.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { persona, postSlug } = await params;
  if (!isLaunchedPersona(persona)) {
    return { title: "Not found | Ratul Roy", robots: { index: false, follow: false } };
  }
  const post = await getBlogPost(persona, postSlug);
  if (!post) {
    return { title: "Not found | Ratul Roy", robots: { index: false, follow: false } };
  }
  return {
    title: `${post.title} | Ratul Roy`,
    description: post.excerpt ?? post.body.slice(0, 160),
  };
}

export default async function PersonaBlogPostPage({ params }: BlogPostPageProps) {
  const { persona, postSlug } = await params;
  if (!isLaunchedPersona(persona)) notFound();

  const post = await getBlogPost(persona, postSlug);
  if (!post) notFound();

  const dateLabel = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--fg)]">
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 md:px-8 md:py-16 lg:px-10">
        <Link
          href={`/${persona}/blog`}
          className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
        >
          ← All posts
        </Link>

        <header className="mt-8 space-y-3">
          {dateLabel ? (
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{dateLabel}</p>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{post.title}</h1>
          {post.excerpt ? <p className="text-lg text-[var(--muted)]">{post.excerpt}</p> : null}
          {post.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2 pt-2">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border px-2.5 py-0.5 text-xs text-[var(--muted)]"
                  style={{ borderColor: "var(--chip-border)", backgroundColor: "var(--chip-bg)" }}
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        <div
          className="mt-8 rounded-3xl border p-5 leading-relaxed whitespace-pre-wrap backdrop-blur-xl sm:p-6"
          style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
        >
          {post.body}
        </div>
      </article>
    </main>
  );
}

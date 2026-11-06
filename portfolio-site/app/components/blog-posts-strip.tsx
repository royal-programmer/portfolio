import { PersonaLink } from "@/lib/site/persona-link";
import type { PersonaSlug } from "@/lib/content/types";
import type { BlogPost } from "@/lib/content";
import { SITE_SECTION } from "./site-shell";

type BlogPostsStripProps = {
  posts: BlogPost[];
  personaSlug?: string;
};

function formatDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function BlogPostsStrip({ posts, personaSlug = "engineer" }: BlogPostsStripProps) {
  const recent = posts.slice(0, 3);

  return (
    <section className={SITE_SECTION}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Writing</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Recent posts</h2>
        </div>
        <PersonaLink
          persona={personaSlug as PersonaSlug}
          path="/blog"
          className="min-h-11 inline-flex items-center text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline sm:min-h-0"
        >
          All posts →
        </PersonaLink>
      </div>

      {recent.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed px-5 py-10 text-center backdrop-blur-xl sm:px-6"
          style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
        >
          <p className="text-[var(--muted)]">
            No posts yet. Notes and deep-dives will show up here when published.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {recent.map((post) => {
            const dateLabel = formatDate(post.publishedAt);
            return (
              <PersonaLink
                key={post.id}
                persona={personaSlug as PersonaSlug}
                path={`/blog/${post.slug}`}
                className="group rounded-3xl border p-5 backdrop-blur-xl transition hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--surface-border))] sm:p-6"
                style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
              >
                {dateLabel ? (
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{dateLabel}</p>
                ) : null}
                <h3 className="mt-2 text-lg font-semibold group-hover:text-[var(--accent)]">{post.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">
                  {post.excerpt ?? post.body.slice(0, 160)}
                </p>
              </PersonaLink>
            );
          })}
        </div>
      )}
    </section>
  );
}

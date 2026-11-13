import Link from "next/link";
import { notFound } from "next/navigation";
import { listEntries } from "@/lib/content";
import { getAllSettings } from "@/lib/settings/read";
import { isSettingKey, type Settings } from "@/lib/settings/schema";
import { SettingEditor } from "../../../editor";
import { SkillsScreen, type PickOption, type SkillGroupRow } from "../../../_collections/skills-screen";
import { getServerClient } from "@/lib/db/server";
import { parseRecordData } from "@/lib/content/record-schemas";
import { CollectionScreen, type ProjectRow } from "../../../_collections/collection-screen";
import { findCollection } from "../../../collections";
import { RecordsScreen } from "../../../_collections/records-screen";
import { PostsScreen, type PostRow } from "../../../_collections/posts-screen";
import { dayOf } from "../../../_lib/post-forms";
import { BookingEditor } from "../../../_collections/booking-editor";
import { loadRecordRows } from "../../../_lib/load";
import type { RecordType } from "@/lib/content/types";
import { findSection, sectionPath } from "../../../nav";

type Props = { params: Promise<{ group: string; section: string }>; searchParams: Promise<{ key?: string; id?: string; new?: string }> };

export default async function AdminSection({ params, searchParams }: Props) {
  const [{ group: gid, section: sid }, sp] = await Promise.all([params, searchParams]);
  const found = findSection(gid, sid);
  if (!found) notFound();
  const { section } = found;

  if (section.kind === "soon") {
    return (
      <section className="adm-overview">
        <h1>{section.label}</h1>
        <p className="adm-note">{section.note ?? "Coming with a later round."}</p>
      </section>
    );
  }
  if (section.kind === "collection") {
    const col = findCollection(gid, sid);
    if (!col) notFound();
    if (col.kind === "records" && col.recordType) {
      const rows = await loadRecordRows(col.recordType as RecordType, col.uploads);
      return <RecordsScreen collection={col} rows={rows} initialId={sp.id} startNew={sp.new === "1"} />;
    }
    if (col.kind === "posts") {
      const { rows, ready } = await loadPosts();
      return <PostsScreen rows={rows} ready={ready} initialId={sp.id} startNew={sp.new === "1"} />;
    }
    if (col.id === "skills") return <SkillsScreen {...(await loadSkills())} initialId={sp.id} />;
    const entries = col.kind === "entries" || col.kind === "media" ? await listEntries("engineer", { includeNonPublic: true }).catch(() => []) : [];
    const rows: ProjectRow[] = entries
      .filter((e) => e.type === "project")
      .map((e) => {
        const d = e.data as { role?: string; techStack?: string[]; deployedUrl?: string; repoUrl?: string; demoVideoUrl?: string; story?: Record<string, unknown>; media?: Record<string, unknown> };
        return {
          id: e.id,
          slug: e.slug,
          title: e.title,
          summary: e.summary ?? "",
          body: e.body ?? "",
          visibility: e.visibility,
          featured: e.featured,
          role: d.role ?? "",
          techStack: (d.techStack ?? []).join(", "),
          deployedUrl: d.deployedUrl ?? "",
          repoUrl: d.repoUrl ?? "",
          demoVideoUrl: d.demoVideoUrl ?? "",
          story: d.story ?? {},
          assets: d.media ?? {},
          order: e.order,
          photoChoices: e.media.filter((m) => m.kind === "image" && m.width && m.height).map((m) => ({ src: m.optimizedUrl, w: m.width ?? 0, h: m.height ?? 0, alt: m.alt ?? "", label: m.alt || m.caption || m.id.slice(0, 8) })),
          media: e.media.map((m) => ({ id: m.id, thumbUrl: m.thumbUrl, alt: m.alt ?? "", entryId: e.id })),
        };
      });
    const nf = col.id === "projects" ? (await getAllSettings()).items.netflix : null;
    return <CollectionScreen collection={col} rows={rows} initialId={sp.id} startNew={sp.new === "1"} booking={nf ? { draft: nf.draft as Settings["netflix"], live: nf.live as Settings["netflix"] } : undefined} />;
  }

  if (section.kind === "booking") {
    const { items } = await getAllSettings();
    return <BookingEditor draft={items.netflix.draft as Settings["netflix"]} live={items.netflix.live as Settings["netflix"]} />;
  }

  const keys = section.keys ?? [];
  const active = isSettingKey(sp.key) && keys.includes(sp.key) ? sp.key : keys[0];
  if (!active) notFound();
  const { tableReady, items } = await getAllSettings();
  const s = items[active];
  return (
    <>
      {keys.length > 1 ? (
        <nav className="adm-tabs" aria-label={`${section.label} settings`}>
          {keys.map((k) => (
            <Link key={k} href={`${sectionPath(gid, sid)}?key=${k}`} aria-current={k === active ? "page" : undefined}>
              {k.replace("engineer.", "")}
              {items[k].differs ? <b /> : null}
            </Link>
          ))}
        </nav>
      ) : null}
      {/* key: a different setting starts from its own state */}
      <SettingEditor key={active} settingKey={active} title={section.label} draft={s.draft} live={s.live} fallback={s.fallback} stored={s.stored} tableReady={tableReady} updatedAt={s.updatedAt} />
    </>
  );
}

/** Blog posts, hidden ones included (the admin session passes RLS). */
async function loadPosts(): Promise<{ rows: PostRow[]; ready: boolean }> {
  try {
    const sb = await getServerClient();
    const { data, error } = await sb.from("blog_posts").select("id, slug, title, excerpt, body, tags, visibility, published_at, updated_at").eq("persona_slug", "engineer").order("updated_at", { ascending: false });
    if (error) return { rows: [], ready: false };
    return {
      ready: true,
      rows: (data ?? []).map((r) => ({
        id: String(r.id),
        slug: String(r.slug),
        title: String(r.title ?? ""),
        excerpt: String(r.excerpt ?? ""),
        body: String(r.body ?? ""),
        tags: ((r.tags as string[] | null) ?? []).join(", "),
        visibility: String(r.visibility),
        publishedAt: dayOf(r.published_at as string | null),
        updatedAt: String(r.updated_at ?? ""),
      })),
    };
  } catch {
    return { rows: [], ready: false };
  }
}

/** The skill groups (drafts included, through the admin session) and the records they can link to. */
async function loadSkills() {
  const empty = { rows: [] as SkillGroupRow[], options: { projects: [], experience: [], certifications: [] } as { projects: PickOption[]; experience: PickOption[]; certifications: PickOption[] } };
  try {
    const sb = await getServerClient();
    const { data } = await sb
      .from("entries")
      .select("id, slug, title, visibility, order, type, data")
      .eq("persona_slug", "engineer")
      .in("type", ["skill_group", "experience", "certification", "project"])
      .order("order", { ascending: true });
    const out = empty;
    for (const r of data ?? []) {
      const slug = String(r.slug);
      if (r.type === "project") out.options.projects.push({ slug, label: String(r.title) });
      else if (r.type === "experience") {
        const d = parseRecordData("experience", r.data);
        if (d) out.options.experience.push({ slug, label: `${d.role} · ${d.company}` });
      } else if (r.type === "certification") {
        const d = parseRecordData("certification", r.data);
        if (d) out.options.certifications.push({ slug, label: `${d.line} · ${d.issuer}` });
      } else {
        const d = parseRecordData("skill_group", r.data);
        if (d)
          out.rows.push({
            id: String(r.id),
            slug,
            visibility: String(r.visibility),
            group: d.group,
            items: d.items.map((i) => ({ name: i.name, projects: i.projects ?? [], experience: i.experience ?? [], certifications: i.certifications ?? [] })),
          });
      }
    }
    return out;
  } catch {
    return empty;
  }
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { listEntries } from "@/lib/content";
import { getAllSettings } from "@/lib/settings/read";
import { isSettingKey } from "@/lib/settings/schema";
import { SettingEditor } from "../../../editor";
import { CollectionScreen, type ProjectRow } from "../../../_collections/collection-screen";
import { findCollection } from "../../../collections";
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
    const entries = col.kind === "entries" || col.kind === "media" ? await listEntries("engineer", { includeNonPublic: true }).catch(() => []) : [];
    const rows: ProjectRow[] = entries
      .filter((e) => e.type === "project")
      .map((e) => {
        const d = e.data as { role?: string; techStack?: string[]; deployedUrl?: string; repoUrl?: string; demoVideoUrl?: string };
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
          media: e.media.map((m) => ({ id: m.id, thumbUrl: m.thumbUrl, alt: m.alt ?? "", entryId: e.id })),
        };
      });
    return <CollectionScreen collection={col} rows={rows} initialId={sp.id} startNew={sp.new === "1"} />;
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

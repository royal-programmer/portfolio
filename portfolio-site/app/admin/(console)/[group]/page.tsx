import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listEntries, isPersonaSlug } from "@/lib/content";
import { collectionsFor } from "../../collections";
import { NAV, legacyPath, sectionPath } from "../../nav";

/**
 * `/admin/<group>`: Site home or a persona home (data overview with quick-add buttons). An old flat
 * `/admin/<section>` path redirects to its new home.
 */
export default async function AdminGroup({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const legacy = legacyPath(group);
  if (legacy) redirect(legacy);
  const g = NAV.find((x) => x.id === group);
  if (!g) notFound();

  const cols = collectionsFor(g.id);
  const entries = isPersonaSlug(g.id) && cols.some((c) => c.kind === "entries" && c.status === "live") ? await listEntries(g.id, { includeNonPublic: true }).catch(() => []) : [];
  return (
    <section className="adm-overview">
      <h1>{g.label}</h1>
      <p className="adm-hint">{g.id === "site" ? "Settings that are not specific to one world." : "Data overview for this world."}</p>
      {cols.length ? (
        <div className="adm-cards">
          {cols.map((c) => (
            <div key={c.id} className="adm-card">
              <Link href={sectionPath(g.id, c.id)}>{c.label}</Link>
              <span className="adm-hint">{c.status === "live" ? (c.kind === "entries" ? `${entries.filter((e) => e.type === "project").length} records` : "photos") : "coming"}</span>
              {c.status === "live" && c.kind === "entries" ? (
                <Link className="adm-btn" href={`${sectionPath(g.id, c.id)}?new=1`}>
                  New {c.singular}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <h2 className="adm-h2">Sections</h2>
      <ul className="adm-plain">
        {g.sections
          .filter((s) => s.kind !== "collection")
          .map((s) => (
            <li key={s.id}>
              {s.kind === "soon" ? (
                <>
                  {s.label} <span className="adm-hint">{s.note}</span>
                </>
              ) : (
                <Link href={sectionPath(g.id, s.id)}>{s.label}</Link>
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}

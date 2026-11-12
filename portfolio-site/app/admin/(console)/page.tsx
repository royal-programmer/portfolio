/* eslint-disable @next/next/no-html-link-for-pages -- /admin/preview is a route handler (sets a cookie, redirects), not a page */
import Link from "next/link";
import { listEntries, LAUNCHED_PERSONAS } from "@/lib/content";
import { getUser } from "@/lib/db/server";
import { mapOverview, sectionPath } from "../nav";

/** /admin: who is signed in, Preview site, per-persona counts, and the whole map (now / coming). */
export default async function AdminHome() {
  const user = await getUser().catch(() => null);
  const counts = await Promise.all(
    LAUNCHED_PERSONAS.map(async (p) => {
      try {
        return [p, (await listEntries(p, { includeNonPublic: true })).length] as const;
      } catch {
        return [p, null] as const;
      }
    }),
  );
  return (
    <section className="adm-overview">
      <h1>Admin</h1>
      <p className="adm-hint">Signed in as {user?.email ?? "admin"}.</p>
      <div className="adm-actions" style={{ marginTop: ".8rem" }}>
        <a className="adm-btn" href="/admin/preview?to=hub" target="_blank" rel="noreferrer">
          Preview site (hub)
        </a>
        <a className="adm-btn" href="/admin/preview?to=engineer" target="_blank" rel="noreferrer">
          Preview Engineer
        </a>
        <a className="adm-btn is-ghost" href="/admin/preview?to=off">
          Preview off
        </a>
      </div>
      <h2 className="adm-h2">Records per world</h2>
      <ul className="adm-plain">
        {counts.map(([p, n]) => (
          <li key={p}>
            <Link href={sectionPath(p)}>{p}</Link> <span className="adm-hint">{n === null ? "unavailable" : `${n} entries`}</span>
          </li>
        ))}
      </ul>
      <h2 className="adm-h2">What is editable now, and what is coming</h2>
      {mapOverview().map(({ group: og, now, soon }) => (
        <div key={og.id} className="adm-overview-group">
          <h2 style={{ ["--accent" as string]: og.accent }}>{og.label}</h2>
          <div className="adm-overview-cols">
            <div>
              <h3>Editable now</h3>
              {now.length ? (
                <ul>
                  {now.map((s) => (
                    <li key={s.id}>
                      <Link href={sectionPath(og.id, s.id)}>{s.label}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="adm-hint">Nothing yet.</p>
              )}
            </div>
            <div>
              <h3>Coming</h3>
              {soon.length ? (
                <ul>
                  {soon.map((s) => (
                    <li key={s.id}>
                      {s.label}
                      {s.note ? <span className="adm-hint"> {s.note}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="adm-hint">Nothing planned.</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

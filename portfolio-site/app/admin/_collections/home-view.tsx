/* eslint-disable @next/next/no-html-link-for-pages -- /admin/preview is a route handler (sets a cookie, redirects), not a page */
import Link from "next/link";
import { healthSummary, type HealthItem } from "../_lib/health";
import { RevertButton, ShareButton } from "./home-bits";

export type HomeData = {
  email: string;
  preview: boolean;
  source: string;
  lastPublish: string | null;
  loaded: boolean;
  health: HealthItem[];
  recent: { at: string; text: string; href: string; revert: number | null }[];
  insights: string | null;
  /** Server clock for the "x min ago" text. */
  now: number;
};

const ago = (iso: string, now: number) => {
  const m = Math.round((now - Date.parse(iso)) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** The admin home, from plain data (so a fixture can render it too). */
export function HomeView({ email, preview, source, lastPublish, loaded, health, recent, insights, now }: HomeData) {
  return (
    <section className="adm-overview adm-home-page">
      <h1>Admin</h1>
      <div className="adm-strip" role="list" aria-label="Status">
        <span role="listitem">
          Signed in as <b>{email}</b>
        </span>
        <span role="listitem" className={`adm-pill ${preview ? "is-warn" : ""}`}>
          {preview ? "Preview site: on" : "Preview off"}
        </span>
        <span role="listitem" className="adm-pill">
          Content source: {source}
        </span>
        <span role="listitem" className="adm-hint">
          {lastPublish ? `Last publish ${ago(lastPublish, now)}` : "No publish recorded yet"}
        </span>
      </div>
      <div className="adm-actions" style={{ marginTop: ".8rem" }}>
        <a className="adm-btn" href="/admin/preview?to=hub" target="_blank" rel="noreferrer">
          Preview site
        </a>
        {preview ? (
          <a className="adm-btn is-ghost" href="/admin/preview?to=off">
            Preview off
          </a>
        ) : null}
      </div>

      <h2 className="adm-h2">Quick actions</h2>
      <div className="adm-actions">
        <Link className="adm-btn is-primary" href="/admin/engineer/projects?new=1">
          Add project
        </Link>
        <Link className="adm-btn" href="/admin/engineer/certifications?new=1">
          Add certificate
        </Link>
        <Link className="adm-btn" href="/admin/engineer/experience?new=1">
          Add experience
        </Link>
        <Link className="adm-btn" href="/admin/engineer/hiring">
          Edit hiring facts
        </Link>
        <Link className="adm-btn" href="/admin/engineer/copy?key=engineer.resume">
          Build résumé
        </Link>
        <ShareButton />
        <a className="adm-btn is-ghost" href="/admin/backup" download>
          Backup now
        </a>
      </div>

      <h2 className="adm-h2">
        Site health {loaded ? <span className="adm-hint">· {healthSummary(health)}</span> : null}
      </h2>
      {!loaded ? <p className="adm-note is-bad">Could not read any records, so nothing is checked. A green list would be a lie.</p> : null}
      <ul className="adm-health">
        {health.map((h) => (
          <li key={h.id} className={`is-${h.status}`}>
            <span className="adm-dot" aria-hidden="true" />
            <div>
              <Link href={h.href}>{h.label}</Link>
              <span className="adm-hint">
                {" "}
                {h.status === "ok" ? "Green" : "Amber"}: {h.detail}
              </span>
              {h.examples.length ? (
                <div className="adm-hint">
                  {h.examples.join(" · ")}
                  {h.count > h.examples.length ? ` · +${h.count - h.examples.length} more` : ""}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="adm-h2">Recent changes</h2>
      {recent.length ? (
        <ul className="adm-recent">
          {recent.map((r, i) => (
            <li key={i}>
              <Link href={r.href}>{r.text}</Link> <span className="adm-hint">{ago(r.at, now)}</span>
              {r.revert ? <RevertButton id={r.revert} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-hint">Nothing changed yet.</p>
      )}

      {insights ? (
        <div className="adm-card" style={{ marginTop: "1.2rem" }}>
          <Link href={insights}>Insights</Link>
          <span className="adm-hint">Visits and what visitors do on the site.</span>
        </div>
      ) : null}
    </section>
  );
}

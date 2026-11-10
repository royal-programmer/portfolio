"use client";

/** The admin frame: a left rail of groups (a select on phones), the migration banner, sign-out. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "../capture/actions";
import { adminIsDirty } from "./dirty";

type RailGroup = { id: string; label: string; accent: string; differs: boolean };

const LEAVE = "You have unsaved edits. Leave without saving?";

export function AdminShell({ groups, tableReady, error, children }: { groups: RailGroup[]; tableReady: boolean; error?: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const active = path.split("/")[2] ?? "identity";
  const guard = (e: React.MouseEvent) => {
    if (adminIsDirty() && !window.confirm(LEAVE)) e.preventDefault();
  };
  const items = [
    ...groups.map((g) => ({ href: `/admin/${g.id}`, id: g.id, label: g.label, accent: g.accent, dot: g.differs })),
    { href: "/admin/history", id: "history", label: "History", accent: "#94a3b8", dot: false },
  ];
  return (
    <div className="adm-root">
      <aside className="adm-rail" aria-label="Admin sections">
        <div className="adm-brand">
          <span>admin</span>
          <small>ratulroy</small>
        </div>
        <select
          className="adm-select"
          aria-label="Section"
          value={active}
          onChange={(e) => {
            if (adminIsDirty() && !window.confirm(LEAVE)) return;
            router.push(`/admin/${e.target.value}`);
          }}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
              {i.dot ? " (draft differs)" : ""}
            </option>
          ))}
        </select>
        <nav className="adm-nav">
          {items.map((i) => (
            <Link key={i.id} href={i.href} onClick={guard} aria-current={active === i.id ? "page" : undefined} style={{ ["--accent" as string]: i.accent }}>
              <i aria-hidden="true" />
              {i.label}
              {i.dot ? <b title="draft differs from live" /> : null}
            </Link>
          ))}
          <hr />
          <Link href="/capture/admin" onClick={guard}>
            Entries · projects
          </Link>
        </nav>
        <form action={signOut} className="adm-signout">
          <button type="submit" className="adm-link">
            Sign out
          </button>
        </form>
      </aside>
      <main className="adm-main">
        {!tableReady ? (
          <p className="adm-banner" role="alert">
            {error ? `Settings database error: ${error}` : "The settings table is not applied yet (migration 0011). The site runs on its code defaults, and edits cannot be saved until it is applied."}
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}

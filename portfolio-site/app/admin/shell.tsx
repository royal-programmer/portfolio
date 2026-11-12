"use client";

/**
 * The admin frame: a sidebar grouped by persona (Site first), each group collapsible (remembered in
 * localStorage) with a count and a dirty dot, arrow-key navigation, and on phones a top sheet menu.
 * The map itself is `nav.ts`.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "./entry-actions";
import { adminIsDirty } from "./dirty";
import { NAV, sectionPath, type NavGroup } from "./nav";

const LEAVE = "You have unsaved edits. Leave without saving?";
const OPEN_KEY = "xp-admin-nav";

const groupKeysDiffer = (g: NavGroup, differing: readonly string[]) => g.sections.some((s) => s.keys?.some((k) => differing.includes(k)));

export function AdminShell({ differing, email, tableReady, error, children }: { differing: string[]; email: string; tableReady: boolean; error?: string; children: React.ReactNode }) {
  const path = usePathname();
  const [, activeGroup = "", activeSection = ""] = path.split("/").filter(Boolean);
  const [sheet, setSheet] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const sheetOpen = sheet === path;

  const guard = (e: React.MouseEvent) => {
    if (adminIsDirty() && !window.confirm(LEAVE)) e.preventDefault();
  };

  // Apply remembered collapse state after mount (the current group always stays open).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>;
      navRef.current?.querySelectorAll<HTMLDetailsElement>("details[data-group]").forEach((d) => {
        const id = d.dataset.group ?? "";
        d.open = id === activeGroup || (saved[id] ?? id === "site");
      });
    } catch {
      /* storage blocked: defaults stand */
    }
  }, [activeGroup]);

  const remember = (id: string, open: boolean) => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>;
      saved[id] = open;
      localStorage.setItem(OPEN_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const nodes = Array.from(navRef.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? []).filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const to = e.key === "Home" ? 0 : e.key === "End" ? nodes.length - 1 : e.key === "ArrowDown" ? Math.min(nodes.length - 1, i + 1) : Math.max(0, i - 1);
    e.preventDefault();
    nodes[to].focus();
  };

  const groupDot = (g: NavGroup) => groupKeysDiffer(g, differing);

  return (
    <div className="adm-root">
      <aside className="adm-rail" aria-label="Admin sections">
        <div className="adm-railtop">
          <div className="adm-brand">
            <span>admin</span>
            <small>ratulroy</small>
          </div>
          <button type="button" className="adm-menu-btn" aria-expanded={sheetOpen} aria-controls="adm-nav" onClick={() => setSheet(sheetOpen ? null : path)}>
            {sheetOpen ? "Close" : "Menu"}
          </button>
        </div>
        <nav id="adm-nav" ref={navRef} className={`adm-nav${sheetOpen ? " is-open" : ""}`} aria-label="Admin" onKeyDown={onKeyDown}>
          <Link data-nav href="/admin" onClick={guard} className="adm-home" aria-current={path === "/admin" ? "page" : undefined}>
            Home
          </Link>
          {NAV.map((g) => (
            <details key={g.id} data-group={g.id} className="adm-ngroup" open={g.id === activeGroup || g.id === "site"} onToggle={(e) => remember(g.id, e.currentTarget.open)} style={{ ["--accent" as string]: g.accent }}>
              <summary data-nav>
                <i aria-hidden="true" />
                <span>{g.label}</span>
                {groupDot(g) ? <b title="a draft differs from live" /> : null}
                <em>{g.sections.length}</em>
              </summary>
              <ul>
                <li>
                  <Link data-nav href={sectionPath(g.id)} onClick={guard} aria-current={activeGroup === g.id && !activeSection ? "page" : undefined}>
                    Overview
                  </Link>
                </li>
                {g.sections.map((s, i) => (
                  <li key={s.id}>
                    {s.cluster && s.cluster !== g.sections[i - 1]?.cluster ? <div className="adm-cluster">{s.cluster}</div> : null}
                    <Link
                      data-nav
                      href={sectionPath(g.id, s.id)}
                      onClick={guard}
                      aria-current={activeGroup === g.id && activeSection === s.id ? "page" : undefined}
                      className={s.kind === "soon" ? "is-soon" : undefined}
                    >
                      {s.label}
                      {s.keys?.some((k) => differing.includes(k)) ? <b title="draft differs from live" /> : null}
                      {s.kind === "soon" ? <small>soon</small> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </nav>
        <div className="adm-account">
          <span className="adm-signed" title={email}>
            Signed in as <b>{email}</b>
          </span>
          <form action={signOut}>
            <button type="submit" className="adm-btn">
              Sign out
            </button>
          </form>
        </div>
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


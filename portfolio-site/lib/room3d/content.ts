/**
 * What the room shows, built only from the content layer (round 36): the engineer's `TerminalData` (the same data
 * the terminal, the Netflix view and the Stage read, records under `db`). One model feeds every surface: the
 * boards drawn on the monitor, the skill shelf and the wall; the panels that open over the room; and the Reader
 * page. Nothing here is a record: a section with no data is simply empty (and left out), never invented. Pure and
 * type-only on the data (no React, no three.js), so `scripts/room3d-check.mjs` runs it too.
 */
import { hireLine } from "@/lib/site/hire-line";
import type { TerminalData, TermLink } from "@/lib/site/terminal-data";

/** Panels that open over the room. `terminal` is the live terminal (the desk's monitor); the rest are content. */
export const PANEL_IDS = ["terminal", "projects", "skills", "tv", "credentials", "moments", "worlds", "hire", "now"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

/** `cmd: "panel:hire"` on an object's interaction opens the panel; anything else is a terminal command. */
export function parsePanel(cmd: string | undefined | null): PanelId | null {
  if (!cmd || !cmd.startsWith("panel:")) return null;
  const id = cmd.slice(6);
  return (PANEL_IDS as readonly string[]).includes(id) ? (id as PanelId) : null;
}

export type RoomProject = { slug: string; title: string; year?: string; role?: string; stack: string[]; summary: string; status: "live" | "building" | "dev"; statusLabel: string; repoUrl?: string; deployedUrl?: string; clips: Array<{ id: string; label: string; poster: string; src: string }> };
export type RoomSkillGroup = { group: string; items: string[] };
export type RoomCredential = { id: string; kind: "certificate" | "education"; title: string; issuer: string; year?: string; note?: string; verify?: string };
export type RoomMoment = { id: string; date: string; subject: string; tag?: string; grade?: string; branch: string };
export type RoomHire = { line: string; availability: string; roles: string[]; level: string; stackCore: string[]; where: string; resume: string; mail?: string; book?: { label: string; href: string }; links: TermLink[]; proof: string[] };

export type RoomContent = {
  name: string;
  title: string;
  location: string;
  about: string;
  projects: RoomProject[];
  skills: RoomSkillGroup[];
  experience: TerminalData["resume"]["experience"];
  credentials: RoomCredential[];
  moments: RoomMoment[];
  now: { month: string; lines: string[] } | null;
  hire: RoomHire;
  contact: TermLink[];
};

const https = (u: string | undefined): string | undefined => (u && /^https:\/\//i.test(u.trim()) ? u.trim() : undefined);

/** How many key moments the wall and the panel show: the newest, with a result or a tag first. */
export const MOMENTS_MAX = 8;

export function buildRoomContent(d: TerminalData): RoomContent {
  const projects = d.projects.map((p): RoomProject => {
    const status = p.story?.status === "live-building" ? "building" : p.story?.status === "live" ? "live" : p.story?.status ? "dev" : p.deployedUrl ? "live" : "dev";
    return {
      slug: p.slug,
      title: p.title,
      year: p.year,
      role: p.role,
      stack: p.stack,
      summary: p.summary ?? p.story?.description ?? "",
      status,
      statusLabel: status === "live" ? "live" : status === "building" ? "live, still building" : "in development",
      repoUrl: https(p.repoUrl),
      deployedUrl: https(p.deployedUrl),
      clips: (p.media?.clips ?? []).map((c) => ({ id: c.id, label: c.label, poster: c.poster, src: c.src })),
    };
  });
  const credentials: RoomCredential[] = [
    ...d.resume.certifications.map((c, i): RoomCredential => ({ id: c.id ?? `cert-${i}`, kind: "certificate", title: c.line, issuer: c.issuer, verify: https(c.verify) })),
    ...d.resume.education.map((e, i): RoomCredential => ({ id: `edu-${i}`, kind: "education", title: e.degree, issuer: e.school, year: e.year, note: e.note })),
  ];
  const ranked = [...d.timeline].sort((a, b) => b.date.localeCompare(a.date));
  const moments = [...ranked.filter((c) => c.grade || c.tag), ...ranked.filter((c) => !c.grade && !c.tag)]
    .slice(0, MOMENTS_MAX)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((c, i): RoomMoment => ({ id: `m-${i}`, date: c.date, subject: c.subject, tag: c.tag, grade: c.grade, branch: c.branch }));
  const h = d.hiring;
  const mail = d.contact.find((c) => c.label === "mail")?.href;
  const links = d.contact.filter((c) => c.label !== "mail" && c.group !== "elsewhere" && /^https:\/\//i.test(c.href));
  const book = d.book && https(d.book.href) ? { label: d.book.label, href: https(d.book.href)! } : undefined;
  return {
    name: d.resume.name || d.who,
    title: d.resume.title,
    location: d.resume.location,
    about: d.about || d.resume.summary,
    projects,
    skills: d.resume.skills.filter((g) => g.items.length > 0).map((g) => ({ group: g.group, items: g.items })),
    experience: d.resume.experience,
    credentials,
    moments,
    now: d.now && d.now.lines.length ? d.now : null,
    hire: {
      line: hireLine(h),
      availability: h.availability,
      roles: h.roles,
      level: h.level,
      stackCore: h.stack.core,
      where: [h.location.base, h.location.modes.join(" / "), ...(h.location.relocate ? ["open to relocate"] : [])].filter(Boolean).join(" · "),
      resume: h.links.resume,
      mail,
      book,
      links,
      proof: h.proof,
    },
    contact: d.contact,
  };
}

/** One tile on a board: what is drawn and what a click on it opens. */
export type BoardItem = { id: string; title: string; sub: string; tag: string; /** Which panel item a click opens (an index into the panel's own list). */ index: number };

/** The items a board shows for a source, newest or first first, capped at `max` (the layout's own limit). */
export function boardItems(c: RoomContent, source: "skills" | "credentials" | "moments" | "projects", max: number): BoardItem[] {
  switch (source) {
    case "projects":
      return c.projects.slice(0, max).map((p, i) => ({ id: p.slug, title: p.title, sub: p.summary, tag: p.statusLabel, index: i }));
    case "skills":
      return c.skills.slice(0, max).map((g, i) => ({ id: `s-${i}`, title: g.group, sub: g.items.slice(0, 4).join(" · "), tag: String(g.items.length), index: i }));
    case "credentials":
      return c.credentials.slice(0, max).map((x, i) => ({ id: x.id, title: x.title, sub: x.issuer, tag: x.kind === "education" ? (x.year ?? "education") : x.verify ? "verify" : "certificate", index: i }));
    case "moments":
      return c.moments.slice(0, max).map((m, i) => ({ id: m.id, title: m.subject, sub: m.date.slice(0, 7), tag: m.grade ?? m.tag ?? "", index: i }));
  }
}

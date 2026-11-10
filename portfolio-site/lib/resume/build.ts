/**
 * The PDF résumé's document, built from the same data as the terminal and the Series view
 * (`lib/site/terminal-data.ts`). No phone number: it is not in the data and is never added.
 */
import type { Entry, Persona } from "@/lib/content/types";
import { DISPLAY_ROOT } from "@/lib/site/brand";
import { TIMELINE, terminalData } from "@/lib/site/terminal-data";

export type ResumeDoc = {
  name: string;
  title: string;
  location: string;
  status: string;
  /** Header links: email, GitHub, LinkedIn, site. */
  links: string[];
  accent: string;
  summary: string;
  skills: Array<{ group: string; items: string }>;
  experience: Array<{ role: string; company: string; period: string; headline: string; bullets: string[]; milestones: string[] }>;
  projects: Array<{ name: string; line: string }>;
  education: Array<{ title: string; detail: string; year: string; grade?: string }>;
  certifications: Array<{ issuer: string; line: string }>;
  /** `YYYY-MM-DD`, for the footer. */
  generated: string;
  site: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (d: string) => {
  const [y, m] = d.split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
};
const strip = (href: string) => href.replace(/^mailto:/, "").replace(/^https?:\/\/(www\.)?/, "");

export function buildResume(persona: Persona | undefined, entries: Entry[], now = new Date()): ResumeDoc {
  const data = terminalData(persona, entries, [], []);
  const r = data.resume;
  const links = ["mail", "github", "linkedin"].flatMap((l) => {
    const c = data.contact.find((x) => x.label === l && x.group !== "elsewhere");
    return c ? [strip(c.href)] : [];
  });
  links.push(DISPLAY_ROOT);

  const role = r.experience[0];
  const picks = r.pdfBullets ?? role.bullets.map((_, i) => i).slice(0, 6);
  const milestones = TIMELINE.filter((t) => t.branch === "main" && t.tag)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => `${monthYear(t.date)}: ${t.subject}`);

  const tl = (tag: string) => TIMELINE.find((t) => t.tag === tag);
  const school = (tag: string) => {
    const t = tl(tag);
    return t ? { title: t.subject, detail: "", year: t.date.slice(0, 4), grade: t.grade } : null;
  };
  const btech = tl("b.tech");
  const e0 = r.education[0];
  const education = [
    { title: e0.degree, detail: e0.school, year: e0.year, grade: btech?.body?.[0] ?? e0.note },
    school("class 12"),
    school("class 10"),
  ].filter((x): x is NonNullable<typeof x> => !!x);

  const names = new Set(r.personalProjects.map((p) => p.name.toLowerCase()));
  const projects = [
    ...r.personalProjects.map((p) => ({ name: p.name, line: [p.line, p.url?.replace(/^https?:\/\//, "")].filter(Boolean).join(" ") })),
    ...data.projects
      .filter((p) => !names.has(p.title.toLowerCase()))
      // A résumé must not carry a placeholder entry: a project needs a real summary and no sample link.
      .filter((p) => !!p.summary && p.summary.trim().toLowerCase() !== p.title.trim().toLowerCase() && !/(^|\.)(url|example|test)\.com/i.test(`${p.deployedUrl ?? ""} ${p.repoUrl ?? ""}`))
      .map((p) => ({ name: p.title, line: [p.summary, (p.deployedUrl ?? p.repoUrl)?.replace(/^https?:\/\//, "")].filter(Boolean).join(" ") })),
  ];

  return {
    name: r.name,
    title: r.title,
    location: r.location,
    status: data.status,
    links,
    accent: persona?.accent && /^#[0-9a-f]{6}$/i.test(persona.accent) ? persona.accent : "#4f7cff",
    summary: r.summary,
    skills: r.skills.map((s) => ({ group: s.group, items: s.items.join(", ") })),
    experience: [
      {
        role: role.role,
        company: role.company,
        period: role.period,
        headline: role.headline,
        bullets: picks.map((i) => role.bullets[i]).filter(Boolean),
        milestones,
      },
    ],
    projects,
    education,
    certifications: r.certifications.filter((c) => c.issuer !== "Other").map((c) => ({ issuer: c.issuer, line: c.line })),
    generated: now.toISOString().slice(0, 10),
    site: DISPLAY_ROOT,
  };
}

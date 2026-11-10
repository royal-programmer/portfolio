/**
 * What the Engineer terminal knows (17-persona-views.md §6). Built on the server from the content
 * layer; pure data, so the shell and the file system can be unit-tested without React.
 */
import type { BlogPost, Entry, Persona, PersonaView } from "@/lib/content/types";
import { HUB_COPY, personaIdentity } from "@/lib/site/brand";
import type { ArchDiagram } from "@/lib/site/terminal-arch";

export type TermProject = {
  slug: string;
  title: string;
  year?: string;
  role?: string;
  stack: string[];
  summary?: string;
  repoUrl?: string;
  deployedUrl?: string;
};

export type TermPost = {
  slug: string;
  title: string;
  date?: string;
  excerpt?: string;
  body: string;
};

export type TermLink = { label: string; href: string; /** "elsewhere": printed as a second group by `contact`, left out of the short lists. */ group?: "elsewhere" };

export type TermRole = {
  role: string;
  company: string;
  period: string;
  headline: string;
  bullets: string[];
};

export type TermResume = {
  name: string;
  title: string;
  location: string;
  summary: string;
  skills: Array<{ group: string; items: string[] }>;
  experience: TermRole[];
  personalProjects: Array<{ name: string; status: string; line: string; url?: string }>;
  certifications: Array<{ issuer: string; line: string; items?: string[] }>;
  education: Array<{ degree: string; school: string; year: string; note?: string }>;
  /** Indices into `experience[0].bullets` that make the one-page PDF (`/resume.pdf`); the terminal shows all of them. */
  pdfBullets?: number[];
};

/**
 * From Ratul_Roy_Resume.pdf (2026-11). Phone number deliberately left out — this is a public page.
 * Moves into the content layer (`experience`, `certification`, `resume` entry types,
 * 10-engineer-persona-blueprint.md) when the admin console lands.
 */
export const RESUME: TermResume = {
  pdfBullets: [0, 1, 2, 4, 5, 6],
  name: "Ratul Roy",
  title: "Software Engineer · Full Stack · APIs and Automation",
  location: "Bengaluru, India · willing to relocate",
  summary:
    "Software engineer with 2 years of experience in full stack development, APIs, automation and production support. Works the forward-deployed way: stakeholder discovery, then end-to-end delivery. Uses AI-assisted development with code validation, security controls and end-to-end testing.",
  skills: [
    { group: "development", items: ["C#", ".NET", "ASP.NET MVC", "React", "TypeScript", "Python", "FastAPI", "REST APIs"] },
    { group: "data & integration", items: ["SQL Server", "T-SQL", "PostgreSQL", "RabbitMQ", "Ocelot API Gateway", "SAP SuccessFactors", "NetSuite", "Oracle E-Business Suite", "Salesforce"] },
    { group: "delivery & operations", items: ["Git", "GitHub Actions", "CI/CD", "IIS", "Windows servers", "NSSM", "Task Scheduler", "SFTP", "SMTP", "Microsoft Entra ID", "Agile"] },
  ],
  experience: [
    {
      role: "Engineer",
      company: "Altimetrik (formerly SLK)",
      period: "Oct 2024 – present",
      headline: "Application modernization and production ownership",
      bullets: [
        "Modernized Shift Roster, a workforce scheduling app with shift allowances and transport booking, from ASP.NET MVC to React/TypeScript and .NET APIs in about two months; in production since September 2026.",
        "Supports 200+ active users and shift data for 1,500–2,000 employees; 56K+ employee-shift records in the first month.",
        "Redesigned the relational database; self-service configuration of shift timings, allowances, payroll freeze periods and report criteria; Azure AD group-based authorization in UI and API.",
        "Per-employee publish isolation and version-conflict detection; failed external syncs retry without republishing.",
        "Three synchronization services (HR, transport, scheduled reconciliation) with idempotency keys, acknowledgements, retries, alerts and logged reprocessing.",
        "Owns 11 Python automations across finance, project sync and background verification; RabbitMQ producer–consumer integrations.",
        "Cut VMS query time from 5–10 minutes to 2–3 by reworking complex joins; fixed recurring SQL refresh overloads.",
        "Project and Attendance Process APIs over Oracle EBS and NetSuite in Python/FastAPI, with async fetching, source-side filtering, pagination and pooled connections.",
        "Configurable reports with column selection, filters and preview-before-export; documented architecture and APIs for handover.",
        "CI/CD template generator for repository-specific GitHub Actions YAML; five pipelines for Shift Roster.",
        "Two organizational migrations (data, DNS, configuration, integrations); employee identifiers moved from integer to string with no downtime.",
        "Data Health Reconcile Dashboard (Python API + web frontend) for reconciliation across SAP, NetSuite and Oracle EBS.",
      ],
    },
  ],
  personalProjects: [{ name: "API Test Center", status: "in development", line: "An API testing tool; feature work and stabilization ongoing.", url: "https://apitestcenter.com" }],
  certifications: [
    {
      issuer: "OpenAI PartnerU / Sana",
      line: "7 credentials, valid through Jul–Aug 2027",
      items: ["API Deployment Practitioner", "Codex Solutions Practitioner", "ChatGPT Deployment Practitioner", "ChatGPT Solutions Practitioner", "OpenAI Technical Practitioner", "OpenAI Consultative Solutions Practitioner", "OpenAI Foundational Knowledge"],
    },
    { issuer: "Cisco Networking Academy", line: "Python Essentials 1 · Jul 2022" },
    { issuer: "IBM", line: "Python for Data Science badge · Jul 2022" },
    { issuer: "Other", line: "10+ credentials across AI, Python, DevOps, Agile and cybersecurity" },
  ],
  education: [{ degree: "B.Tech, Computer Science and Engineering", school: "ITER, Siksha O Anusandhan University", year: "2024", note: "CGPA 7.75/10" }],
};

export type TermCommit = {
  /** ISO date, used for ordering and the `Date:` line. */
  date: string;
  /** One line, imperative, like a commit subject. */
  subject: string;
  /** Optional body lines. */
  body?: string[];
  /** Branch for `--graph`: main (career), side (personal projects), learn (certs, education). */
  branch: "main" | "side" | "learn" | "life";
  tag?: string;
  /** A result worth highlighting on the entry itself, e.g. `85.66%`. */
  grade?: string;
};

/** The career as a git history, newest first when printed. From the résumé; dates to the month. */
export const TIMELINE: TermCommit[] = [
  { date: "2002-12", subject: "Born", branch: "life" },
  { date: "2004-04", subject: "Start school · Techno India Group Public School", branch: "learn" },
  { date: "2018-03", subject: "Secondary · Techno India Group Public School", branch: "learn", grade: "85.66%", tag: "class 10" },
  { date: "2020-03", subject: "Higher secondary, science · UP Public School", branch: "learn", grade: "79%", tag: "class 12" },
  { date: "2020-08", subject: "Start B.Tech CSE at ITER, SOA University", branch: "learn" },
  { date: "2022-07-01", subject: "Complete Python Essentials 1 (Cisco) and the IBM Python for Data Science badge", branch: "learn" },
  { date: "2022-09-01", subject: "Intern: web application developer (The Sparks Foundation) and cyber security (Coincent.ai)", branch: "learn" },
  { date: "2023-06-01", subject: "Intern: artificial intelligence (Edunet Foundation, IBM SkillsBuild)", branch: "learn" },
  { date: "2023-08-01", subject: "Intern: MERN stack developer (Webstack Academy)", branch: "learn" },
  { date: "2024-07-01", subject: "Graduate: B.Tech, Computer Science and Engineering, ITER (SOA University)", branch: "learn", tag: "b.tech", body: ["CGPA 7.75/10"] },
  { date: "2024-10-01", subject: "Join SLK as Engineer", branch: "main", tag: "slk", body: ["Full stack, APIs, automation, production support."] },
  { date: "2025-03-28", subject: "Move to SLK Digital", branch: "main" },
  { date: "2025-06-01", subject: "Take ownership of 11 Python automations and the RabbitMQ integrations", branch: "main", body: ["Finance, project sync, background verification; scheduled and API-triggered."] },
  { date: "2025-09-01", subject: "Ship the Project and Attendance Process APIs over Oracle EBS and NetSuite", branch: "main", body: ["Python/FastAPI, async fetching, source-side filtering, pooled connections."] },
  { date: "2025-12-01", subject: "Cut VMS query time from 5–10 minutes to 2–3", branch: "main" },
  { date: "2026-02-01", subject: "Build the CI/CD template generator; five pipelines for Shift Roster", branch: "main" },
  { date: "2026-04-01", subject: "Start API Test Center", branch: "side", tag: "apitestcenter", body: ["An API testing tool, in development: apitestcenter.com"] },
  { date: "2026-06-01", subject: "SLK becomes Altimetrik", branch: "main", tag: "altimetrik" },
  { date: "2026-07-01", subject: "Earn 7 OpenAI PartnerU credentials", branch: "learn", body: ["API Deployment, Codex Solutions, ChatGPT Deployment and Solutions, Technical, Consultative Solutions, Foundational."] },
  { date: "2026-09-01", subject: "Release Shift Roster: ASP.NET MVC → React/TypeScript + .NET APIs", branch: "main", tag: "v2.0", body: ["200+ active users, 1,500–2,000 employees, 56K+ shift records in month one.", "Redesigned the database; self-service configuration; Azure AD authorization."] },
  { date: "2026-11-01", subject: "Build this terminal", branch: "side", body: ["You are reading its output."] },
];

/** A stretch of the story, drawn as a bracket in `timeline`. `to: null` means still going. */
export type TermPeriod = {
  id: string;
  label: string;
  from: string;
  to: string | null;
  /** Shown in a third tone after the label, e.g. `cgpa 7.75/10`. */
  grade?: string;
  note?: string;
};

export const TIMELINE_PERIODS: TermPeriod[] = [
  { id: "school", label: "school · Techno India Group → UP Public School", from: "2004-04", to: "2020-03" },
  { id: "college", label: "B.Tech CSE · ITER, SOA University", from: "2020-08", to: "2024-07", grade: "cgpa 7.75/10" },
  { id: "work", label: "SLK → Altimetrik", from: "2024-10", to: null },
];

/** The systems from the résumé, as `arch` draws them. Labels stay short: they sit on the arrows. */
export const ARCH: ArchDiagram[] = [
  {
    id: "shift-roster",
    title: "Shift Roster",
    line: "React/TS UI → .NET APIs → SQL Server, with sync services to HR and transport",
    nodes: [
      { id: "ui", label: "React UI", kind: "ui" },
      { id: "ad", label: "Azure AD", kind: "ext" },
      { id: "api", label: ".NET APIs", kind: "api" },
      { id: "db", label: "SQL Server", kind: "db" },
      { id: "sync", label: "Sync svcs", kind: "job" },
      { id: "hr", label: "HR", kind: "ext" },
      { id: "tr", label: "Transport", kind: "ext" },
    ],
    edges: [
      ["ui", "api", "REST"],
      ["ad", "api", "groups"],
      ["api", "db", "SQL"],
      ["api", "sync", "queue"],
      ["sync", "hr", "sync"],
      ["sync", "tr", "sync"],
    ],
    notes: [
      "Azure AD groups decide what the UI shows and what the API allows.",
      "The three sync services (HR, transport, scheduled reconciliation) talk both ways: idempotency keys, acknowledgements, retries, alerts, logged reprocessing.",
      "Publishing is isolated per employee, with version-conflict detection; a failed external sync retries without republishing.",
    ],
  },
  {
    id: "automations",
    title: "Python automations",
    line: "scheduler or API → Python jobs → RabbitMQ → consumers → finance and background verification",
    nodes: [
      { id: "sch", label: "Cron", kind: "job" },
      { id: "api", label: "API", kind: "api" },
      { id: "py", label: "Py jobs", kind: "job" },
      { id: "mq", label: "RabbitMQ", kind: "queue" },
      { id: "con", label: "Consumers", kind: "job" },
      { id: "fin", label: "Finance", kind: "ext" },
      { id: "bgv", label: "BGV", kind: "ext" },
    ],
    edges: [
      ["sch", "py", "cron"],
      ["api", "py", "call"],
      ["py", "mq", "AMQP"],
      ["mq", "con", "get"],
      ["con", "fin", "post"],
      ["con", "bgv", "post"],
    ],
    notes: [
      "Eleven automations across finance, project sync and background verification; some run on a schedule, some are triggered by an API call.",
      "Producers and consumers are separate processes, so a slow consumer never blocks a job.",
    ],
  },
  {
    id: "process-apis",
    title: "Process APIs",
    line: "FastAPI over Oracle EBS and NetSuite, async and pooled",
    nodes: [
      { id: "cl", label: "Client apps", kind: "ui" },
      { id: "api", label: "FastAPI", kind: "api" },
      { id: "pool", label: "Conn pool", kind: "job" },
      { id: "ebs", label: "Oracle EBS", kind: "db" },
      { id: "ns", label: "NetSuite", kind: "ext" },
    ],
    edges: [
      ["cl", "api", "HTTPS"],
      ["api", "pool", "async"],
      ["pool", "ebs", "SQL"],
      ["pool", "ns", "REST"],
    ],
    notes: [
      "The Project and Attendance Process APIs: async fetching, source-side filtering, pagination.",
      "Connections are pooled, so a burst of callers does not become a burst of logins on the source systems.",
    ],
  },
  {
    id: "this-site",
    title: "This site",
    line: "Next.js on Vercel, Supabase, the GitHub cache and the preview image route",
    nodes: [
      { id: "br", label: "Browser", kind: "ui" },
      { id: "next", label: "Next.js · Vercel", kind: "api" },
      { id: "gh", label: "GitHub API", kind: "ext" },
      { id: "sb", label: "Supabase", kind: "db" },
      { id: "og", label: "/og image", kind: "job" },
    ],
    edges: [
      ["br", "next", "HTTPS"],
      ["br", "gh", "cache"],
      ["next", "sb", "RLS"],
      ["next", "og", "route"],
    ],
    notes: [
      "The browser asks GitHub directly and keeps the answer on the device for an hour; nothing about you is stored.",
      "Content comes from Supabase through a typed layer; /og draws the share previews from the terminal's own output.",
    ],
  },
];

/** Which `arch` diagram a project page points at (by project slug). */
export const PROJECT_ARCH: Record<string, string> = {
  "portfolio-platform": "this-site",
  portfolio: "this-site",
  "shift-roster": "shift-roster",
};

export type TerminalData = {
  arch: ArchDiagram[];
  projectArch: Record<string, string>;
  /** One-line identity and the longer `about` text. */
  who: string;
  about: string;
  stack: string[];
  uptime: string;
  contact: TermLink[];
  projects: TermProject[];
  posts: TermPost[];
  views: PersonaView[];
  resume: TermResume;
  timeline: TermCommit[];
  periods: TermPeriod[];
  /** The portrait's source photo and crop (fractions l,t,r,b); every `portrait` mode is generated from it. */
  portrait: { src: string; crop: [number, number, number, number] };
  /** `now`: what I am doing this month (data, so the admin console can own it). */
  now?: { month: string; lines: string[] };
  /** The availability line in the side pane. */
  status: string;
  /** Build id, when the deploy exposes one. */
  commit?: string;
};

const MAX_BODY = 6000;

export function terminalData(persona: Persona | undefined, entries: Entry[], posts: BlogPost[], views: PersonaView[]): TerminalData {
  const handle = personaIdentity("engineer").handle ?? "royal-programmer";
  return {
    who: "ratulroy · software engineer · bengaluru",
    about: persona?.body ?? "",
    stack: ["c#", ".net", "react", "typescript", "python", "fastapi", "sql server", "postgresql", "rabbitmq"],
    uptime: "2 years in production · 200+ users on the last rebuild · 11 automations kept alive",
    contact: [
      { label: "mail", href: `mailto:${HUB_COPY.email}` },
      { label: "github", href: `https://github.com/${handle}` },
      { label: "linkedin", href: `https://www.linkedin.com/in/${handle}` },
      { label: "holopin", href: "https://www.holopin.io/@royalprogrammer", group: "elsewhere" },
      { label: "stack overflow", href: "https://stackoverflow.com/users/22394141/royal-programmer", group: "elsewhere" },
      { label: "g.dev", href: "https://g.dev/royalprogrammer", group: "elsewhere" },
      { label: "google skills", href: "https://www.skills.google/public_profiles/369b718d-7bea-4e4b-9741-63c8d2250b64", group: "elsewhere" },
      { label: "geeksforgeeks", href: "https://www.geeksforgeeks.org/profile/royal_programmer", group: "elsewhere" },
    ],
    projects: entries
      .filter((e): e is Extract<Entry, { type: "project" }> => e.type === "project" && e.visibility === "public")
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        slug: e.slug,
        title: e.title,
        year: (e.occurredAt ?? e.createdAt)?.slice(0, 4),
        role: e.data.role,
        stack: e.data.techStack,
        summary: e.summary,
        repoUrl: e.data.repoUrl,
        deployedUrl: e.data.deployedUrl,
      })),
    posts: posts
      .filter((p) => p.visibility === "public")
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .map((p) => ({ slug: p.slug, title: p.title, date: p.publishedAt?.slice(0, 10), excerpt: p.excerpt, body: p.body.slice(0, MAX_BODY) })),
    views,
    resume: RESUME,
    arch: ARCH,
    projectArch: PROJECT_ARCH,
    timeline: TIMELINE,
    periods: TIMELINE_PERIODS,
    portrait: { src: "/portrait.jpg", crop: [0.27, 0.12, 0.75, 0.74] },
    now: {
      month: "2026-11",
      lines: [
        "Building this portfolio (Next.js 16, Supabase, free stack)",
        "Shift Roster v2 in production · supporting 200+ users",
        "Open to software engineering roles · Bengaluru or relocation",
      ],
    },
    status: "open to work · relocates",
    commit: process.env.NEXT_PUBLIC_COMMIT || undefined,
  };
}

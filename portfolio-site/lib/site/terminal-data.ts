/**
 * What the Engineer terminal knows (17-persona-views.md §6). Built on the server from the content
 * layer; pure data, so the shell and the file system can be unit-tested without React.
 */
import type { BlogPost, Entry, Persona, PersonaView } from "@/lib/content/types";
import { HUB_COPY, personaIdentity } from "@/lib/site/brand";

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

export type TermLink = { label: string; href: string };

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
};

/**
 * From Ratul_Roy_Resume.pdf (2026-11). Phone number deliberately left out — this is a public page.
 * Moves into the content layer (`experience`, `certification`, `resume` entry types,
 * 10-engineer-persona-blueprint.md) when the admin console lands.
 */
export const RESUME: TermResume = {
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

export type TerminalData = {
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
  /** Build id, when the deploy exposes one. */
  commit?: string;
};

const MAX_BODY = 6000;

export function terminalData(persona: Persona | undefined, entries: Entry[], posts: BlogPost[], views: PersonaView[]): TerminalData {
  const handle = personaIdentity("engineer").handle ?? "royal-programmer";
  return {
    who: "ratul · software engineer · bengaluru",
    about: persona?.body ?? "",
    stack: ["c#", ".net", "react", "typescript", "python", "fastapi", "sql server", "postgresql", "rabbitmq"],
    uptime: "2 years in production · 200+ users on the last rebuild · 11 automations kept alive",
    contact: [
      { label: "mail", href: `mailto:${HUB_COPY.email}` },
      { label: "github", href: `https://github.com/${handle}` },
      { label: "linkedin", href: `https://www.linkedin.com/in/${handle}` },
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
    commit: process.env.NEXT_PUBLIC_COMMIT || undefined,
  };
}

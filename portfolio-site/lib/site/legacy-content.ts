/**
 * FROZEN COPY of the records that lived in code before round 24 (résumé, hiring facts, timeline, diagrams,
 * clock bands, profile links, project story and media, the book-a-call link). It exists for two jobs only:
 * the site's fallback while `CONTENT_SOURCE=code`, and the importer's input (`scripts/import-content.mjs`),
 * which writes each of these into the database once. Do not edit it to change the site: edit the records in
 * the admin. When Ratul confirms the import, `CONTENT_SOURCE` flips to `db` and this file is deleted.
 */
import type { ProjectMedia, ProjectStory } from "@/lib/content/types";
import { RESUME_FILES } from "@/lib/resume/files";
import type { TermProfile } from "@/lib/site/profiles";
import type { ArchDiagram } from "@/lib/site/terminal-arch";
import type { TermClock, TermCommit, TermHiring, TermPeriod, TermResume } from "@/lib/site/terminal-data";

const RESUME: TermResume = {
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
        "Maintains 11 Python automations across finance, project sync and background verification; RabbitMQ producer–consumer integrations.",
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

const HIRING: TermHiring = {
  roles: ["Software Engineer", "Full-stack Engineer", "Backend Engineer (.NET / Python)"],
  level: "2 yrs · mid-level · works on features end to end",
  stack: {
    core: ["C#", ".NET", "React", "TypeScript", "Python", "FastAPI", "SQL Server", "PostgreSQL"],
    plus: ["RabbitMQ", "GitHub Actions", "Azure AD", "Oracle EBS / NetSuite integrations"],
  },
  location: { base: "Bengaluru", modes: ["on-site", "hybrid", "remote"], relocate: true },
  availability: "employed · Altimetrik · notice period applies · ask",
  compensation: "band · ask",
  visa: "Indian citizen · no sponsorship needed in India",
  proof: ["200+ users on the Shift Roster rebuild", "11 Python automations in production", "VMS query 5–10 min → 2–3 min"],
  alsoOn: ["Naukri"],
  links: { resume: RESUME_FILES.submitted.href, site: "https://code.ratulroy.me" },
};

const TIMELINE: TermCommit[] = [
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
  { date: "2025-06-01", subject: "Take over 11 Python automations and the RabbitMQ integrations", branch: "main", body: ["Finance, project sync, background verification; scheduled and API-triggered."] },
  { date: "2025-09-01", subject: "Ship the Project and Attendance Process APIs over Oracle EBS and NetSuite", branch: "main", body: ["Python/FastAPI, async fetching, source-side filtering, pooled connections."] },
  { date: "2025-12-01", subject: "Cut VMS query time from 5–10 minutes to 2–3", branch: "main" },
  { date: "2026-02-01", subject: "Build the CI/CD template generator; five pipelines for Shift Roster", branch: "main" },
  { date: "2026-04-01", subject: "Start API Test Center", branch: "side", tag: "apitestcenter", body: ["An API testing tool, in development: apitestcenter.com"] },
  { date: "2026-06-01", subject: "SLK becomes Altimetrik", branch: "main", tag: "altimetrik" },
  { date: "2026-07-01", subject: "Earn 7 OpenAI PartnerU credentials", branch: "learn", body: ["API Deployment, Codex Solutions, ChatGPT Deployment and Solutions, Technical, Consultative Solutions, Foundational."] },
  { date: "2026-09-01", subject: "Release Shift Roster: ASP.NET MVC → React/TypeScript + .NET APIs", branch: "main", tag: "v2.0", body: ["200+ active users, 1,500–2,000 employees, 56K+ shift records in month one.", "Redesigned the database; self-service configuration; Azure AD authorization."] },
  { date: "2026-11-01", subject: "Build this terminal", branch: "side", body: ["You are reading its output."] },
];

const TIMELINE_PERIODS: TermPeriod[] = [
  { id: "school", label: "school · Techno India Group → UP Public School", from: "2004-04", to: "2020-03" },
  { id: "college", label: "B.Tech CSE · ITER, SOA University", from: "2020-08", to: "2024-07", grade: "cgpa 7.75/10" },
  { id: "work", label: "SLK → Altimetrik", from: "2024-10", to: null },
];

const ARCH: ArchDiagram[] = [
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

const PROJECT_ARCH: Record<string, string> = {
  "portfolio-platform": "this-site",
  portfolio: "this-site",
  "shift-roster": "shift-roster",
};

const CLOCK: TermClock = {
  bands: [
    { id: "night", from: 0, to: 5, theme: "matrix", greet: "late night?", hint: "the short version is portfolio · hire if you are recruiting" },
    { id: "dawn", from: 5, to: 9, theme: "solarized", greet: "early.", hint: "coffee first · then timeline" },
    { id: "day", from: 9, to: 17, theme: "accent", greet: "hello.", hint: "new here? type portfolio · hiring? type hire" },
    { id: "evening", from: 17, to: 21, theme: "gruvbox", greet: "good evening.", hint: "ten minutes? portfolio · two? hire" },
    { id: "late", from: 21, to: 24, theme: "dracula", greet: "still up.", hint: "portrait is the fun one · stats is the proud one" },
  ],
  weekend: { greet: "weekend mode.", hint: "no rush · timeline reads well" },
  myTz: "Asia/Kolkata",
};

const PROFILES: TermProfile[] = [
  { id: "github", label: "github", handle: "royal-programmer", href: "https://github.com/royal-programmer", group: "code", live: "github" },
  { id: "stackoverflow", label: "stack overflow", handle: "royal-programmer", href: "https://stackoverflow.com/users/22394141/royal-programmer", group: "code", live: "stackoverflow" },
  { id: "holopin", label: "holopin", handle: "royalprogrammer", href: "https://www.holopin.io/@royalprogrammer", group: "code", live: "holopin" },
  { id: "leetcode", label: "leetcode", handle: "", group: "code", live: "leetcode", optional: true },
  { id: "hackerrank", label: "hackerrank", handle: "royal_programmer", href: "https://www.hackerrank.com/profile/royal_programmer", group: "learn", live: "hackerrank" },
  { id: "geeksforgeeks", label: "geeksforgeeks", handle: "royal_programmer", href: "https://www.geeksforgeeks.org/profile/royal_programmer", group: "learn" },
  { id: "gdev", label: "google developer", handle: "royalprogrammer", href: "https://g.dev/royalprogrammer", group: "learn" },
  { id: "skills", label: "google skills", handle: "public profile", href: "https://www.skills.google/public_profiles/369b718d-7bea-4e4b-9741-63c8d2250b64", group: "learn" },
  { id: "linkedin", label: "linkedin", handle: "royal-programmer", href: "https://www.linkedin.com/in/royal-programmer", group: "work", note: "927 followers · 500+ connections · as of 2026-11" },
];

const PROJECT_STORY: Record<string, ProjectStory> = {
  "api-test-center": {
    description: "A free app to send, check and load-test APIs, on your own computer.",
    audience: "For developers and testers who check an API before it ships.",
    problem: "Checking an API usually means one tool for a single request and another for load. This one does both from the same request, works from the command line in CI, and lets an AI agent run the tests too.",
    beats: [
      { text: "Send a request and see the checks on status, JSON, body, headers and time pass or fail.", clip: "send", clipMs: 7000 },
      { text: "Run a load test, through k6, from that same request.", clip: "load-test", clipMs: 8000 },
      { text: "Every run is saved on your computer, so you can keep it and compare it later.", clip: "history", clipMs: 7000 },
    ],
    status: "live-building",
  },
};

const PROJECT_MEDIA: Record<string, ProjectMedia> = {
  "api-test-center": {
    poster: { src: "/projects/api-test-center/poster.webp", w: 1280, h: 800, alt: "API Test Center: a GET request with a load test running" },
    screens: [
      { id: "builder", label: "Report builder", src: "/projects/api-test-center/screens/builder.webp", w: 1280, h: 800 },
      { id: "chain", label: "Run first: reuse a sign-in token", src: "/projects/api-test-center/screens/chain.webp", w: 1280, h: 800 },
      { id: "charts", label: "Charts", src: "/projects/api-test-center/screens/charts.webp", w: 1280, h: 800 },
      { id: "report", label: "Load report", src: "/projects/api-test-center/screens/report.webp", w: 1280, h: 800 },
      { id: "send", label: "Send a request", src: "/projects/api-test-center/screens/send.webp", w: 1280, h: 800 },
      { id: "help", label: "Help in plain words", src: "/projects/api-test-center/screens/help.webp", w: 1280, h: 800 },
    ],
    clips: [
      { id: "send", label: "Send a request", poster: "/projects/api-test-center/clips/send.jpg", src: "/projects/api-test-center/clips/send.webm" },
      { id: "load-test", label: "Run a load test", poster: "/projects/api-test-center/clips/load-test.jpg", src: "/projects/api-test-center/clips/load-test.webm" },
      { id: "sign-in", label: "Sign in first, then reuse the token", poster: "/projects/api-test-center/clips/sign-in.jpg", src: "/projects/api-test-center/clips/sign-in.webm" },
      { id: "collection", label: "Run a collection", poster: "/projects/api-test-center/clips/collection.jpg", src: "/projects/api-test-center/clips/collection.webm" },
      { id: "history", label: "History", poster: "/projects/api-test-center/clips/history.jpg", src: "/projects/api-test-center/clips/history.webm" },
      { id: "upload", label: "Upload a file", poster: "/projects/api-test-center/clips/upload.jpg", src: "/projects/api-test-center/clips/upload.webm" },
      { id: "websocket", label: "WebSocket", poster: "/projects/api-test-center/clips/websocket.jpg", src: "/projects/api-test-center/clips/websocket.webm" },
    ],
  },
};

/** The book-a-call link: empty until Ratul gives one (no button renders while `href` is empty). */
const BOOK_CALL = { label: "Book a call", href: "" };

export const LEGACY = { RESUME, HIRING, TIMELINE, TIMELINE_PERIODS, ARCH, PROJECT_ARCH, CLOCK, PROFILES, PROJECT_STORY, PROJECT_MEDIA, BOOK_CALL } as const;

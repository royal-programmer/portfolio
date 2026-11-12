/**
 * What the Engineer terminal knows (17-persona-views.md §6). Built on the server from the content
 * layer; pure data, so the shell and the file system can be unit-tested without React.
 */
import type { BlogPost, Entry, Persona, PersonaView, ProjectMedia, ProjectStory, SkillLinks } from "@/lib/content/types";
import { HUB_COPY, personaIdentity } from "@/lib/site/brand";
import { RESUME_FILES, type ResumeFiles } from "@/lib/resume/files";
import type { ArchDiagram } from "@/lib/site/terminal-arch";
import type { Settings } from "@/lib/settings/schema";
import type { ThemePalette } from "@/lib/site/terminal-themes";
import { PROFILES, type TermProfile } from "@/lib/site/profiles";
import { fromDb } from "@/lib/content/source";
import { archFromRecords, contactFromRecords, periodsFromRecords, profilesFromRecords, resumeFromRecords, timelineFromRecords, type Records } from "@/lib/content/records-assemble";
import { LEGACY } from "@/lib/site/legacy-content";

export type TermProject = {
  slug: string;
  title: string;
  year?: string;
  role?: string;
  stack: string[];
  summary?: string;
  repoUrl?: string;
  deployedUrl?: string;
  /** The Netflix trailer's story and imagery, from the project record (`storyOf` is the one reader). */
  story?: ProjectStory;
  media?: ProjectMedia;
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
  /** The record's slug, so a skill's `links.experience` can name it. Absent in the frozen copy. */
  id?: string;
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
  /** `links[skill]` says which projects, experience and certifications (by record slug) used it: "what I did with C#". */
  skills: Array<{ group: string; items: string[]; links?: Record<string, SkillLinks> }>;
  experience: TermRole[];
  personalProjects: Array<{ name: string; status: string; line: string; url?: string }>;
  certifications: Array<{ id?: string; issuer: string; line: string; items?: string[]; /** A public page that verifies the credential, when one exists (never guessed). */ verify?: string }>;
  education: Array<{ degree: string; school: string; year: string; note?: string }>;
  /** Indices into `experience[0].bullets` that make the one-page PDF (`/resume.pdf`); the terminal shows all of them. */
  pdfBullets?: number[];
};

export const EMPTY_RESUME: TermResume = { name: "", title: "", location: "", summary: "", skills: [], experience: [], personalProjects: [], certifications: [], education: [] };
/**
 * The active fallback: the frozen copy (`legacy-content.ts`, from Ratul_Roy_Resume.pdf, 2026-11; no phone number,
 * this is a public page) while `CONTENT_SOURCE=code`, an honest empty résumé under `db`, where the lists come
 * from `experience`, `education`, `certification` and `skill_group` records and the header from `engineer.resume`.
 */
export const RESUME: TermResume = fromDb ? EMPTY_RESUME : LEGACY.RESUME;

/** `hire --brief`: the forwardable fit sheet. `availability` says he is employed (Altimetrik); `compensation` is a deliberate "· ask" placeholder until Ratul fills it in. */
export type TermHiring = {
  roles: string[];
  level: string;
  stack: { core: string[]; plus: string[] };
  location: { base: string; modes: string[]; relocate: boolean };
  availability: string;
  compensation: string;
  visa: string;
  proof: string[];
  /** Other places a recruiter can find me that have no public link (`hire --brief` prints a dim note per name). */
  alsoOn?: string[];
  /** linkedin and github come from `contact`, so they cannot drift from it. */
  links: { resume: string; site: string };
};

export const EMPTY_HIRING: TermHiring = { roles: [], level: "", stack: { core: [], plus: [] }, location: { base: "", modes: [], relocate: false }, availability: "", compensation: "", visa: "", proof: [], links: { resume: RESUME_FILES.submitted.href, site: "" } };
/** The active fallback; under `db` the `engineer.hiring` setting carries the facts. */
export const HIRING: TermHiring = fromDb ? EMPTY_HIRING : LEGACY.HIRING;

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

/** The career as a git history, newest first when printed: `timeline_event` and `milestone` records under `db`. */
export const TIMELINE: TermCommit[] = fromDb ? [] : LEGACY.TIMELINE;

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

export const TIMELINE_PERIODS: TermPeriod[] = fromDb ? [] : LEGACY.TIMELINE_PERIODS;

/** The systems from the résumé, as `arch` draws them: `diagram` records under `db`. */
export const ARCH: ArchDiagram[] = fromDb ? [] : LEGACY.ARCH;
/** Which `arch` diagram a project page points at (by project slug): the diagrams' own `projects` lists under `db`. */
export const PROJECT_ARCH: Record<string, string> = fromDb ? {} : LEGACY.PROJECT_ARCH;

/** The few pieces of data that read differently in another language (`lang bn`, `lang hi`); everything else in the data stays English. Numbers stay Western digits. */
export type TermI18n = { who: string; role: string; city: string; uptime: string; summary: string; status: string; now: string[]; proof: string[] };

export const I18N: Record<"bn" | "hi", TermI18n> = {
  bn: {
    who: "ratulroy · সফটওয়্যার ইঞ্জিনিয়ার · বেঙ্গালুরু",
    role: "সফটওয়্যার ইঞ্জিনিয়ার",
    city: "বেঙ্গালুরু",
    uptime: "production-এ 2 বছর · শেষ rebuild-এ 200+ ব্যবহারকারী · 11টি automation চালু রাখা",
    summary:
      "Full stack development, API, automation আর production support-এ 2 বছরের অভিজ্ঞতার সফটওয়্যার ইঞ্জিনিয়ার। কাজ করে forward-deployed ধাঁচে: আগে stakeholder-দের সঙ্গে কথা বলে চাহিদা বোঝা, তারপর শুরু থেকে শেষ পর্যন্ত ডেলিভারি। AI-সহায়ক development করে, সঙ্গে code validation, security control আর end-to-end testing।",
    status: "কাজের খোঁজে · relocate করতে রাজি",
    now: [
      "এই portfolio বানাচ্ছি (Next.js 16, Supabase, free stack)",
      "Shift Roster v2 production-এ · 200+ ব্যবহারকারীর সাপোর্টে",
      "software engineering-এর কাজের জন্য খোলা · বেঙ্গালুরু বা relocation",
    ],
    proof: [
      "200+ সক্রিয় ব্যবহারকারী আর 1,500–2,000 কর্মীর shift data সামলায়; প্রথম মাসেই 56K+ employee-shift record।",
      "finance, project sync আর background verification জুড়ে 11টি Python automation-এর দায়িত্বে; RabbitMQ producer–consumer integration।",
      "Oracle EBS আর NetSuite-এর ওপর Python/FastAPI-তে Project ও Attendance Process API, সঙ্গে async fetching, source-side filtering, pagination আর pooled connection।",
    ],
  },
  hi: {
    who: "ratulroy · सॉफ़्टवेयर इंजीनियर · बेंगलुरु",
    role: "सॉफ़्टवेयर इंजीनियर",
    city: "बेंगलुरु",
    uptime: "production में 2 साल · पिछले rebuild पर 200+ उपयोगकर्ता · 11 automations चालू रखे",
    summary:
      "Full stack development, API, automation और production support में 2 साल के अनुभव वाला सॉफ़्टवेयर इंजीनियर। forward-deployed तरीके से काम करता है: पहले stakeholders से ज़रूरतें समझना, फिर शुरू से अंत तक डिलीवरी। AI-सहायता से development करता है, साथ में code validation, security controls और end-to-end testing।",
    status: "काम की तलाश में · relocate को तैयार",
    now: [
      "यह portfolio बना रहा हूँ (Next.js 16, Supabase, free stack)",
      "Shift Roster v2 production में · 200+ उपयोगकर्ताओं का सपोर्ट",
      "software engineering roles के लिए उपलब्ध · बेंगलुरु या relocation",
    ],
    proof: [
      "200+ सक्रिय उपयोगकर्ता और 1,500–2,000 कर्मचारियों का shift data संभालता है; पहले महीने में 56K+ employee-shift records।",
      "finance, project sync और background verification की 11 Python automations का ज़िम्मा; RabbitMQ producer–consumer integrations।",
      "Oracle EBS और NetSuite के ऊपर Python/FastAPI में Project और Attendance Process APIs, साथ में async fetching, source-side filtering, pagination और pooled connections।",
    ],
  },
};

/** One part of the visitor's day: local hours `from` (inclusive) to `to` (exclusive). `theme` applies only while they have picked none. */
export type TermClockBand = { id: string; from: number; to: number; theme: string; greet: string; hint: string };
export type TermClock = { bands: TermClockBand[]; weekend: { greet: string; hint: string }; myTz: string };

export const EMPTY_CLOCK: TermClock = { bands: [], weekend: { greet: "", hint: "" }, myTz: "UTC" };
/** The active fallback: the frozen copy while `CONTENT_SOURCE=code`, an honest empty clock under `db`. */
export const CLOCK: TermClock = fromDb ? EMPTY_CLOCK : LEGACY.CLOCK;

export type TerminalData = {
  arch: ArchDiagram[];
  projectArch: Record<string, string>;
  /** One-line identity and the longer `about` text. */
  who: string;
  about: string;
  stack: string[];
  uptime: string;
  contact: TermLink[];
  /** Every place I am, with the live source each can use (`profiles`). */
  profiles: TermProfile[];
  projects: TermProject[];
  posts: TermPost[];
  views: PersonaView[];
  resume: TermResume;
  hiring: TermHiring;
  /** The submitted PDF (the default) and the generated one (`resume --build`). */
  resumeFiles: ResumeFiles;
  timeline: TermCommit[];
  periods: TermPeriod[];
  /** The portrait's source photo and crop (fractions l,t,r,b); every `portrait` mode is generated from it. */
  portrait: { src: string; crop: [number, number, number, number] };
  /** `now`: what I am doing this month (data, so the admin console can own it). */
  now?: { month: string; lines: string[] };
  /** The visitor's-clock bands: theme, greeting and hint by local hour. */
  clock: TermClock;
  /** The availability line in the side pane. */
  status: string;
  /** Build id, when the deploy exposes one. */
  commit?: string;
  /** The translated pieces, by language (`lang bn`, `lang hi`). */
  i18n?: Record<"bn" | "hi", TermI18n>;
  /** The terminal's palettes when the admin console has edited them; absent means the code's own. */
  themes?: ThemePalette[];
  /** The book-a-call link (`netflix.bookCall`); absent when none is set. */
  book?: { label: string; href: string };
};

const MAX_BODY = 6000;

/** The terminal's own values (`engineer.terminal` in the admin console). The defaults are what the code shipped with. */
export const DEFAULT_TERMINAL: Settings["engineer.terminal"] = (() => {
  const handle = personaIdentity("engineer").handle ?? "royal-programmer";
  return {
    who: "ratulroy · software engineer · bengaluru",
    stack: ["c#", ".net", "react", "typescript", "python", "fastapi", "sql server", "postgresql", "rabbitmq"],
    uptime: "2 years in production · 200+ users on the last rebuild · 11 automations kept alive",
    status: "open to work · relocates",
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
    portrait: { src: "/portrait.jpg", crop: [0.27, 0.12, 0.75, 0.74] },
    now: {
      month: "2026-11",
      lines: [
        "Building this portfolio (Next.js 16, Supabase, free stack)",
        "Shift Roster v2 in production · supporting 200+ users",
        "Open to software engineering roles · Bengaluru or relocation",
      ],
    },
    clock: CLOCK,
    hiring: HIRING,
    resumeFiles: RESUME_FILES,
  };
})();

/** The admin-console values `terminalData` can take instead of the code's own (each key falls back on its own). */
export type TerminalConfig = Partial<{
  identity: Settings["identity"];
  terminal: Settings["engineer.terminal"];
  resume: Settings["engineer.resume"];
  i18n: Settings["engineer.i18n"];
  timeline: Settings["engineer.timeline"];
  arch: Settings["engineer.arch"];
  themes: Settings["engineer.themes"];
  hiring: Settings["engineer.hiring"];
  clock: Settings["engineer.clock"];
  netflix: Settings["netflix"];
  /**
   * The engineer records read from the database (`CONTENT_SOURCE=db`). When present they build the résumé lists,
   * timeline, diagrams, profiles and contact instead of the frozen copy; `hiring` and `clock` then come from
   * their own settings. Absent (code mode), nothing about them changes.
   */
  records: Records;
}>;

export function terminalData(persona: Persona | undefined, entries: Entry[], posts: BlogPost[], views: PersonaView[], cfg: TerminalConfig = {}): TerminalData {
  const t = cfg.terminal ?? DEFAULT_TERMINAL;
  const rec = cfg.records;
  const arch = rec ? archFromRecords(rec) : undefined;
  const mailHref = `mailto:${cfg.identity?.email ?? HUB_COPY.email}`;
  return {
    who: t.who,
    about: persona?.body ?? "",
    stack: t.stack,
    uptime: t.uptime,
    // The `mail` row follows the identity's email, so it cannot drift from the hub's. Under records the rest are the profile links.
    contact: rec ? [{ label: "mail", href: mailHref }, ...contactFromRecords(rec)] : t.contact.map((l) => (cfg.identity && l.label === "mail" ? { ...l, href: mailHref } : l)),
    profiles: rec ? profilesFromRecords(rec) : PROFILES,
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
        ...(e.data.story ? { story: e.data.story } : {}),
        ...(e.data.media ? { media: e.data.media } : {}),
      })),
    posts: posts
      .filter((p) => p.visibility === "public")
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .map((p) => ({ slug: p.slug, title: p.title, date: p.publishedAt?.slice(0, 10), excerpt: p.excerpt, body: p.body.slice(0, MAX_BODY) })),
    views,
    resume: rec ? resumeFromRecords(rec, cfg.resume) : cfg.resume ? { ...EMPTY_RESUME, ...cfg.resume } : RESUME,
    hiring: rec ? (cfg.hiring ?? EMPTY_HIRING) : t.hiring,
    resumeFiles: t.resumeFiles,
    arch: arch ? arch.diagrams : cfg.arch?.diagrams ?? ARCH,
    projectArch: arch ? arch.projectArch : cfg.arch?.projectArch ?? PROJECT_ARCH,
    timeline: rec ? timelineFromRecords(rec) : cfg.timeline?.entries ?? TIMELINE,
    periods: rec ? periodsFromRecords(rec) : cfg.timeline?.periods ?? TIMELINE_PERIODS,
    portrait: t.portrait,
    now: t.now,
    clock: rec ? (cfg.clock ?? EMPTY_CLOCK) : t.clock,
    status: t.status,
    commit: process.env.NEXT_PUBLIC_COMMIT || undefined,
    i18n: cfg.i18n ?? I18N,
    themes: cfg.themes?.palettes,
    book: cfg.netflix ? cfg.netflix.bookCall : fromDb ? undefined : LEGACY.BOOK_CALL,
  };
}

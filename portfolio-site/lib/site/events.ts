/**
 * The visitor-event contract (17-persona-views.md section 29): which kinds exist, and the validator the
 * route and the tests share. Pure. Nothing personal is ever accepted: a kind from the allowlist, a short
 * slug or label, a coarse device class and a host name. Anything else is dropped, never stored.
 */
import { z } from "zod";

export const EVENT_KINDS = [
  "view_open",
  "profile_pick",
  "title_open",
  "play_start",
  "play_complete",
  "skill_open",
  "resume_download",
  "hire_open",
  "fit_open",
  "fit_check",
  "mail_click",
  "book_click",
  "visit_click",
  "code_click",
  "share_link_make",
  "terminal_cmd",
  "contact_submit",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const isEventKind = (k: unknown): k is EventKind => typeof k === "string" && (EVENT_KINDS as readonly string[]).includes(k);

export const EVENT_VIEWS = ["terminal", "netflix", "stage", "hub"] as const;
export type EventView = (typeof EVENT_VIEWS)[number];

export const MAX_BATCH = 20;
export const MAX_BODY_BYTES = 4096;

/** A slug or label: printable, no control characters, trimmed, at most 80 characters. */
export const cleanRef = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
  return s || null;
};

const token = (max: number) => z.string().regex(/^[a-z0-9_:\-.]+$/i).max(max);

const eventSchema = z.object({ kind: z.string().refine(isEventKind), ref: z.string().max(200).optional() });

export const batchSchema = z.object({
  persona: token(24),
  view: z.enum(EVENT_VIEWS),
  profile: token(24).optional(),
  session: token(24).optional(),
  lang: token(8).optional(),
  device: z.enum(["phone", "desktop"]).optional(),
  referrer_host: z.string().regex(/^[a-z0-9.\-]+$/i).max(80).optional(),
  events: z.array(z.unknown()).min(1).max(MAX_BATCH),
});

export type EventRow = {
  persona: string;
  view: EventView;
  kind: EventKind;
  ref: string | null;
  profile: string | null;
  session: string | null;
  lang: string | null;
  device: "phone" | "desktop" | null;
  referrer_host: string | null;
};

/**
 * Turn an untrusted body into rows to insert. A malformed envelope gives []; a malformed event inside a
 * good envelope is skipped on its own. `terminal_cmd` keeps the first word only: never arguments.
 */
export function validateBatch(body: unknown): EventRow[] {
  const env = batchSchema.safeParse(body);
  if (!env.success) return [];
  const b = env.data;
  const rows: EventRow[] = [];
  for (const raw of b.events) {
    const e = eventSchema.safeParse(raw);
    if (!e.success) continue;
    let ref = cleanRef(e.data.ref);
    if (ref && e.data.kind === "terminal_cmd") ref = ref.split(/\s+/)[0].toLowerCase().slice(0, 40);
    rows.push({
      persona: b.persona,
      view: b.view,
      kind: e.data.kind as EventKind,
      ref,
      profile: b.profile ?? null,
      session: b.session ?? null,
      lang: b.lang ?? null,
      device: b.device ?? null,
      referrer_host: b.referrer_host ?? null,
    });
  }
  return rows;
}

/** In-memory fixed-window limiter: `max` hits per `windowMs` per key. The key is never persisted. */
export function makeLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { n: number; t: number }>();
  return (key: string): boolean => {
    const t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (t - v.t > windowMs) hits.delete(k);
    const h = hits.get(key);
    if (!h || t - h.t > windowMs) {
      hits.set(key, { n: 1, t });
      return true;
    }
    h.n += 1;
    return h.n <= max;
  };
}

/**
 * Which kind a clicked link counts as, from its address alone (so one delegated listener covers every
 * button): mail, the book-a-call link, the résumé PDF, code (GitHub) or any other outbound visit. Same-page
 * and unknown links are not counted. The ref is a host and a short path, never a query string.
 */
export function classifyLink(href: string, bookHref = ""): { kind: EventKind; ref: string } | null {
  if (!href) return null;
  if (/^mailto:/i.test(href)) return { kind: "mail_click", ref: "mail" };
  if (/\.pdf($|[?#])/i.test(href)) return { kind: "resume_download", ref: "resume" };
  let u: URL;
  try {
    u = new URL(href, "https://self.invalid");
  } catch {
    return null;
  }
  if (u.origin === "https://self.invalid") return null;
  const ref = cleanRef(u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "")) ?? u.hostname;
  if (bookHref && href === bookHref) return { kind: "book_click", ref };
  if (u.hostname === "github.com") return { kind: "code_click", ref };
  if (u.protocol === "https:" || u.protocol === "http:") return { kind: "visit_click", ref };
  return null;
}

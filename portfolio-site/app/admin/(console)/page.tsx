import { existsSync } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import { adminClient } from "@/lib/db/client";
import { CONTENT_SOURCE } from "@/lib/content/source";
import { parseRecordData } from "@/lib/content/record-schemas";
import { isRecordType, type RecordType } from "@/lib/content/types";
import { getServerClient, getUser } from "@/lib/db/server";
import { previewActive } from "@/lib/settings/preview";
import { getAllSettings } from "@/lib/settings/read";
import { emptyRequired } from "../_lib/record-forms";
import { computeHealth, type HealthInput } from "../_lib/health";
import { accessConfig } from "@/lib/admin/access";
import { ADMIN_HOST_LABEL } from "@/lib/site/admin-host";
import { parseHost } from "@/lib/site/hosts";
import { HomeView } from "../_collections/home-view";

const SECTION: Record<string, string> = {
  project: "projects",
  experience: "experience",
  certification: "certifications",
  education: "education",
  timeline_event: "events",
  milestone: "milestones",
  diagram: "architecture",
  profile_link: "links",
  skill_group: "skills",
};
type Entry = { id: string; type: string; slug: string; title: string; summary: string | null; visibility: string; updated_at: string; data: Record<string, unknown> | null };

async function ogResolves(): Promise<boolean | null> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
    const res = await fetch(`${proto}://${host.replace(/^admin\./, "")}/og`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return null;
  }
}

/** Where this request reached the admin, whether Access is on, and the sign-in redirect URL to allow-list. */
async function securityInput(): Promise<NonNullable<HealthInput["security"]>> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const parsed = parseHost(host);
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  return {
    // An unrouted host (localhost, a *.vercel.app preview) serves /admin by path and is fine; a routed non-admin host is not.
    adminHost: parsed.kind === "admin" || parsed.kind === "unrouted",
    hostName: host.replace(/:\d+$/, "") || "unknown host",
    accessOn: accessConfig() !== null,
    callbackUrl: root ? (ADMIN_HOST_LABEL ? `https://${ADMIN_HOST_LABEL}.${root}/auth/callback` : `https://${root}/admin/auth/callback`) : null,
  };
}

/** The Insights screen, if the analytics round has added it (checked on disk; nothing renders when it is absent). */
function insightsHref(): string | null {
  const base = path.join(process.cwd(), "app", "admin", "(console)");
  if (existsSync(path.join(base, "insights", "page.tsx"))) return "/admin/insights";
  if (existsSync(path.join(base, "site", "insights", "page.tsx"))) return "/admin/site/insights";
  return null;
}

/** /admin: the status strip, the site health checklist, quick actions, recent changes and (when it exists) Insights. */
/** The server clock, read outside the component so a render stays pure. */
const clock = () => Date.now();

export default async function AdminHome() {
  const now = clock();
  const user = await getUser().catch(() => null);
  const preview = await previewActive();
  const { items } = await getAllSettings();

  let entries: Entry[] = [];
  try {
    const sb = await getServerClient();
    const { data } = await sb.from("entries").select("id, type, slug, title, summary, visibility, updated_at, data").eq("persona_slug", "engineer").limit(1000);
    entries = (data ?? []) as Entry[];
  } catch {
    /* no database: the checklist then says so instead of passing */
  }
  const loaded = entries.length > 0;

  let history: { id: number; key: string; action: string; at: string; before: unknown }[] = [];
  try {
    const { data } = await adminClient().from("settings_history").select("id, key, action, before, at").order("at", { ascending: false }).limit(20);
    history = (data ?? []) as typeof history;
  } catch {
    /* table absent */
  }
  const lastPublish = history.find((h) => h.action === "publish")?.at ?? null;

  const hiring = items["engineer.hiring"].live as Record<string, unknown> | null;
  const terminal = items["engineer.terminal"].live as { resumeFiles?: { submitted?: { updatedAt?: string } } } | null;
  const netflix = items.netflix.live as { bookCall?: { href?: string } } | null;
  const section = (e: Entry) => `/admin/engineer/${SECTION[e.type] ?? "projects"}?id=${e.id}`;
  const input: HealthInput = {
    bookCallHref: netflix ? (netflix.bookCall?.href ?? "") : null,
    certs: entries.filter((e) => e.type === "certification").map((e) => ({ slug: e.slug, title: e.title, verify: String((e.data as { verify?: string } | null)?.verify ?? "") })),
    projects: entries
      .filter((e) => e.type === "project")
      .map((e) => {
        const d = (e.data ?? {}) as { deployedUrl?: string; repoUrl?: string; media?: { poster?: { src?: string } } };
        return { slug: e.slug, title: e.title, summary: e.summary ?? "", hasPoster: Boolean(d.media?.poster?.src), liveUrl: d.deployedUrl, repoUrl: d.repoUrl };
      }),
    hiring,
    resumeBuilt: terminal?.resumeFiles?.submitted?.updatedAt ?? null,
    latestChange: entries.reduce<string | null>((m, e) => (!m || e.updated_at > m ? e.updated_at : m), null),
    ogOk: await ogResolves(),
    invalid: entries
      .filter((e) => isRecordType(e.type))
      .flatMap((e) => {
        const bad = parseRecordData(e.type as RecordType, e.data) === null ? ["does not match its form"] : emptyRequired(e.type as RecordType, e.data);
        return bad.length ? [{ label: `${e.title || e.slug}: ${bad.join(", ")}`, href: section(e) }] : [];
      }),
    touched: entries.map((e) => ({ label: e.title || e.slug, href: section(e), updatedAt: e.updated_at })),
    security: await securityInput(),
    now,
  };
  const health = loaded ? computeHealth(input) : [];

  const recent = [
    ...history.map((h) => ({ at: h.at, text: `${h.key} ${h.action}`, href: "/admin/site/history", revert: h.action !== "revert" && h.before !== null && h.before !== undefined ? h.id : null })),
    ...entries.map((e) => ({ at: e.updated_at, text: `${e.title || e.slug} (${e.type.replace("_", " ")}) updated`, href: section(e), revert: null as number | null })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  const insights = insightsHref();

  return <HomeView email={user?.email ?? "admin"} preview={preview} source={CONTENT_SOURCE} lastPublish={lastPublish} loaded={loaded} health={health} recent={recent} insights={insights} now={now} />;
}

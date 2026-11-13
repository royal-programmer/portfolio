/**
 * "Preview site": an admin-only GET that sets the signed `xp-preview` cookie (30 minutes) on the shared
 * root domain and sends the browser to the hub (`?to=hub`) or the code world (`?to=engineer`) with
 * `?preview=draft`. `?to=off` clears it. A non-admin is sent to the login page and gets no cookie.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/db/server";
import { sharedCookieDomain } from "@/lib/site/experience";
import { parseHost, rootDomains, SUBDOMAIN_BY_PERSONA } from "@/lib/site/hosts";
import { makePreviewValue } from "@/lib/settings/preview";
import { PREVIEW_COOKIE } from "@/lib/settings/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login?next=/admin", url));

  const hostHeader = request.headers.get("host");
  const parsed = parseHost(hostHeader);
  const to = url.searchParams.get("to");
  const port = url.port ? `:${url.port}` : "";
  const root = parsed.kind === "unrouted" ? null : parsed.root;
  const base = (label: string | null) => (root ? `${url.protocol}//${label ? `${label}.` : ""}${root}${port}` : url.origin);
  const dest = to === "engineer" ? `${base(SUBDOMAIN_BY_PERSONA.engineer)}${root ? "/" : "/engineer"}` : `${base(null)}${root ? "/" : "/whoami"}`;

  const res = NextResponse.redirect(`${to === "off" ? base(null) + (root ? "/" : "/whoami") : `${dest}?preview=draft`}`);
  const domain = sharedCookieDomain(url.hostname, rootDomains());
  const opts = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: url.protocol === "https:", ...(domain ? { domain } : {}) };
  if (to === "off") {
    res.cookies.set(PREVIEW_COOKIE, "", { ...opts, maxAge: 0 });
    return res;
  }
  const made = makePreviewValue();
  if (made) res.cookies.set(PREVIEW_COOKIE, made.value, { ...opts, maxAge: made.maxAge });
  return res;
}

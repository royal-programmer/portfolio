/**
 * Where the admin lives, as pure functions (no runtime imports, so scripts can test them).
 *
 * The admin gets its own host, `admin.<root>` (`admin.ratulroy.me`, `admin.ratulroy.localhost` locally),
 * so Cloudflare Access can sit in front of exactly that name. On that host the console is served at the
 * root: `/` is the console home, `/login`, `/auth/callback`, `/engineer/projects`. Internally the files
 * still live under `app/admin/**`, so the proxy rewrites `/x` to `/admin/x`; old `/admin/x` links on the
 * admin host redirect to `/x`, and `/admin/**` on any other routed host redirects to the admin host.
 */

/**
 * The admin host's label. `ADMIN_HOST_LABEL` overrides it: another word (`console`), or `apex` / `none`
 * to keep the admin on the root host at `/admin` (the pre-round-33 behaviour). Default `admin`.
 */
export function adminHostLabel(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.ADMIN_HOST_LABEL ?? "").trim().toLowerCase();
  if (raw === "apex" || raw === "none" || raw === "-") return null;
  return /^[a-z0-9][a-z0-9-]{0,30}$/.test(raw) ? raw : "admin";
}

export const ADMIN_HOST_LABEL: string | null = adminHostLabel();

export type AdminRoute =
  | { kind: "pass" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; toAdminHost: boolean; pathname: string; status: 301 | 307 | 308 };

export type AdminRouteInput = {
  /** The request's host is `admin.<root>`. */
  onAdminHost: boolean;
  pathname: string;
  method: string;
  /** A client-router (RSC) fetch: it cannot follow redirects, so it is served as-is. */
  isRsc: boolean;
  production: boolean;
  /** `ADMIN_HOST_STRICT=1`: redirect to the admin host in development too. */
  strict: boolean;
};

/** `/admin` or `/admin/...` (never `/administrator`). */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** `/admin/login` becomes `/login`; `/admin` becomes `/`. */
export function cleanAdminPath(pathname: string): string {
  if (pathname === "/admin" || pathname === "/admin/") return "/";
  return pathname.startsWith("/admin/") ? pathname.slice("/admin".length) : pathname;
}

/** What to do with a request for the admin: pure, so the host rules are testable without Next. */
export function adminRoute(i: AdminRouteInput): AdminRoute {
  const safeMethod = i.method === "GET" || i.method === "HEAD";
  if (i.onAdminHost) {
    if (isAdminPath(i.pathname)) {
      // The old /admin/x URL: clean it up for documents only (a POST or an RSC fetch must not be redirected).
      if (safeMethod && !i.isRsc) return { kind: "redirect", toAdminHost: false, pathname: cleanAdminPath(i.pathname), status: i.production ? 308 : 307 };
      return { kind: "pass" };
    }
    return { kind: "rewrite", pathname: i.pathname === "/" ? "/admin" : `/admin${i.pathname}` };
  }
  if (isAdminPath(i.pathname) && safeMethod && !i.isRsc && (i.production || i.strict)) {
    return { kind: "redirect", toAdminHost: true, pathname: cleanAdminPath(i.pathname), status: i.production ? 301 : 307 };
  }
  return { kind: "pass" };
}

/** The admin's origin for a given request host (sign-in links, redirects). Pure. */
export function adminOrigin(opts: { host: string; proto: string; root: string | null; label: string | null }): string {
  const port = opts.host.match(/:\d+$/)?.[0] ?? "";
  if (!opts.root) return `${opts.proto}://${opts.host}`;
  return `${opts.proto}://${opts.label ? `${opts.label}.` : ""}${opts.root}${port}`;
}

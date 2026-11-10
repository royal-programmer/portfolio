/**
 * Subdomain routing (decision D31).
 *
 *   ratulroy.me/            → hub (served by /whoami)
 *   www. / who.             → redirect to the bare root
 *   code.ratulroy.me/x      → rewrite to /engineer/x   (trade. lens. play. ride. art. likewise)
 *   ratulroy.me/engineer/x  → redirect to code.ratulroy.me/x  (subdomain is canonical)
 *   code.ratulroy.me/trader → redirect to trade.ratulroy.me/
 *   <unknown>.ratulroy.me/  → the "persona not found" page
 *
 * Hosts outside the configured root domain (e.g. *.vercel.app, plain
 * localhost) pass through untouched, so path URLs keep working on previews.
 * Dev mirror: ratulroy.localhost:3000 / code.ratulroy.localhost:3000 (hosts.ts).
 *
 * Redirects are 307 (temporary) until launch, so browsers don't cache them
 * while the mapping may still change.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isPersonaSlug } from "@/lib/content/types";
import { parseHost, SUBDOMAIN_BY_PERSONA } from "@/lib/site/hosts";

function hostUrl(request: NextRequest, root: string, label: string | null, pathname: string) {
  // Built by hand: NextURL normalises `localhost` hostnames, which breaks dev redirects.
  const { protocol, port, search } = request.nextUrl;
  const host = `${label ? `${label}.` : ""}${root}${port ? `:${port}` : ""}`;
  return new URL(`${protocol}//${host}${pathname}${search}`);
}

/** Preview deployments (the `development` branch on Vercel) are never for search engines. */
function noindex<T extends NextResponse>(res: T): T {
  if (process.env.VERCEL_ENV === "preview") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export function proxy(request: NextRequest) {
  return noindex(route(request));
}

function route(request: NextRequest) {
  const parsed = parseHost(request.headers.get("host"));
  if (parsed.kind === "unrouted") return NextResponse.next();

  const { pathname } = request.nextUrl;
  // The share preview image is served as-is on every host (code.ratulroy.me/og?cmd=timeline).
  if (pathname === "/og") return NextResponse.next();
  const [first = "", ...restSegments] = pathname.split("/").filter(Boolean);
  const rest = restSegments.length ? `/${restSegments.join("/")}` : "/";

  switch (parsed.kind) {
    case "hub-alias":
      return NextResponse.redirect(hostUrl(request, parsed.root, null, pathname), 308);

    case "hub": {
      if (pathname === "/") {
        // Keep the query (dev preview flags and the like) across the rewrite.
        const hub = new URL("/whoami", request.url);
        hub.search = request.nextUrl.search;
        return NextResponse.rewrite(hub);
      }
      if (first === "whoami") return NextResponse.redirect(hostUrl(request, parsed.root, null, "/"));
      if (isPersonaSlug(first)) {
        return NextResponse.redirect(hostUrl(request, parsed.root, SUBDOMAIN_BY_PERSONA[first], rest));
      }
      return NextResponse.next(); // /capture etc.
    }

    case "persona": {
      // Admin + hub live on the root host (auth cookies are host-scoped).
      if (first === "capture") return NextResponse.redirect(hostUrl(request, parsed.root, null, pathname));
      if (first === "whoami") return NextResponse.redirect(hostUrl(request, parsed.root, null, "/"));
      // Path-style URL on the persona's own host. Documents get the clean URL;
      // client-router (RSC) fetches are served as-is — the router can't follow
      // redirects (e.g. a click on a path-style href before hydration swaps it).
      if (first === parsed.persona) {
        if (request.headers.has("rsc")) return NextResponse.next();
        return NextResponse.redirect(hostUrl(request, parsed.root, parsed.label, rest));
      }
      // Link to another persona: hop to its subdomain.
      if (isPersonaSlug(first)) {
        return NextResponse.redirect(hostUrl(request, parsed.root, SUBDOMAIN_BY_PERSONA[first], rest));
      }
      const target = request.nextUrl.clone();
      target.pathname = `/${parsed.persona}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(target);
    }

    case "unknown": {
      // A persona slug typed as a subdomain (e.g. trader.) → its real subdomain.
      if (isPersonaSlug(parsed.label)) {
        return NextResponse.redirect(hostUrl(request, parsed.root, SUBDOMAIN_BY_PERSONA[parsed.label], pathname));
      }
      if (pathname === "/") return NextResponse.rewrite(new URL(`/${parsed.label}`, request.url));
      return NextResponse.redirect(hostUrl(request, parsed.root, null, "/"));
    }
  }
}

export const config = {
  // Skip API routes, Next internals and any file with an extension (assets).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};

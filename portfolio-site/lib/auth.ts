/**
 * Auth guards for protected (capture/admin) routes.
 * Server-only.
 */
import { redirect } from "next/navigation";
import { isAdmin } from "./db/server";

/** A same-site path to come back to after login: starts with one `/`, never `//` or a scheme. */
export function safeNext(next: string | null | undefined): string | null {
  return next && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : null;
}

/**
 * Ensures the current request is an authenticated admin. Redirects to the
 * login page otherwise (with `?next=` when the caller says where to return to).
 * Call at the top of any protected Server Component.
 */
export async function requireAdmin(next?: string): Promise<void> {
  if (!(await isAdmin())) {
    const to = safeNext(next);
    redirect(to ? `/capture/login?next=${encodeURIComponent(to)}` : "/capture/login");
  }
}

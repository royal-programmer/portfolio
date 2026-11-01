/**
 * Auth guards for protected (capture/admin) routes.
 * Server-only.
 */
import { redirect } from "next/navigation";
import { isAdmin } from "./db/server";

/**
 * Ensures the current request is an authenticated admin. Redirects to the
 * login page otherwise. Call at the top of any protected Server Component.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect("/capture/login");
  }
}

import { getUser, isAdmin } from "@/lib/db/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/** Server wrapper: tells the form whether this browser holds a session that is not an admin. */
export default async function AdminLoginPage() {
  let notAdminEmail: string | null = null;
  try {
    const user = await getUser();
    if (user && !(await isAdmin())) notAdminEmail = user.email ?? "this account";
  } catch {
    // No session or no Supabase env: show the plain form.
  }
  return <LoginForm notAdminEmail={notAdminEmail} />;
}

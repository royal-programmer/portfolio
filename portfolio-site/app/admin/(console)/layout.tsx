import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, isAdmin } from "@/lib/db/server";
import { getAllSettings } from "@/lib/settings/read";
import { SETTING_KEYS } from "@/lib/settings/schema";
import { AdminShell } from "../shell";

/** The single admin check: every page under /admin except /admin/login (outside this group) passes here. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser().catch(() => null);
  if (!user) redirect("/admin/login?next=%2Fadmin");
  if (!(await isAdmin())) {
    return (
      <div className="adm-root" style={{ display: "block", padding: "2rem" }}>
        <p className="adm-banner" role="alert">
          You are signed in as {user.email ?? "this account"}, which is not an admin account. <Link href="/admin/login">Go to sign-in</Link>
        </p>
      </div>
    );
  }
  const { tableReady, error, items } = await getAllSettings();
  const differing = SETTING_KEYS.filter((k) => items[k].differs);
  return (
    <AdminShell differing={differing} email={user.email ?? "admin"} tableReady={tableReady} error={error}>
      {children}
    </AdminShell>
  );
}

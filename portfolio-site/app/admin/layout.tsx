import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAllSettings } from "@/lib/settings/read";
import { GROUPS } from "@/lib/settings/schema";
import { AdminShell } from "./shell";
import "./admin.css";

export const metadata: Metadata = { title: "Admin | Ratul Roy", robots: { index: false, follow: false } };
// Auth-gated and always fresh: never cached.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  const { tableReady, error, items } = await getAllSettings();
  const groups = GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    accent: g.accent,
    differs: g.keys.some((k) => items[k].differs),
  }));
  return (
    <AdminShell groups={groups} tableReady={tableReady} error={error}>
      {children}
    </AdminShell>
  );
}

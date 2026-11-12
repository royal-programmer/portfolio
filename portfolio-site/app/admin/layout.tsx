import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = { title: "Admin | Ratul Roy", robots: { index: false, follow: false } };
// Auth-gated and always fresh: never cached.
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

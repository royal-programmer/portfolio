import { redirect } from "next/navigation";

/** The front door is the hub (Ratul's call): on the real domain the proxy rewrites `/` to it; path-style hosts (previews, localhost) land here and go the same way, keeping the query (the Stage's door arrives with `?via=stage&from=engineer`). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, x);
  const q = qs.toString();
  redirect(q ? `/whoami?${q}` : "/whoami");
}

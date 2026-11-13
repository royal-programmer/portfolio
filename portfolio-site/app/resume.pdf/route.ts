import { loadTerminalConfig } from "@/lib/settings/load";
import { loadHomeContent } from "../load-home-content";
import { buildResume } from "@/lib/resume/build";
import { renderResume } from "@/lib/resume/render";
import { TOKEN_RE, takeBuild } from "@/lib/resume/store";

/**
 * The generated résumé, from the same data as the terminal (`lib/site/terminal-data.ts`).
 * - `?build=<token>`: the bytes `/api/resume/build` just rendered (kept ten minutes); `&download=1` makes it an attachment.
 * - no token: a fresh render, as before, so old links work.
 * The route is `force-dynamic`: Next cannot make a route static only when the query is empty (a static route
 * never sees `?build=` or `?download=`). The `Cache-Control` below still lets the CDN cache the token-less render.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pdfHeaders = (download: boolean, name: string, cache: string) => ({
  "Content-Type": "application/pdf",
  "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
  "Cache-Control": cache,
});

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const download = q.get("download") === "1";
  const build = q.get("build");
  if (build !== null) {
    const b = TOKEN_RE.test(build) ? takeBuild(build) : null;
    if (!b) return new Response("That build has expired. Run `resume --build` again.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    return new Response(new Uint8Array(b.bytes), { headers: pdfHeaders(download, `Ratul_Roy_Resume_${b.date}.pdf`, "private, no-store") });
  }
  const [{ personas, engineerEntries }, { cfg }] = await Promise.all([loadHomeContent(), loadTerminalConfig()]);
  const pdf = await renderResume(buildResume(personas.find((p) => p.slug === "engineer"), engineerEntries, new Date(), cfg));
  return new Response(new Uint8Array(pdf), { headers: pdfHeaders(download, "Ratul_Roy_Resume.pdf", "public, max-age=3600, s-maxage=86400") });
}

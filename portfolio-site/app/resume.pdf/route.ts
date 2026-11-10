import { loadHomeContent } from "../load-home-content";
import { buildResume } from "@/lib/resume/build";
import { renderResume } from "@/lib/resume/render";

/**
 * The résumé, generated from the same data as the terminal (`lib/site/terminal-data.ts`).
 * Static: built at deploy and cached by the CDN; in dev it renders on request.
 */
export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET(req: Request) {
  const { personas, engineerEntries } = await loadHomeContent();
  const pdf = await renderResume(buildResume(personas.find((p) => p.slug === "engineer"), engineerEntries));
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Ratul_Roy_Resume.pdf"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

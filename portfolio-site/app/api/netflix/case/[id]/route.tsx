import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { registerFonts } from "@/lib/resume/render";
import { caseOf, caseSlug } from "@/lib/site/netflix-case";
import { DISPLAY_ROOT } from "@/lib/site/brand";
import { loadEngineerTerminalData } from "@/app/load-terminal-data";

/**
 * A one-page case study PDF for one project or episode (17-persona-views.md §22, D3): the title, the metric large,
 * the synopsis, the stack, the links and a footer with the profile link (no QR). Same renderer and fonts as the résumé.
 * Cached for a day.
 */
export const runtime = "nodejs";

const INK = "#16181d";
const MUTED = "#555b66";
const ACCENT = "#2f6df6";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 11, lineHeight: 1.5, color: INK, paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56 },
  kicker: { fontSize: 9, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", color: ACCENT },
  title: { fontSize: 24, fontWeight: 600, lineHeight: 1.2, marginTop: 8 },
  metric: { fontSize: 64, fontWeight: 600, lineHeight: 1.05, marginTop: 30, color: ACCENT },
  metricLabel: { fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", color: MUTED, marginTop: 2 },
  rule: { borderBottomWidth: 1.2, borderBottomColor: ACCENT, marginTop: 22, marginBottom: 6 },
  h: { fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginTop: 16, marginBottom: 4 },
  body: { fontSize: 12, lineHeight: 1.55 },
  muted: { color: MUTED },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8.5, color: "#8a8f98" },
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const data = await loadEngineerTerminalData();
    const c = caseOf(data, id);
    if (!c) return new Response("No case study for that title.", { status: 404 });
    const f = c.facts;
    const host = new URL(req.url).hostname;
    const local = host === "localhost" || host.endsWith(".localhost");
    const origin = local ? new URL(req.url).origin : `https://code.${DISPLAY_ROOT}`;
    const link = `${origin}/netflix?profile=recruiter&title=${encodeURIComponent(f.id)}`;
    const meta = [f.branchLabel, f.season != null ? `S${f.season}${f.n != null ? ` E${f.n}` : ""}` : f.year, f.runtime].filter(Boolean).join("  ·  ");
    registerFonts();
    const buf = await renderToBuffer(
      <Document title={`${f.title} - case study`} author={data.resume.name} creator={origin}>
        <Page size="A4" style={s.page}>
          <Text style={s.kicker}>{`${data.resume.name}  ·  case study`}</Text>
          <Text style={s.title}>{f.title}</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>{meta}</Text>
          {f.metric ? (
            <View>
              <Text style={s.metric}>{f.metric.value}</Text>
              <Text style={s.metricLabel}>{f.metric.label}</Text>
            </View>
          ) : null}
          <View style={s.rule} />
          {f.blurb ? (
            <View>
              <Text style={s.h}>The story</Text>
              <Text style={s.body}>{f.blurb}</Text>
            </View>
          ) : null}
          {f.stack.length ? (
            <View>
              <Text style={s.h}>Stack</Text>
              <Text style={s.body}>{f.stack.join("  ·  ")}</Text>
            </View>
          ) : null}
          {f.live || f.repo ? (
            <View>
              <Text style={s.h}>Links</Text>
              {f.live ? <Text style={s.body}>{`Live: ${f.live}`}</Text> : null}
              {f.repo ? <Text style={s.body}>{`Code: ${f.repo}`}</Text> : null}
            </View>
          ) : null}
          <Text style={s.footer}>{`See it in context: ${link}`}</Text>
        </Page>
      </Document>,
    );
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ratul-roy-${caseSlug(f.title)}.pdf"`,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (e) {
    console.error("[netflix case]", e instanceof Error ? e.message : e);
    return new Response("Could not build the case study.", { status: 500 });
  }
}

/**
 * Renders a `ResumeDoc` to a one-page A4 PDF: real text, no tables, no icons, no fills behind text.
 * Server only (Node runtime).
 */
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ResumeDoc } from "./build";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

const INK = "#16181d";
const MUTED = "#555b66";
const GREY = "#8a8f98";

function makeStyles(accent: string) {
  return StyleSheet.create({
    page: { fontFamily: "Inter", fontSize: 8.6, lineHeight: 1.38, color: INK, paddingTop: 34, paddingBottom: 38, paddingHorizontal: 40 },
    name: { fontSize: 20, fontWeight: 600, lineHeight: 1.2, marginBottom: 3 },
    title: { fontSize: 10, fontWeight: 500, color: MUTED, marginTop: 1 },
    meta: { fontSize: 8.4, color: MUTED, marginTop: 3 },
    rule: { borderBottomWidth: 1.2, borderBottomColor: accent, marginTop: 7, marginBottom: 2 },
    sectionRule: { borderBottomWidth: 0.8, borderBottomColor: accent, marginTop: 2, marginBottom: 4 },
    h: { fontSize: 8.4, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: INK, marginTop: 8 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    bold: { fontWeight: 600 },
    medium: { fontWeight: 500 },
    muted: { color: MUTED },
    bulletRow: { flexDirection: "row", marginTop: 1.6 },
    dot: { width: 9, color: accent, fontWeight: 600 },
    grow: { flex: 1 },
    line: { marginTop: 1.8 },
    footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: GREY },
  });
}

type S = ReturnType<typeof makeStyles>;

function Section({ s, title }: { s: S; title: string }) {
  return (
    <View minPresenceAhead={30}>
      <Text style={s.h}>{title}</Text>
      <View style={s.sectionRule} />
    </View>
  );
}

function Bullet({ s, children }: { s: S; children: string }) {
  return (
    <View style={s.bulletRow} wrap={false}>
      <Text style={s.dot}>-</Text>
      <Text style={s.grow}>{children}</Text>
    </View>
  );
}

export function ResumePdf({ d }: { d: ResumeDoc }) {
  const s = makeStyles(d.accent);
  return (
    <Document title={`${d.name} - Resume`} author={d.name} subject={d.title} creator={d.site}>
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{d.name}</Text>
        <Text style={s.title}>{d.title}</Text>
        <Text style={s.meta}>{d.location}</Text>
        <Text style={s.meta}>{d.links.join("  ·  ")}</Text>
        <Text style={[s.meta, { color: GREY }]}>{d.status}</Text>
        <View style={s.rule} />

        <Section s={s} title="Summary" />
        <Text>{d.summary}</Text>

        <Section s={s} title="Skills" />
        {d.skills.map((k) => (
          <Text key={k.group} style={s.line}>
            <Text style={s.bold}>{k.group}: </Text>
            {k.items}
          </Text>
        ))}

        <Section s={s} title="Experience" />
        {d.experience.map((e) => (
          <View key={e.role + e.company}>
            <View style={s.row}>
              <Text>
                <Text style={s.bold}>{e.role}</Text>
                <Text style={s.muted}>  ·  {e.company}</Text>
              </Text>
              <Text style={s.muted}>{e.period}</Text>
            </View>
            <Text style={[s.medium, { marginTop: 1 }]}>{e.headline}</Text>
            {e.bullets.map((b, i) => (
              <Bullet key={i} s={s}>
                {b}
              </Bullet>
            ))}
            {e.milestones.length > 0 && (
              <Text style={[s.muted, { marginTop: 3, fontSize: 8 }]}>
                <Text style={s.bold}>milestones: </Text>
                {e.milestones.join("  ·  ")}
              </Text>
            )}
          </View>
        ))}

        <Section s={s} title="Projects" />
        {d.projects.map((p) => (
          <Text key={p.name} style={s.line}>
            <Text style={s.bold}>{p.name}</Text>
            <Text style={s.muted}>  -  {p.line}</Text>
          </Text>
        ))}

        <Section s={s} title="Education" />
        {d.education.map((e) => (
          <View key={e.title} style={[s.row, s.line]}>
            <Text style={s.grow}>
              <Text style={s.bold}>{e.title}</Text>
              {e.detail ? <Text style={s.muted}>  ·  {e.detail}</Text> : null}
              {e.grade ? <Text>  ·  {e.grade}</Text> : null}
            </Text>
            <Text style={s.muted}>{e.year}</Text>
          </View>
        ))}

        <Section s={s} title="Certifications" />
        {d.certifications.map((c) => (
          <Text key={c.issuer} style={s.line}>
            <Text style={s.bold}>{c.issuer}</Text>
            <Text style={s.muted}>  -  {c.line}</Text>
          </Text>
        ))}

        <Text style={s.footer} fixed>
          Generated from {d.site} · {d.generated}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderResume(data: ResumeDoc): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ResumePdf d={data} />);
}

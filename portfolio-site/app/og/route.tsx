import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setDefaultResultOrder } from "node:dns";
import { createRequire } from "node:module";
import { DISPLAY_ROOT } from "@/lib/site/brand";
import { ogLines, planOg, type OgLine, type OgPlan, type OgTone } from "@/lib/site/og-lines";
import { paletteFor, type ThemePalette } from "@/lib/site/terminal-themes";
import { USER } from "@/lib/site/terminal-fs";
import { heatGrid, statsValid, type StatsData } from "@/lib/site/terminal-stats";
import { portraitRows, renderPortrait } from "@/lib/site/portrait-gen";
import type { TerminalData } from "@/lib/site/terminal-data";
import { netflixCard, type NetflixCard } from "@/lib/site/netflix-og";
import { loadHomeContent } from "../load-home-content";
import { loadEngineerTerminalData } from "../load-terminal-data";
import { GET as contributions } from "../api/github/contributions/route";

/**
 * The preview image for a shared link (`/og?cmd=timeline&theme=dracula`): a 1200x630 PNG of the real
 * terminal output for an allowlisted command, drawn in the theme's colours. The shell is pure, so the same
 * code that answers in the browser runs here. Dynamic, but the CDN keeps it through the headers below.
 */
// Some networks (and this dev machine) hand out IPv6 addresses that never answer; try IPv4 first.
try {
  setDefaultResultOrder("ipv4first");
} catch {}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1200;
const H = 630;
const FONT = 20;
const LH = 28;
const HOST = `code.${DISPLAY_ROOT}`;
const HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
  "X-Robots-Tag": "noindex",
};

/**
 * `next/og` rasterises with the copy of sharp that ships inside next. A second sharp (the app's own, for media)
 * loaded into the same process breaks it ("colourspace: parameter space not set"), so the portrait sampler
 * borrows next's copy too; the app's sharp is pinned to next's range so npm keeps one copy.
 */
function nextSharp(): typeof import("sharp") {
  const app = createRequire(path.join(process.cwd(), "package.json"));
  try {
    return createRequire(app.resolve("next/package.json"))("sharp");
  } catch {
    return app("sharp");
  }
}

let fontP: Promise<Buffer> | null = null;
const loadFont = () => (fontP ??= readFile(path.join(process.cwd(), "public", "fonts", "JetBrainsMono-Regular-subset.ttf")));

const tone = (p: ThemePalette, t: OgTone | undefined) => (t === "accent" ? p.accent : t === "dim" ? p.dim : t === "ok" ? p.ok : t === "violet" ? p.violet : p.ink);

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

const Row = ({ p, l }: { p: ThemePalette; l: OgLine }) => (
  <div style={{ display: "flex", height: LH, whiteSpace: "pre", fontSize: FONT, lineHeight: `${LH}px` }}>
    {l.map((r, i) => (r.t ? <span key={i} style={{ color: tone(p, r.tone) }}>{r.t}</span> : null))}
  </div>
);

const Prompt = ({ p, cmd }: { p: ThemePalette; cmd: string }) => (
  <div style={{ display: "flex", height: LH, whiteSpace: "pre", fontSize: FONT, lineHeight: `${LH}px` }}>
    <span style={{ color: p.accent }}>{`${USER}@code`}</span>
    <span style={{ color: p.dim }}>:~$ </span>
    <span style={{ color: p.ink }}>{cmd}</span>
  </div>
);

/** The terminal window: rounded frame, title bar with the host, then the body. */
function Frame({ p, children }: { p: ThemePalette; children: ReactNode }): ReactElement {
  return (
    <div style={{ display: "flex", width: W, height: H, background: p.void, padding: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, background: p.bg, border: `1px solid ${p.faint}`, borderRadius: 24, overflow: "hidden", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", height: 44, padding: "0 20px", borderBottom: `1px solid ${rgba(p.faint, 0.45)}` }}>
          <div style={{ display: "flex", width: 90, gap: 8 }}>
            {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
            ))}
          </div>
          <div style={{ display: "flex", flex: 1, justifyContent: "center", color: p.dim, fontSize: 16 }}>{HOST}</div>
          <div style={{ display: "flex", width: 90 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 28px" }}>{children}</div>
        <div style={{ display: "flex", position: "absolute", right: 28, bottom: 12, color: p.dim, fontSize: 15 }}>ratulroy.me · type it yourself</div>
      </div>
    </div>
  );
}

function TextBody({ p, cmd, lines }: { p: ThemePalette; cmd: string; lines: OgLine[] }): ReactElement {
  return (
    <Frame p={p}>
      <Prompt p={p} cmd={cmd} />
      {lines.map((l, i) => (
        <Row key={i} p={p} l={l} />
      ))}
    </Frame>
  );
}

async function statsData(): Promise<StatsData | null> {
  try {
    const res = await contributions();
    const j: unknown = await res.json();
    return statsValid(j) ? j : null;
  } catch {
    return null;
  }
}

/** `stats`: the heatmap as coloured squares, then the streaks and the language bar. */
function StatsBody({ p, d }: { p: ThemePalette; d: StatsData }): ReactElement {
  const { weeks } = heatGrid(d, 53);
  const level = [rgba(p.faint, 0.28), rgba(p.accent, 0.3), rgba(p.accent, 0.52), rgba(p.accent, 0.76), p.accent];
  const cell = 15;
  const gap = 4;
  const palette = [p.accent, p.ok, p.violet, p.dim, p.faint, p.ink];
  return (
    <Frame p={p}>
      <Prompt p={p} cmd="stats" />
      <Row p={p} l={[{ t: `${d.total.toLocaleString("en-US")} contributions in the last year`, tone: "accent" }, { t: ` · ${d.user}`, tone: "dim" }]} />
      <div style={{ display: "flex", gap, marginTop: 14, marginBottom: 14 }}>
        {weeks.map((w, x) => (
          <div key={x} style={{ display: "flex", flexDirection: "column", gap }}>
            {w.map((c, y) => (
              <div key={y} style={{ width: cell, height: cell, borderRadius: 3, background: c ? level[c.level] : "transparent" }} />
            ))}
          </div>
        ))}
      </div>
      <Row p={p} l={[{ t: "streak  ", tone: "dim" }, { t: `${d.streak.current} days`, tone: "ok" }, { t: "  longest  ", tone: "dim" }, { t: `${d.streak.longest} days`, tone: "ok" }]} />
      {d.languages.length ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
          <div style={{ display: "flex", width: 1000, height: 12, borderRadius: 6, overflow: "hidden", gap: 2 }}>
            {d.languages.map((l, i) => (
              <div key={l.name} style={{ display: "flex", flex: l.pct, background: palette[i % palette.length] }} />
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 17, color: p.dim, whiteSpace: "pre" }}>
            {d.languages.map((l, i) => (
              <span key={l.name} style={{ color: palette[i % palette.length], marginRight: 18 }}>{`${l.name} ${l.pct}%`}</span>
            ))}
          </div>
        </div>
      ) : null}
    </Frame>
  );
}

/** `portrait`: the photo as ░▒▓█ in the accent (sampled with sharp), my identity on the right. */
async function portraitBody(p: ThemePalette, data: TerminalData): Promise<ReactElement> {
  const sharp = nextSharp();
  const { crop } = data.portrait;
  const file = path.join(process.cwd(), "public", data.portrait.src.replace(/^\//, ""));
  const meta = await sharp(file).metadata();
  const iw = meta.width ?? 640;
  const ih = meta.height ?? 640;
  const left = Math.round(crop[0] * iw);
  const top = Math.round(crop[1] * ih);
  const cw = Math.max(1, Math.round((crop[2] - crop[0]) * iw));
  const ch = Math.max(1, Math.round((crop[3] - crop[1]) * ih));
  const cols = 48;
  const rows = portraitRows("blocks", cols, cw / ch);
  const raw = await sharp(file).extract({ left, top, width: cw, height: ch }).resize(cols, rows, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const art = renderPortrait("blocks", cols, cw / ch, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(raw), colorSpace: "srgb" }) as ImageData);
  const size = Math.floor(456 / art.rows);
  return (
    <Frame p={p}>
      <Prompt p={p} cmd="portrait" />
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", color: p.accent, fontSize: size, lineHeight: `${size}px`, whiteSpace: "pre", marginTop: 6 }}>
          {art.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", height: size }}>{l.map((r) => r.t).join("")}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 48, marginTop: 120 }}>
          <Row p={p} l={[{ t: data.resume.name, tone: "accent" }]} />
          <Row p={p} l={[{ t: data.resume.title.split(" · ")[0], tone: "ink" }]} />
          <Row p={p} l={[{ t: data.who, tone: "dim" }]} />
          <Row p={p} l={[{ t: data.stack.slice(0, 5).join(" · "), tone: "dim" }]} />
          <Row p={p} l={[{ t: data.resume.location.split(" · ")[0], tone: "dim" }]} />
        </div>
      </div>
    </Frame>
  );
}

/** Mixes `hex` over the cinema black: `share` of the colour, the rest black. */
function mixBlack(hex: string, share: number) {
  const n = parseInt(hex.slice(1), 16);
  const k = (v: number) => Math.round(v * share + 11 * (1 - share));
  return `rgb(${k(n >> 16)},${k((n >> 8) & 255)},${k(n & 255)})`;
}

/** `netflix:<id>`: the watch-party card in the Netflix view's look: the billboard gradient, the numeral, the title, one line, our R mark. */
function NetflixBody({ card, accent }: { card: NetflixCard; accent: string }): ReactElement {
  const b = card.tone ?? accent;
  const size = card.title.length > 48 ? 44 : card.title.length > 28 ? 54 : 72;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: `linear-gradient(135deg, ${mixBlack(b, 0.55)}, ${mixBlack(b, 0.16)})`, color: "#f3f1ec", padding: "56px 72px", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 12, background: b, color: "#0b0b0f", fontSize: 38 }}>R</div>
        <div style={{ display: "flex", marginLeft: 20, fontSize: 22, color: "rgba(243,241,236,.72)" }}>a series by Ratul Roy</div>
      </div>
      <div style={{ display: "flex", marginTop: 36, fontSize: 104, lineHeight: 1, color: b === accent ? "#f3f1ec" : b, letterSpacing: -4 }}>{card.numeral}</div>
      <div style={{ display: "flex", marginTop: 18, fontSize: size, lineHeight: 1.1, maxWidth: 1050 }}>{card.title}</div>
      <div style={{ display: "flex", marginTop: 20, fontSize: 24, lineHeight: 1.35, maxWidth: 1000, maxHeight: 66, overflow: "hidden", color: "rgba(243,241,236,.82)" }}>{card.line}</div>
      <div style={{ display: "flex", position: "absolute", left: 72, bottom: 40, fontSize: 24, color: "rgba(243,241,236,.7)" }}>{`${HOST}/netflix`}</div>
    </div>
  );
}

async function draw(plan: OgPlan, data: TerminalData): Promise<ReactElement> {
  const p = paletteFor(plan.theme);
  if (plan.kind === "stats") {
    const d = await statsData();
    if (d) return <StatsBody p={p} d={d} />;
    return <TextBody p={p} cmd="stats" lines={[[{ t: "stats: github is not answering right now", tone: "dim" }], [{ t: "open the terminal and try again", tone: "dim" }]]} />;
  }
  if (plan.kind === "portrait") return portraitBody(p, data);
  return <TextBody p={p} cmd={plan.cmd} lines={ogLines(data, plan.cmd.startsWith("theme ") ? "portfolio" : plan.cmd)} />;
}

/** Renders to bytes here (not a lazy stream), so a drawing error lands in the catch and the fallback image. */
const respond = async (el: ReactElement) => {
  const img = new ImageResponse(el, { width: W, height: H, fonts: [{ name: "JetBrains Mono", data: await loadFont(), weight: 400, style: "normal" }] });
  return new Response(await img.arrayBuffer(), { headers: HEADERS });
};

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const data = await loadEngineerTerminalData();
    const nf = /^netflix:(.{1,90})$/i.exec((q.get("cmd") ?? "").trim());
    if (nf) {
      const card = netflixCard(data, nf[1]);
      if (card) {
        const { personas } = await loadHomeContent();
        return await respond(<NetflixBody card={card} accent={personas.find((p) => p.slug === "engineer")?.accent ?? "#3b82f6"} />);
      }
    }
    const plan = planOg(q.get("cmd"), q.get("theme"), data.views.map((v) => v.id));
    return await respond(await draw(plan, data));
  } catch (e) {
    console.error("[og]", e instanceof Error ? e.message : e);
    // Always an image: the banner and the command to try.
    const p = paletteFor(null);
    try {
      return await respond(
        <TextBody
          p={p}
          cmd="type portfolio"
          lines={[[{ t: "royal-programmer", tone: "accent" }, { t: " · Ratul Roy · software engineer", tone: "dim" }], [{ t: "this one is a terminal: open it and type portfolio", tone: "ink" }]]}
        />,
      );
    } catch (e2) {
      console.error("[og] fallback", e2 instanceof Error ? e2.message : e2);
      return new Response("preview unavailable", { status: 500, headers: { "X-Robots-Tag": "noindex" } });
    }
  }
}

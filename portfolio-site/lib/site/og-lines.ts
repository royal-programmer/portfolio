/**
 * The preview image's text: runs a terminal command through the real shell on the server and flattens
 * the output entries into coloured lines of at most `OG_COLS` characters. Pure (no DOM, no React), so the
 * route (`app/og/route.tsx`) and the page metadata (`lib/site/share-meta.ts`) share one allowlist.
 */
import { createShell, THEMES, initialShellState, type Out, type TimelineRow } from "@/lib/site/terminal-shell";
import type { TerminalData } from "@/lib/site/terminal-data";

export type OgTone = "ink" | "accent" | "dim" | "ok" | "violet";
export type OgRun = { t: string; tone?: OgTone };
export type OgLine = OgRun[];

/** Commands the image route will run; anything else shows `portfolio`. */
export const OG_COMMANDS = ["help", "whoami", "timeline", "portfolio", "stack", "projects", "resume", "contact", "now", "hire", "stats", "theme", "neofetch", "views", "portrait"] as const;
/** Characters per line the frame fits (JetBrains Mono, 20px, inside the window). */
export const OG_COLS = 84;
/** Output lines the frame shows (the prompt is one more). */
export const OG_MAX_LINES = 16;

export type OgPlan = {
  /** The command as shown at the prompt (normalised; `portfolio` for anything unknown). */
  cmd: string;
  /** Theme id for the image, or null for the default. */
  theme: string | null;
  kind: "text" | "stats" | "portrait";
};

/** Decide what to draw for the `cmd` and `theme` query values. */
export function planOg(rawCmd: string | null | undefined, rawTheme: string | null | undefined, viewIds: string[] = []): OgPlan {
  const tokens = (rawCmd ?? "").trim().slice(0, 60).toLowerCase().split(/\s+/).filter(Boolean);
  const name = tokens[0] ?? "";
  const arg = tokens[1] ?? "";
  let theme = THEMES.some((t) => t.id === (rawTheme ?? "").toLowerCase()) ? (rawTheme ?? "").toLowerCase() : null;
  if (name === "view" && tokens.length === 2 && viewIds.includes(arg)) return { cmd: `view ${arg}`, theme, kind: "text" };
  if (!(OG_COMMANDS as readonly string[]).includes(name)) return { cmd: "portfolio", theme, kind: "text" };
  if (name === "theme") {
    const th = THEMES.find((t) => t.id === arg);
    if (th) {
      theme = th.id;
      return { cmd: `theme ${th.id}`, theme, kind: "text" };
    }
    return { cmd: "portfolio", theme, kind: "text" };
  }
  return { cmd: name, theme, kind: name === "stats" ? "stats" : name === "portrait" ? "portrait" : "text" };
}

const fit = (t: string, n = OG_COLS) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const line = (...runs: OgRun[]): OgLine => runs;
const plain = (t: string, tone?: OgTone): OgLine => [{ t: fit(t), tone }];

function timelineLine(r: Exclude<TimelineRow, { head: string }>): OgLine {
  const left = fit(`${(r.year || "").padEnd(4)} ${r.mon}  ${r.subject}`, 47).padEnd(48);
  const tag = r.tag ? `[${r.tag}]` : "";
  const grade = r.grade ? ` ${r.grade}` : "";
  const pad = " ".repeat(Math.max(0, 18 - tag.length - grade.length));
  const right = r.glyph ? `${r.glyph} ${r.label ?? ""}` : "";
  return line({ t: left, tone: r.dim ? "dim" : undefined }, { t: pad }, { t: tag, tone: "accent" }, { t: grade, tone: "ok" }, { t: right, tone: "dim" });
}

/** One output entry as lines. Portrait and heatmap entries become a placeholder line. */
function flatten(o: Out): OgLine[] {
  switch (o.kind) {
    case "text":
      return [plain(o.text, o.accent ? "accent" : o.dim ? "dim" : undefined)];
    case "parts":
      return [o.parts.map((p) => ({ t: p.text, tone: (p.tone === "green" ? "ok" : p.tone) as OgTone | undefined }))];
    case "qr":
      return o.lines.map((l) => plain(l));
    case "links": {
      const right = `${o.prefix ?? ""}${o.items.map((i) => i.label).join(" · ")}`;
      const tail: OgRun[] = [];
      if (o.prefix) tail.push({ t: o.prefix, tone: "dim" });
      o.items.forEach((i, k) => {
        if (k) tail.push({ t: " · ", tone: "dim" });
        tail.push({ t: i.cmd ? i.label : i.label, tone: "accent" });
      });
      if (o.lead) {
        const room = Math.max(8, OG_COLS - right.length - 1);
        return [line({ t: fit(o.lead, room).padEnd(room + 1) }, ...tail)];
      }
      return [tail];
    }
    case "files":
      return o.inline ? [plain(o.items.map((i) => (i.type === "dir" ? `${i.name}/` : i.name)).join("   "), "accent")] : o.items.map((i) => line({ t: i.meta ?? "", tone: "dim" }, { t: i.name, tone: "accent" }));
    case "cal":
      return [plain(o.title), plain("Su Mo Tu We Th Fr Sa", "dim"), ...o.weeks.map((w) => plain(w.map((d) => (d === null ? "  " : String(d).padStart(2))).join(" ")))];
    case "portrait":
      return [plain("[portrait]", "dim")];
    case "neofetch":
      return o.rows.map((r, i) => plain(r, i === 0 ? "accent" : undefined));
    case "link":
      return [plain(o.label, "accent")];
    case "run":
      return [plain(o.text, "accent")];
    case "menu":
      return o.rows.map((r, i) => line({ t: `${String(i + 1).padStart(2)}) `, tone: "dim" }, { t: fit(r.label, 14).padEnd(14), tone: "accent" }, { t: fit(r.line, OG_COLS - 18), tone: "dim" }));
    case "timeline":
      return o.rows.map((r) => ("head" in r ? plain(r.head, "dim") : timelineLine(r)));
    case "arch":
      return [plain(`${o.title} · ${o.edges.length} connections`, "accent"), ...o.notes.slice(0, 2).map((n) => plain(n, "dim"))];
    case "fit":
      return [plain(o.verdict, "accent"), plain(`matched (${o.matched.length}): ${o.matched.join(" · ")}`, "ok"), plain(`not yet (${o.notYet.length}): ${o.notYet.join(" · ")}`, "dim")];
    case "banner":
      return [plain(o.welcome, "accent"), ...o.overview.map((l) => plain(l))];
  }
}

/** Runs the command and returns at most OG_MAX_LINES lines (with an overflow line when it was longer). */
export function ogLines(data: TerminalData, cmd: string): OgLine[] {
  const shell = createShell(data);
  const r = shell.run(cmd, initialShellState([]), { cols: OG_COLS });
  let lines = r.lines.flatMap(flatten);
  if (!lines.length && r.effect?.kind === "open-view") {
    const id = r.effect.id;
    const v = data.views.find((x) => x.id === id);
    lines = [plain(`entering view: ${v?.name ?? id}`, "accent"), plain(v?.line ?? "", "dim"), plain("")];
  }
  if (!lines.length) lines = [plain("(no output)", "dim")];
  if (lines.length > OG_MAX_LINES) {
    const more = lines.length - (OG_MAX_LINES - 1);
    lines = [...lines.slice(0, OG_MAX_LINES - 1), plain(`… (${more} more line${more === 1 ? "" : "s"} · open the terminal)`, "dim")];
  }
  return lines;
}

/** A one-line description of a command's output (plain text, at most 160 characters): its first real line, else its `desc`. */
export function ogDescription(data: TerminalData, cmd: string): string {
  const shell = createShell(data);
  const r = shell.run(cmd, initialShellState([]), { cols: OG_COLS });
  for (const l of r.lines.flatMap(flatten)) {
    const t = l.map((x) => x.t).join("").replace(/\s+/g, " ").trim();
    if (t.length >= 12 && !t.startsWith("──") && !t.startsWith("[")) return t.length > 160 ? `${t.slice(0, 159)}…` : t;
  }
  const name = cmd.split(" ")[0];
  return shell.commands.find((c) => c.name === name)?.desc ?? "Ratul Roy's portfolio, as a terminal.";
}

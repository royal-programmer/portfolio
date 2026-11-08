/**
 * The Engineer terminal's file system (17-persona-views.md §6.2): a virtual tree built from
 * `TerminalData`. Pure: no React, no DOM, so it can be tested on its own.
 *
 *   /home/ratulroy (~)   about  stack  uptime  contact  resume/  projects/  writing/  views/
 */
import type { TerminalData } from "@/lib/site/terminal-data";

export const USER = "ratulroy";
export const HOME = `/home/${USER}`;

export type EntryKind = "file" | "dir" | "exec";
export type FsEntry = { name: string; kind: EntryKind; size: number };

type Node =
  | { kind: "dir"; children: string[] }
  | { kind: "file"; lines: string[] }
  | { kind: "exec"; lines: string[]; id: string };

export type Fs = { nodes: Map<string, Node> };

/** Markdown shown as plain text: markers stripped, structure (paragraphs, list dashes) kept. */
export function plainText(md: string): string[] {
  return md
    .replace(/\r/g, "")
    .replace(/```[a-z]*\n?/gi, "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(^|[^*\w])\*(?!\s)([^*]+)\*/g, "$1$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^\s*[*+]\s+/, "- ")
        .trimEnd(),
    );
}

export function buildFs(data: TerminalData): Fs {
  const nodes = new Map<string, Node>();
  const add = (path: string, node: Node) => nodes.set(path, node);
  const about = plainText(data.about).filter((l, i, a) => l || (i > 0 && a[i - 1]));
  add(`${HOME}/about`, { kind: "file", lines: about.length ? about : [data.who] });
  add(`${HOME}/stack`, { kind: "file", lines: [...data.stack] });
  add(`${HOME}/uptime`, { kind: "file", lines: [data.uptime] });
  add(`${HOME}/contact`, { kind: "file", lines: data.contact.map((c) => `${c.label}  ${c.href}`) });

  for (const p of data.projects) {
    const lines = [p.title];
    if (p.year) lines.push(`year   ${p.year}`);
    if (p.role) lines.push(`role   ${p.role}`);
    if (p.stack.length) lines.push(`stack  ${p.stack.join(" · ")}`);
    if (p.summary) lines.push("", p.summary);
    lines.push("");
    if (p.repoUrl) lines.push(`repo ↗ ${p.repoUrl}`);
    if (p.deployedUrl) lines.push(`live ↗ ${p.deployedUrl}`);
    lines.push(`open ${p.slug}  → the project page`);
    add(`${HOME}/projects/${p.slug}.md`, { kind: "file", lines });
  }
  add(`${HOME}/projects`, { kind: "dir", children: data.projects.map((p) => `${p.slug}.md`) });

  for (const p of data.posts) {
    const lines = [p.title];
    if (p.date) lines.push(p.date);
    lines.push("", ...plainText(p.body), "", `open ${p.slug}  → the post`);
    add(`${HOME}/writing/${p.slug}.md`, { kind: "file", lines });
  }
  add(`${HOME}/writing`, { kind: "dir", children: data.posts.map((p) => `${p.slug}.md`) });

  for (const v of data.views) add(`${HOME}/views/${v.id}`, { kind: "exec", id: v.id, lines: [`${v.id}  ${v.line}`, `run: open ${v.id}`] });
  add(`${HOME}/views`, { kind: "dir", children: data.views.map((v) => v.id) });

  const r = data.resume;
  const resumeFiles: Record<string, string[]> = {
    summary: [r.name, r.title, r.location, "", r.summary],
    experience: r.experience.flatMap((x, i) => [
      ...(i ? [""] : []),
      `${x.role} · ${x.company} · ${x.period}`,
      x.headline,
      ...x.bullets.map((b) => `• ${b}`),
    ]),
    skills: r.skills.flatMap((g, i) => [...(i ? [""] : []), g.group, g.items.join(" · ")]),
    projects: r.personalProjects.flatMap((p, i) => [...(i ? [""] : []), `${p.name} · ${p.status}`, p.line, ...(p.url ? [p.url] : [])]),
    certifications: r.certifications.flatMap((c, i) => [...(i ? [""] : []), c.issuer, c.line, ...(c.items ?? []).map((t) => `  • ${t}`)]),
    education: r.education.flatMap((e, i) => [...(i ? [""] : []), `${e.degree} · ${e.school} · ${e.year}`, ...(e.note ? [e.note] : [])]),
  };
  for (const [name, lines] of Object.entries(resumeFiles)) add(`${HOME}/resume/${name}`, { kind: "file", lines });
  add(`${HOME}/resume`, { kind: "dir", children: Object.keys(resumeFiles) });

  add("/", { kind: "dir", children: ["home"] });
  add("/home", { kind: "dir", children: [USER] });
  add(HOME, { kind: "dir", children: ["about", "stack", "uptime", "contact", "resume", "projects", "writing", "views"] });
  return { nodes };
}

/**
 * Absolute, normalised path for `input` typed in `cwd`. `~` and `~/x` are home; `..` climbs as far
 * as `/`. Anything else is a plain path (`/engineer` no longer exists).
 */
export function resolvePath(cwd: string, input: string): string {
  let raw = input.trim();
  if (!raw || raw === "~") return HOME;
  if (raw.startsWith("~/")) raw = `${HOME}/${raw.slice(2)}`;
  const abs = raw.startsWith("/") ? raw : `${cwd}/${raw}`;
  const out: string[] = [];
  for (const part of abs.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return `/${out.join("/")}`;
}

/** `dir` + `name`, without doubling the slash at the root. */
export const join = (dir: string, name: string) => (dir === "/" ? `/${name}` : `${dir}/${name}`);

export function stat(fs: Fs, path: string): EntryKind | null {
  return fs.nodes.get(path)?.kind ?? null;
}

const sizeOf = (n: Node) => (n.kind === "dir" ? n.children.length : n.lines.join("\n").length);

/** Entries of a directory (dirs first, as `ls --group-directories-first`), or null if it is not one. */
export function listDir(fs: Fs, path: string): FsEntry[] | null {
  const n = fs.nodes.get(path);
  if (!n || n.kind !== "dir") return null;
  const entries = n.children.map((name): FsEntry => {
    const c = fs.nodes.get(join(path, name))!;
    return { name, kind: c.kind, size: sizeOf(c) };
  });
  return [...entries.filter((e) => e.kind === "dir"), ...entries.filter((e) => e.kind !== "dir")];
}

/** Lines of a file or executable, or null for a directory or a missing path. */
export function readFile(fs: Fs, path: string): string[] | null {
  const n = fs.nodes.get(path);
  return n && n.kind !== "dir" ? n.lines : null;
}

/** Completion candidates for the path being typed: names in the directory part, as typed. */
export function complete(fs: Fs, cwd: string, partial: string): string[] {
  const slash = partial.lastIndexOf("/");
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const leaf = slash >= 0 ? partial.slice(slash + 1) : partial;
  const dir = dirPart ? resolvePath(cwd, dirPart) : cwd;
  const entries = listDir(fs, dir);
  if (!entries) return [];
  return entries
    .filter((e) => e.name.toLowerCase().startsWith(leaf.toLowerCase()))
    .map((e) => `${dirPart}${e.name}${e.kind === "dir" ? "/" : ""}`);
}

/** The path as a prompt would show it: `~`, `~/projects`. */
export function shortPath(path: string): string {
  return path === HOME ? "~" : path.startsWith(`${HOME}/`) ? `~/${path.slice(HOME.length + 1)}` : path;
}

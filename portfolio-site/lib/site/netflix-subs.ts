/**
 * Subtitles for the Netflix view (17-persona-views.md §7, N8): when CC is on and the terminal speaks Bengali or
 * Hindi, a typed line gets a translated line under it, from the terminal's own strings and its translated
 * data lines. Only what has a translation is subtitled; episode titles and synopses are data and stay English.
 */
import { t, type StringKey } from "@/lib/site/terminal-strings";

export type SubLang = "bn" | "hi";
/** What the translated facts come from: the English uptime line and each language's version of it and of the status. */
export type SubData = { uptime: string; i18n: Record<SubLang, { uptime: string; status: string }> };
/** One typed line and, when there is one, its subtitle. */
export type NfLine = { text: string; sub?: string };

export const LANG_LABEL: Record<SubLang, string> = { bn: "বাং", hi: "हि" };
export const CC_LANG_KEY = "xp-term-lang";
export const CC_HINT = "CC off · pick lang bn or hi in the terminal";

export const subLangOf = (raw: string | null | undefined): SubLang | null => (raw === "bn" || raw === "hi" ? raw : null);

const parts = (s: string) => s.split(" · ").map((p) => p.trim());

/** A hero fact's subtitle: the same position in the translated uptime line (facts that are counts have none). */
export function factSub(fact: string, data: SubData, lang: SubLang): string | undefined {
  const i = parts(data.uptime).indexOf(fact);
  return i >= 0 ? parts(data.i18n[lang].uptime)[i] : undefined;
}

export const statusSub = (data: SubData, lang: SubLang) => `${t("nf.status", lang)}: ${data.i18n[lang].status}.`;
export const latestSub = (title: string, lang: SubLang, before = false) => `${t(before ? "nf.before" : "nf.latest", lang)}: ${title}.`;
export const nextSub = (lang: SubLang) => t("nf.next", lang);
export const seasonSub = (year: number, n: number, lang: SubLang) => t("nf.season", lang)(String(year), n);

/** The modal teleprompter's subtitle: the branch and "season · episode" in words. */
export function epSub(tone: string, season: number | undefined, n: number | undefined, lang: SubLang): string {
  const branch = t(`nf.b.${tone}` as StringKey, lang) as string;
  return season != null && n != null ? `${branch} · ${t("nf.ep", lang)(season, n)}` : branch;
}

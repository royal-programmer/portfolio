/**
 * The terminal follows the visitor's clock (17-persona-views.md §14): the band for their local hour picks a
 * theme (only while they have chosen none), a greeting and a hint. Pure and client-side: the caller passes the
 * `Date`, so a test can stub the hour.
 */
import type { TermClock, TermClockBand } from "@/lib/site/terminal-data";
import type { Lang, TerminalStrings } from "@/lib/site/terminal-strings";

export const THEME_AUTO_KEY = "xp-term-theme-auto";

/** `HH:mm`, 24-hour, in the visitor's zone: the screensaver and `now` share it. */
export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** The hour and minute on the owner's clock (Bengaluru), whatever the visitor's zone. */
export function hmIn(d: Date, tz: string): { h: number; m: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return { h: get("hour") % 24, m: get("minute") };
  } catch {
    return { h: d.getUTCHours(), m: d.getUTCMinutes() };
  }
}

/** The band for this hour; with no bands in the data (before the records are imported) a neutral one that changes nothing. */
const NEUTRAL_BAND: TermClockBand = { id: "day", from: 0, to: 24, theme: "accent", greet: "", hint: "" };
export const bandFor = (clock: TermClock, hour: number): TermClockBand => clock.bands.find((b) => hour >= b.from && hour < b.to) ?? clock.bands[0] ?? NEUTRAL_BAND;
export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** The greeting and hint for this moment: English from the data, bn and hi from the strings; the weekend wins over the band. */
export function clockCopy(clock: TermClock, d: Date, lang: Lang, S: TerminalStrings): { band: TermClockBand; greet: string; hint: string } {
  const band = bandFor(clock, d.getHours());
  const key = isWeekend(d) ? "weekend" : band.id;
  const src = isWeekend(d) ? clock.weekend : band;
  return lang === "en" ? { band, greet: src.greet, hint: src.hint } : { band, greet: S[`clock.${key}.greet` as "clock.day.greet"], hint: S[`clock.${key}.hint` as "clock.day.hint"] };
}

/** The time as the terminal says it: 12-hour with am/pm in English, 24-hour in bn and hi. */
export const say = (S: TerminalStrings, lang: Lang, h: number, m: number) => S["clock.time"](h, m, lang === "en");

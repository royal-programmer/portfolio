/**
 * Every setting's default: TODAY'S CODE VALUES, imported from where they live (never retyped), so the
 * site is identical before the table exists, while a key has no row, and after a bad edit is rejected.
 * Server and client safe (plain data). `scripts/settings-roundtrip.mjs` proves each one parses.
 */
import { PERSONA_VIEWS } from "@/lib/content/views";
import type { PersonaSlug } from "@/lib/content/types";
import { HUB_COPY, PERSONA_IDENTITY_SOURCE } from "@/lib/site/brand";
import { NETFLIX_PROFILES, NF_ADJECTIVES } from "@/lib/site/netflix-data";
import { LEGACY } from "@/lib/site/legacy-content";
import { fromDb } from "@/lib/content/source";
import { ARCH, CLOCK, DEFAULT_TERMINAL, HIRING, I18N, PROJECT_ARCH, RESUME, TIMELINE, TIMELINE_PERIODS } from "@/lib/site/terminal-data";
import { THEME_PALETTES } from "@/lib/site/terminal-themes";
import type { SettingKey, Settings } from "./schema";

const personaCopy = (slug: PersonaSlug): Settings["personas.copy"]["engineer"] => {
  const { role, handle, phrases, cta } = PERSONA_IDENTITY_SOURCE[slug];
  return { role, ...(handle ? { handle } : {}), phrases: [...phrases], cta };
};

export const DEFAULTS: Settings = {
  identity: { name: "Ratul Roy", email: HUB_COPY.email },
  "personas.copy": {
    engineer: personaCopy("engineer"),
    trader: personaCopy("trader"),
    photographer: personaCopy("photographer"),
    ride: personaCopy("ride"),
    artist: personaCopy("artist"),
    gamer: personaCopy("gamer"),
  },
  "hub.copy": {
    headline: HUB_COPY.headline,
    intro: HUB_COPY.intro,
    throughTitle: HUB_COPY.throughTitle,
    moreTitle: HUB_COPY.moreTitle,
    closingTitle: HUB_COPY.closingTitle,
    closingBody: HUB_COPY.closingBody,
    character: [...HUB_COPY.character],
  },
  "engineer.terminal": DEFAULT_TERMINAL,
  // Under db the lists are records; the setting then carries only the header (empty until the import).
  "engineer.resume": (fromDb ? { name: "", title: "", location: "", summary: "", personalProjects: [] } : RESUME) as Settings["engineer.resume"],
  "engineer.hiring": HIRING,
  "engineer.clock": CLOCK,
  "engineer.i18n": I18N,
  "engineer.timeline": { entries: TIMELINE, periods: TIMELINE_PERIODS },
  "engineer.arch": { diagrams: ARCH, projectArch: PROJECT_ARCH },
  "engineer.views": { views: [...(PERSONA_VIEWS.engineer ?? [])], defaultView: "stage" },
  "engineer.themes": { palettes: THEME_PALETTES as Settings["engineer.themes"]["palettes"] },
  "site.switches": {
    xpDefault: "auto",
    analytics: { enabled: false, provider: "none", id: "" },
    leadForm: true,
    maintenance: { enabled: false, message: "Back in a moment." },
  },
  netflix: { profiles: [...NETFLIX_PROFILES], adjectives: NF_ADJECTIVES, ...(fromDb ? {} : { bookCall: LEGACY.BOOK_CALL }) },
};

export const defaultFor = <K extends SettingKey>(key: K): Settings[K] => DEFAULTS[key];

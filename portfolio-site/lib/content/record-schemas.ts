/**
 * Zod schemas for the `data` column of each engineer record type, and for the story and media a project
 * carries (round 24). The TypeScript shapes are in `types.ts` (the content contract); a schema here must
 * accept exactly that shape. Pure (no server imports): the importer, the readers and the tests share it.
 */
import { z } from "zod";
import type { EntryDataMap, RecordType } from "./types";

const str = (max = 200) => z.string().max(max);
const long = (max = 2000) => z.string().max(max);
const ym = () => z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM");
const date = () => z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "YYYY-MM (or YYYY-MM-DD)");
const href = () => z.string().min(1).max(500).regex(/^(https?:\/\/|mailto:|\/)/, "https://, mailto: or a /path");
const slugList = () => z.array(str(80)).max(40).optional();

export const periodSchema = z.strictObject({ start: ym(), end: z.union([ym(), z.literal("present")]) });

const skillItem = z.strictObject({ name: str(60), projects: slugList(), experience: slugList(), certifications: slugList() });
const eventShape = { date: date(), subject: str(240), body: z.array(long(300)).max(8).optional(), branch: z.enum(["main", "side", "learn", "life"]), tag: str(40).optional(), grade: str(40).optional() };

export const projectStorySchema = z.strictObject({
  description: long(400).optional(),
  audience: long(300).optional(),
  problem: long(800).optional(),
  beats: z.array(z.strictObject({ text: long(300), clip: str(40).optional(), clipMs: z.number().int().min(500).max(60000).optional() })).max(8).optional(),
  status: z.enum(["in-development", "live", "live-building"]).optional(),
});

export const projectMediaSchema = z.strictObject({
  poster: z.strictObject({ src: str(300), w: z.number().int().positive(), h: z.number().int().positive(), alt: str(200) }),
  screens: z.array(z.strictObject({ id: str(40), label: str(120), src: str(300), w: z.number().int().positive(), h: z.number().int().positive() })).max(24),
  clips: z.array(z.strictObject({ id: str(40), label: str(120), poster: str(300), src: str(300) })).max(24),
});

export const RECORD_SCHEMAS = {
  experience: z.strictObject({ company: str(80), role: str(80), period: periodSchema, headline: long(400), bullets: z.array(long(400)).max(24) }),
  education: z.strictObject({ degree: str(160), school: str(160), period: periodSchema, note: str(120).optional() }),
  certification: z.strictObject({ issuer: str(80), line: long(300), items: z.array(str(120)).max(30).optional(), verify: href().optional() }),
  skill_group: z.strictObject({ group: str(60), items: z.array(skillItem).max(60) }),
  timeline_event: z.strictObject(eventShape),
  milestone: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("event"), ...eventShape }),
    z.strictObject({ kind: z.literal("period"), label: str(160), from: date(), to: date().nullable(), grade: str(60).optional(), note: str(200).optional() }),
  ]),
  diagram: z.strictObject({
    title: str(80),
    line: str(240).optional(),
    nodes: z.array(z.strictObject({ id: str(30), label: str(40), kind: z.enum(["ui", "api", "db", "queue", "ext", "job"]) })).max(40),
    edges: z.array(z.tuple([str(30), str(30), str(40).optional()])).max(80),
    notes: z.array(long(300)).max(12),
    projects: z.array(str(60)).max(20),
  }),
  profile_link: z.strictObject({
    label: str(40),
    handle: str(80),
    href: href().optional(),
    group: z.enum(["code", "learn", "work", "social"]),
    live: z.enum(["github", "stackoverflow", "leetcode", "holopin", "hackerrank"]).optional(),
    note: str(200).optional(),
    optional: z.boolean().optional(),
    contact: z.strictObject({ label: str(40), rank: z.number().int().min(0).max(100), group: z.enum(["elsewhere"]).optional() }).optional(),
  }),
} as const satisfies { [K in RecordType]: z.ZodType<EntryDataMap[K]> };

/** Parse a record's `data`; `null` when it does not satisfy its schema (the reader then skips the row). */
export function parseRecordData<K extends RecordType>(type: K, raw: unknown): EntryDataMap[K] | null {
  const r = RECORD_SCHEMAS[type].safeParse(raw);
  return r.success ? (r.data as EntryDataMap[K]) : null;
}

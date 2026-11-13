"use client";

/**
 * "Skim in 30 seconds" (17-persona-views.md section 29): the three things a recruiter should see first, as one slim
 * strip under the hero. The titles are data (`netflix.skim`, default the profile's featured trio); each opens its card.
 */
import type { NfItem } from "@/lib/site/netflix-data";

export function NetflixSkim({ ids, index, onOpen }: { ids: string[]; index: Map<string, NfItem>; onOpen: (item: NfItem) => void }) {
  const items = ids.map((id) => index.get(id)).filter((i): i is NfItem => !!i);
  if (!items.length) return null;
  const name = (i: NfItem) => (i.kind === "episode" ? i.e.title : i.kind === "skill" ? i.s.name : i.c.title);
  return (
    <aside className="nf-skim" aria-label="Skim in 30 seconds">
      <b>Skim in 30 seconds</b>
      {items.map((i, n) => (
        <button key={i.id} type="button" data-nf-card={i.id} onClick={() => onOpen(i)}>
          {n + 1}. {name(i)}
        </button>
      ))}
    </aside>
  );
}

"use client";

/**
 * The 404 for anything under a persona route. An unknown first segment on the hub is a mistyped
 * persona and gets the playful page; on a persona's own host (or deeper in a path) it is just a
 * missing page, so the copy stays plain.
 */
import { usePathname } from "next/navigation";
import { HubLink, PersonaLink, useOrigin } from "@/lib/site/persona-link";
import { parseHost } from "@/lib/site/hosts";
import { InvalidPersonaView } from "./invalid-persona-view";

export default function PersonaNotFound() {
  const segments = (usePathname() ?? "").split("/").filter(Boolean);
  const origin = useOrigin();
  const onPersonaHost = origin ? parseHost(new URL(origin).host).kind === "persona" : false;
  if (segments.length === 1 && !onPersonaHost) return <InvalidPersonaView attempted={segments[0]} />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-60">404</p>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">That page isn&apos;t here.</h1>
      <p className="max-w-md opacity-70">It may have moved, or it was never published.</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <HubLink className="inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium">Back home</HubLink>
        <PersonaLink persona="engineer" className="inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium">
          Engineer
        </PersonaLink>
      </div>
    </main>
  );
}

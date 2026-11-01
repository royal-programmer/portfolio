import type { Metadata } from "next";
import { listEntries } from "@/lib/content";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "../actions";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "Capture — Admin", robots: { index: false } };

// Always render fresh (auth-gated, shows just-created entries).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const entries = await listEntries("engineer", { includeNonPublic: true });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Capture — Admin</h1>
          <p className="mt-1 text-sm text-neutral-400">Engineer projects</p>
        </div>
        <form action={signOut}>
          <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm">
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          Existing ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">No projects yet. Create your first below.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-sm"
              >
                <span>
                  {e.title} <span className="text-neutral-500">/{e.slug}</span>
                </span>
                <span className="text-xs uppercase text-neutral-500">{e.visibility}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          New project
        </h2>
        <ProjectForm />
      </section>
    </main>
  );
}

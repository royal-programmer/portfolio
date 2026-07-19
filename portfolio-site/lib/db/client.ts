/**
 * Supabase client factories.
 *
 * Two clients, two trust levels:
 *   - `publicClient()`  — anon key, RLS-enforced. Safe anywhere (server reads
 *     of public content). Can only ever see non-private rows.
 *   - `adminClient()`   — service_role key, BYPASSES RLS. SERVER-ONLY. Used by
 *     server actions / capture surfaces after the app has authenticated the
 *     admin. Guarded so it can never run in the browser.
 *
 * The service_role key is read from a non-NEXT_PUBLIC env var, so it is never
 * bundled for the client — the `window` guard is a second line of defence.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the public (anon) Supabase env is configured. */
export function hasSupabaseEnv(): boolean {
  return Boolean(url && anonKey);
}

/** Anon client — respects RLS. Use for public reads. */
export function publicClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase public env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/** Service-role client — bypasses RLS. SERVER-ONLY. */
export function adminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("adminClient() must never run in the browser.");
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

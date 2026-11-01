/**
 * Browser Supabase client (session-bound).
 *
 * Used ONLY for direct-to-storage uploads from the admin capture UI: the
 * browser streams the ORIGINAL straight to Supabase Storage, bypassing the
 * Next/Vercel serverless request-body limit (~4.5MB). The upload is authorized
 * by the logged-in admin's session cookie + storage RLS (`is_admin()`), so no
 * service-role key ever reaches the browser.
 *
 * Reads/writes only the anon key (public) — safe to bundle for the client.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase public env missing (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY).");
  }
  cached ??= createBrowserClient(url, anonKey);
  return cached;
}

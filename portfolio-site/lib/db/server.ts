/**
 * Cookie-bound Supabase server client (auth-aware, RLS-enforced).
 *
 * Unlike `publicClient()`/`adminClient()` in `client.ts`, this reads the
 * request's auth cookies via `@supabase/ssr`, so queries run AS THE LOGGED-IN
 * USER. RLS therefore applies with that user's role — the admin write path uses
 * this (D18), so even content entry is gated by `is_admin()` at the database.
 *
 * Server-only (uses `next/headers`). Never import into a Client Component.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accessAllows } from "@/lib/admin/access-gate";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Session-bound client. Reads/writes the request's Supabase auth cookies. */
export async function getServerClient(): Promise<SupabaseClient> {
  if (!url || !anonKey) {
    throw new Error("Supabase public env missing (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY).");
  }
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` was called from a Server Component, where cookies are
          // read-only. Safe to ignore — session refresh happens in the auth
          // callback route and Server Actions where cookies are writable.
        }
      },
    },
  });
}

/** The currently authenticated user, or null. */
export async function getUser() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * True if the current user is a registered admin. Relies on the `admins`
 * self-read RLS policy (0006), so a user can confirm their OWN admin row but
 * cannot enumerate other admins.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  // Cloudflare Access (when configured) is the first lock: its token's email must be this admin's.
  if (!(await accessAllows(user.email))) return false;
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/auth";
import { getServerClient } from "@/lib/db/server";

/**
 * Lands the magic link: exchanges the `code` (PKCE) or the `token_hash` + `type` (OTP template variant)
 * for a session cookie, then goes on to `next` (default /admin). Any failure returns to the login page
 * with a short message and no detail about why.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const to = safeNext(searchParams.get("next")) ?? "/admin";
  const fail = (msg: string) => NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent(msg)}`, origin));

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  try {
    const supabase = await getServerClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && type
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : { error: new Error("missing") };
    if (error) return fail("That sign-in link is invalid or has expired.");
  } catch {
    return fail("Sign-in failed. Try again.");
  }
  return NextResponse.redirect(new URL(to, origin));
}

/**
 * The draft preview switch. An admin presses "Preview site" in /admin; `app/admin/preview/route.ts`
 * (admin-checked) sets this cookie on the shared root domain, so the hub and the persona hosts all see
 * it. The value is `<expiry>.<hmac>`, signed with the service-role key: a visitor cannot forge one, and
 * checking it needs no database call. Server-only (node:crypto, next/headers).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { PREVIEW_COOKIE } from "./schema";

const TTL_SECONDS = 30 * 60;

function sign(exp: number): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`xp-preview.${exp}`).digest("hex");
}

/** A fresh cookie value, valid for 30 minutes; null when the server has no signing key. */
export function makePreviewValue(): { value: string; maxAge: number } | null {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const sig = sign(exp);
  return sig ? { value: `${exp}.${sig}`, maxAge: TTL_SECONDS } : null;
}

export function verifyPreviewValue(value: string | undefined): boolean {
  if (!value) return false;
  const [expRaw, sig = ""] = value.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const good = sign(exp);
  if (!good || sig.length !== good.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

/** True when this request carries a valid admin preview cookie. */
export async function previewActive(): Promise<boolean> {
  try {
    return verifyPreviewValue((await cookies()).get(PREVIEW_COOKIE)?.value);
  } catch {
    return false;
  }
}

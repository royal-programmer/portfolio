import { headers } from "next/headers";
import { accessConfig, verifyAccessJwt } from "./access";

/**
 * Server-side half of the Cloudflare Access check, for `isAdmin()` (so every admin page, route handler
 * and server action is covered, not only the proxy). Returns true when the check is off (vars unset),
 * or when the request's Access token is valid and its email is the signed-in admin's email.
 */
export async function accessAllows(adminEmail: string | null | undefined): Promise<boolean> {
  const cfg = accessConfig();
  if (!cfg) return true;
  const token = (await headers()).get("cf-access-jwt-assertion");
  const r = await verifyAccessJwt(token, cfg);
  return r.ok && !!adminEmail && r.email === adminEmail.toLowerCase();
}

/**
 * Cloudflare Access defence in depth, with Web Crypto only (no dependency, runs in the proxy and in
 * server actions). When `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are both set, every admin request
 * must carry a valid `Cf-Access-Jwt-Assertion`: an RS256 signature that checks out against the team's
 * JWKS (cached for an hour), the right `aud`, `iss` and a live `exp`. When they are unset nothing
 * here runs. The token is never logged and failure reasons are short codes, not token content.
 */

export type AccessConfig = { issuer: string; certsUrl: string; aud: string };
export type AccessResult = { ok: true; email: string } | { ok: false; reason: string };
type Jwk = { kid?: string; kty?: string; n?: string; e?: string; alg?: string };
type Jwks = { keys: Jwk[] };

/** `team` or `team.cloudflareaccess.com` (with or without https://) both name the same team. */
export function accessConfig(env: Record<string, string | undefined> = process.env): AccessConfig | null {
  const raw = (env.CF_ACCESS_TEAM_DOMAIN ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const aud = (env.CF_ACCESS_AUD ?? "").trim();
  if (!raw || !aud) return null;
  const host = raw.includes(".") ? raw : `${raw}.cloudflareaccess.com`;
  return { issuer: `https://${host}`, certsUrl: `https://${host}/cdn-cgi/access/certs`, aud };
}

export function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const parseJson = (bytes: Uint8Array): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_MIN_REFETCH_MS = 60 * 1000;
const jwksCache = new Map<string, { at: number; jwks: Jwks }>();

export function clearAccessCache() {
  jwksCache.clear();
}

async function defaultFetchJwks(url: string): Promise<Jwks> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  return (await res.json()) as Jwks;
}

async function keyFor(cfg: AccessConfig, kid: string, now: number, fetchJwks: (u: string) => Promise<Jwks>): Promise<Jwk | null> {
  const cached = jwksCache.get(cfg.certsUrl);
  const find = (j: Jwks | undefined) => j?.keys?.find((k) => k.kid === kid && k.kty === "RSA") ?? null;
  if (cached && now - cached.at < JWKS_TTL_MS) {
    const hit = find(cached.jwks);
    // An unknown kid may mean Cloudflare rotated the keys: refetch, but no more than once a minute.
    if (hit || now - cached.at < JWKS_MIN_REFETCH_MS) return hit;
  }
  const jwks = await fetchJwks(cfg.certsUrl);
  jwksCache.set(cfg.certsUrl, { at: now, jwks });
  return find(jwks);
}

export async function verifyAccessJwt(
  token: string | null | undefined,
  cfg: AccessConfig,
  opts: { fetchJwks?: (url: string) => Promise<Jwks>; now?: number } = {},
): Promise<AccessResult> {
  if (!token) return { ok: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !p || !/^[\w-]+$/.test(p))) return { ok: false, reason: "malformed" };
  const [h, p, s] = parts;
  try {
    const header = parseJson(b64urlToBytes(h));
    const payload = parseJson(b64urlToBytes(p));
    if (!header || !payload) return { ok: false, reason: "malformed" };
    if (header.alg !== "RS256" || typeof header.kid !== "string") return { ok: false, reason: "alg" };
    const nowMs = opts.now ?? Date.now();
    const jwk = await keyFor(cfg, header.kid, nowMs, opts.fetchJwks ?? defaultFetchJwks);
    if (!jwk) return { ok: false, reason: "kid" };
    const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!good) return { ok: false, reason: "signature" };
    const nowSec = Math.floor(nowMs / 1000);
    if (typeof payload.exp !== "number" || payload.exp + 30 < nowSec) return { ok: false, reason: "expired" };
    if (typeof payload.nbf === "number" && payload.nbf - 30 > nowSec) return { ok: false, reason: "not-yet" };
    if (payload.iss !== cfg.issuer) return { ok: false, reason: "iss" };
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(cfg.aud)) return { ok: false, reason: "aud" };
    if (typeof payload.email !== "string" || !payload.email) return { ok: false, reason: "email" };
    return { ok: true, email: payload.email.toLowerCase() };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** The plain page a failed check returns. */
export const ACCESS_DENIED_BODY = "Forbidden. This console is behind Cloudflare Access; sign in there first.";

# 06 — Security & Privacy

This is a public marketing site, so the attack surface is small — but the two API routes are the real surface, and both are unguarded stubs. There's also an *honesty*/privacy dimension worth taking seriously.

---

## Flaw 1 — `/api/lead` collects PII and does nothing safe with it

`app/api/lead/route.ts` validates name/email/reason, then:

```ts
console.log("lead_captured", { name, email, reason });
return NextResponse.json({ ok: true });
```

Problems:
- **The lead is lost.** It goes to a server log the user can't see and you won't check. From the visitor's side the UI says "Ratul will get back to you soon" — which is currently **false**. That's a broken promise to a real person who took the time to reach out.
- **No rate limiting.** Anyone can POST this endpoint in a loop. Even just `console.log` spam fills logs; once it's wired to email/DB it becomes a spam/cost vector.
- **No spam protection.** `docs/03` promises "honeypot + rate limiting" — neither exists. The 5-char `reason` minimum is not spam protection.
- **No request-size limit.** `await req.json()` will parse an arbitrarily large body. A 10 MB POST is accepted and processed.
- **PII with no policy.** You're collecting name + email + free-text reason with no retention statement, no consent note, and (once persisted) no defined storage location. For EU visitors that's a GDPR-shaped concern even at hobby scale.

**Fix:**
- Persist to something real (Supabase table, or an email via Resend/Postmark, or even a Slack/Discord webhook to yourself).
- Add rate limiting (Upstash Redis rate-limit, or Vercel's, keyed by IP).
- Add a honeypot field + a minimum-time-to-submit check, or a lightweight captcha (Cloudflare Turnstile).
- Cap body size; validate/normalize email server-side (you do regex — good — also trim/lowercase).
- Add a one-line privacy note near the contact form and a retention rule.

---

## Flaw 2 — The "AI Agent" is a honesty + expectations issue

`app/api/chat/route.ts` is a keyword `if/else` matcher, and `page.tsx` adds an artificial `CHAT_MIN_THINKING_MS` (880ms) delay plus a typing animation to *simulate* a model thinking. It's introduced to users as "**Ratul's AI assistant.**"

This isn't a security hole, but it's a **credibility risk on an engineer's portfolio**: the first technical visitor who asks anything off-script gets the canned fallback and instantly sees it's not AI. Faking the "thinking" delay makes it worse — it reads as deliberately misleading rather than "simple bot." Two honest paths:

1. **Make it real.** Wire `/api/chat` to the Claude API (Anthropic SDK) with a small system prompt grounded in your actual bio/projects, server-side, with the key in an env var (never `NEXT_PUBLIC_`). Add per-IP rate limiting and a token/length cap so it can't be abused into a free LLM proxy. This turns a liability into a genuine "look what I built" moment.
2. **Right-size the claim.** Call it a "Quick assistant" or "Contact helper," drop the fake thinking delay, and let it be an honest scripted concierge for links + contact.

Either is fine. "Fake AI with fake latency, labelled AI" is the one option to avoid.

---

## Flaw 3 — No security headers

`next.config.ts` is empty. Missing:
- **Content-Security-Policy** — even a modest one. Note you use `background-image` with remote Unsplash URLs and (if you add real AI) external API calls, so a CSP needs to be authored deliberately.
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors` (clickjacking).
- `poweredByHeader: false` to stop advertising `X-Powered-By: Next.js`.

**Fix:** add a `headers()` block in `next.config.ts` (or middleware). For a static-ish site this is a quick, high-signal hardening step and also nudges your security-header grade (securityheaders.com) which is the kind of thing a security-minded reviewer checks.

---

## Flaw 4 — Contact email is hardcoded in the client bundle

`ratul.arya.roy@gmail.com` appears in `site-content.ts` and `page.tsx` (and the chat route). It ships in client JS and is trivially scrapeable by spam harvesters. This is common and low-severity, but if it matters: route contact through the form/API and/or obfuscate the mailto. (Also: the email in `site-content.ts` `SOCIAL_LINKS` and the fallback string differ in one place vs the API — keep one source of truth.)

---

## Flaw 5 — No dependency / supply-chain hygiene

- No `npm audit` in any workflow, no Dependabot/Renovate config.
- Unusual pins worth a conscious check: `lucide-react@1.0.1` (verified installed, but confirm it's the intended package/version and not a namesquat — lucide's mainline has historically been `0.x`), and bleeding-edge `next@16.2.1` / `react@19.2.4`. Being this current is fine, but pin intentionally and watch for security advisories.
- Nothing runs `eslint`/`tsc` on commit or in CI, so a security-relevant lint rule can't catch anything (see [08](./08-concrete-flaws-and-bugs.md)).

---

## Privacy specifics for *this* project

- **Trader persona.** `docs/05` correctly flags this. If you ever show performance/P&L language, add a visible "educational, not financial advice" disclaimer and avoid publishing anything materially non-public. Currently the trader content is generic (safe), but the moment real numbers appear, this becomes load-bearing.
- **Analytics.** None today. When you add it, prefer a privacy-friendly option (Vercel Analytics, Plausible) and disclose it; avoid dropping Google Analytics cookies without a notice.

---

## Priority order

1. Make `/api/lead` actually deliver + add rate limiting + honeypot (stop breaking a real promise).
2. Decide the chat's honesty story (real AI *or* honest concierge; drop fake latency).
3. Add security headers + `poweredByHeader: false` in `next.config.ts`.
4. Add request-size limits and server-side normalization on both routes.
5. Add Dependabot/`npm audit` to CI once CI exists.

---

## What's already reasonable

- `/api/lead` at least validates name/email/reason before acting.
- Both routes `try/catch` and return safe error JSON rather than leaking stack traces.
- Secrets are correctly *absent* from the repo; `.gitignore` excludes `.env*`.
- The docs already anticipate honeypot/rate-limiting and env-var handling — the intent is documented, it just isn't built.

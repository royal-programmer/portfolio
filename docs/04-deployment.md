# Deployment

The production app is **`portfolio-site/`** — not the `docs/` folder.

## Prerequisites

- Node.js compatible with Next.js 16 and ESLint toolchain (see `portfolio-site/package.json` engines if added later).
- npm (project uses `package-lock.json`).

## Local commands

Run from **`Portfolio/portfolio-site/`**:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
**Do not** run `npm run dev` from `Portfolio/` root — there is no `package.json` there.

```bash
npm run build
npm run start
```

```bash
npm run lint
```

## Recommended host (free tier)

| Host | Role |
|------|------|
| **Vercel** | Zero-config Next.js deploy, preview URLs per branch |

### Vercel checklist

1. Push `portfolio-site` to a GitHub (or GitLab) repository — root of repo can be **`portfolio-site`** itself, or monorepo with **Root Directory** set to `portfolio-site` in Vercel project settings.
2. Import project in Vercel; framework **Next.js** auto-detected.
3. Production branch: e.g. `main`.
4. After first deploy, verify `/` loads, theme toggle works, persona switch works.

### Monorepo note

If the Git repo root is `Portfolio/` containing both `docs/` and `portfolio-site/`:

- In Vercel → Project → Settings → General → **Root Directory**: set to `portfolio-site`.

## Environment variables

- **None required** for the current static/easter-egg build.
- When Supabase, email API, or analytics are added, document each key in **`05-other-important-documentation.md`** (Environment variables section) and configure them in Vercel → Settings → Environment Variables (never commit secrets).

## Post-deploy smoke test

- [ ] Home loads; no console errors
- [ ] Light / dark / system theme
- [ ] Persona: logo hold 1× / 2× / 3×; Konami cycle; full **reload** returns Engineer
- [ ] Client navigation (after you add routes): persona persists without reload
- [ ] Background images load (Unsplash reachable) or swap to local `public/` assets if offline CDN blocked

## Rollback

- Use Vercel **Deployments** UI to promote a previous production deployment, or revert the Git commit and redeploy.

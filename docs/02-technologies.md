# Technologies

Applies to the application in [`../portfolio-site/`](../portfolio-site/). Versions reflect `package.json` at time of writing; re-check after `npm install` upgrades.

## Core stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Framework | **Next.js** (App Router) | `app/` directory, `layout.tsx`, `page.tsx` |
| Language | **TypeScript** | Strict typing for persona and theme tokens |
| UI styling | **Tailwind CSS v4** | `@import "tailwindcss"` in `globals.css` |
| Runtime | **React 19** | Client components where interactivity is required |

## Key dependencies (`portfolio-site/package.json`)

| Package | Role |
|---------|------|
| `next` | Routing, SSR/hydration, production build |
| `react`, `react-dom` | UI |
| `framer-motion` | Layout transitions, hero/background presence, persona flash |
| `lucide-react` | Icons |
| `react-type-animation` | Rotating typewriter roles per persona |

## Tooling

| Tool | Role |
|------|------|
| ESLint (`eslint`, `eslint-config-next`) | Linting |
| TypeScript | Type checking |

## Planned / optional (not installed yet)

| Technology | Typical use |
|------------|-------------|
| **Supabase** (or similar) | Contact submissions, optional content tables with `persona` column |
| **Vercel** | Hosting and preview deployments |
| Custom **Web Audio** or small `.mp3`/`.ogg` assets | Persona switch sound (queued feature) |

## External assets

- Hero / persona **background images** currently use **Unsplash** URLs (see `app/page.tsx`). Replace with self-hosted assets under `public/` when you want offline builds or stricter licensing control.

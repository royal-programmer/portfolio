# Portfolio site (Next.js)

Multi-persona portfolio app (**Engineer · Trader · Photographer**).  
**Product documentation** (objectives, checklist, deployment) lives one level up:

→ [`../docs/README.md`](../docs/README.md)

## Run locally

From this folder (`portfolio-site/`):

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Note:** Running `npm run` from the parent `Portfolio/` folder will fail — there is no `package.json` there.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

## Stack (summary)

Next.js (App Router), React, TypeScript, Tailwind CSS v4, Framer Motion, `react-type-animation`, Lucide icons. See [`../docs/02-technologies.md`](../docs/02-technologies.md).

---

*Below: default create-next-app reference (optional).*

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

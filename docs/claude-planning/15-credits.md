# 15 — Credits (third-party assets in the hub)

Everything in the VR journey is built in code except the logos and the one model below. Credits go in
the **browser console**, never on screen (D38). This file is the record.

## Logos (tool / language marks on the engineer's drifting panes)

Shown as "tools I use", unaltered. Product names and logos belong to their owners;
no affiliation. Copied into `portfolio-site/public/hub/icons/` by
`portfolio-site/scripts/hub-icons.mjs` (dev dependencies, nothing fetched at runtime).

| Source | Licence | Marks |
|--------|---------|-------|
| [simple-icons](https://simpleicons.org) 16.36.0 | CC0 1.0 | TypeScript, Next.js, React, Node.js, Python, .NET, Tailwind CSS, Three.js, Docker, Git, GitHub, PostgreSQL, Supabase, Vercel, Postman, Claude, Cursor, SAP |
| [devicon](https://devicon.dev) 2.18.0 | MIT | VS Code, C#, Java, Oracle, PowerShell, Azure |

simple-icons marks are monochrome paths; the script writes each brand's own colour
into the SVG (light ink where the brand colour is black, so it reads on dark glass).
devicon marks are the full-colour "original" versions.

## 3D models

Ratul's call (2026-11-05): a real bike beats a stylised one, and this is a personal,
non-commercial site, so CC-BY is fine with the credit in the console (and here, in
the public repo). Printed by `portfolio-site/lib/site/credits.ts` on the hub's first
mount, as a collapsed `credits` group.

| Model | Source | Licence | Use |
|-------|--------|---------|-----|
| Rider's bike (`public/hub/models/bike.glb`) | ["Motorcycle" by Poly by Google](https://poly.pizza/m/dse64pqMKAR), via Poly Pizza | CC BY 3.0 (also traced into line art for Normal mode: `app/components/hub/bike-lines.ts`) | Re-coloured in the setup's finishes (palette split by colour), fitted to 2.7 units, lit by the persona's light. 6.4 k triangles, 110 KB. |

Everything else — headset, planets, laptop, desks, camera, easel, kit — is built from
primitives in code.

## Fonts

Fraunces, Geist, Geist Mono via `next/font` (SIL Open Font License).

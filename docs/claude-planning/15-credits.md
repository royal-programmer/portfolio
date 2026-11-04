# 15 — Credits (third-party assets in the hub)

Everything in the VR journey is built in code except the logos below. Credits go in
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

None yet. The headset, the laptop, the planets, satellite and rocket are built from
primitives in code. If a CC0 model is ever used (Kenney, Quaternius, Poly Pizza CC0),
record its source and licence here and in the console credits.

## Fonts

Fraunces, Geist, Geist Mono via `next/font` (SIL Open Font License).

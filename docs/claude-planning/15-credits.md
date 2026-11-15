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

## Room assets (HDRI, glTF models, textures, audio samples; round 37d)

Every file under `portfolio-site/public/models`, `hdri`, `textures` and `audio` has a line here (CC0, or CC-BY with the credit);
`scripts/room3d-check.mjs` fails when one is missing. Assets are committed to the public repo, never loaded from a CDN.

| File | Source URL | Author | Licence | Downloaded | Notes |
|------|------------|--------|---------|------------|-------|
| `portfolio-site/public/hdri/unfinished_office_1k.exr` (911 KB) | https://polyhaven.com/a/unfinished_office | Sergej Majboroda (Poly Haven) | CC0 1.0 | 2026-11-15 | 1k EXR, image-based light for the medium and high tiers; the lightformers are the low tier and the fallback |
| `portfolio-site/public/models/plant.glb` (15.7 KB) | https://poly.pizza/m/bfLOqIV5uP | Quaternius | CC0 1.0 | 2026-11-15 | "Houseplant", low-poly, flat colours; `assets:optimise` (dedup, prune, weld, join); fitted to the plant object's height |
| `portfolio-site/public/audio/guitar/e2.ogg` (17 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/e2_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | E2, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/a2.ogg` (16 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/a2_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | A2, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/c3.ogg` (16 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/c3_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | C3, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/eb3.ogg` (16 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/eb3_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | Eb3, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/gb3.ogg` (16 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/gb3_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | F#3 (Gb3), mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/a3.ogg` (16 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/a3_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | A3, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/c4.ogg` (16 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/c4_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | C4, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/eb4.ogg` (17 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/eb4_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | Eb4, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/gb4.ogg` (19 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/gb4_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | F#4 (Gb4), mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/a4.ogg` (17 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/a4_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | A4, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |
| `portfolio-site/public/audio/guitar/c5.ogg` (16 KB) | https://github.com/sfzinstruments/karoryfer.emilyguitar (`notes/c5_mf_rr1.wav`) | Karoryfer Samples (Emily guitar) | CC0 1.0 | 2026-11-15 | C5, mezzo-forte, first round-robin; cut to 2.4 s, mono, 44.1 kHz, Vorbis q4, 0.5 s fade-out (ffmpeg); a clean guitar, used for the guitar app, pitch-shifted with `playbackRate` for the other notes |

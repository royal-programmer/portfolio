# Other important documentation

Supporting reference for behavior, structure, and future work. For the master index see [README.md](./README.md).

---

## 1. Repository and folder structure

```
Portfolio/
├── docs/                              # Product & engineering documentation (this folder)
│   ├── README.md
│   ├── 01-objectives.md
│   ├── 02-technologies.md
│   ├── 03-todo-and-checklist.md
│   ├── 04-deployment.md
│   └── 05-other-important-documentation.md
│
└── portfolio-site/                    # Next.js application
    ├── app/
    │   ├── globals.css                # Design tokens, persona + theme CSS variables
    │   ├── layout.tsx                 # Fonts, metadata, PersonaProvider wrapper
    │   ├── page.tsx                   # Home UI, persona UI, theme control, animations
    │   └── persona-provider.tsx       # Persona state, sessionStorage, navigation timing
    ├── public/                         # Static assets (expand for gallery, favicon)
    ├── package.json
    └── next.config.ts
```

---

## 2. Persona system (behavior spec)

| Persona | Default on full load | `data-persona` value |
|---------|----------------------|----------------------|
| Engineer | Yes (after reload / typical navigate) | `engineer` |
| Trader | Via easter egg or Konami | `trader` |
| Photographer | Via easter egg or Konami | `photographer` |

### Logo button (pointer)

- **1×** press within hold window + **hold** ~1.3s → **Engineer**
- **2×** quick presses + **hold** on last → **Trader**
- **3×** → **Photographer**
- **4×+** → still **Photographer** (capped)

### Konami sequence

- **↑ ↑ ↓ ↓ ← → ← → B A** — cycles **Engineer → Trader → Photographer → Engineer** (order defined in `PERSONA_ORDER` in code).

### Persistence (summary)

- Implemented in `persona-provider.tsx` using **Performance Navigation Timing** and **`sessionStorage`** key `portfolio-persona`.
- **Client-side navigation** (Next.js `<Link>`) keeps React state — persona unchanged until user triggers a switch or full reload policy applies.

---

## 3. Theme system

| Storage | Key | HTML attribute |
|---------|-----|----------------|
| `localStorage` | `ui-theme` | `data-ui-theme`: `light` \| `dark` \| omitted = system |

`globals.css` maps **persona × theme** to tokens (`--accent`, `--panel-*`, `--bg-overlay`, etc.).

---

## 4. Design tokens (high level)

Defined primarily in `portfolio-site/app/globals.css`:

- `--page-bg`, `--fg`, `--muted`, `--accent`, glows  
- `--control-*`, `--panel-*` , `--chip-*`, `--surface-*`  
- `--bg-image-opacity`, `--bg-overlay`  

Prefer extending tokens rather than hardcoding colors in JSX.

---

## 5. Assets and licensing

- Background URLs currently point to **Unsplash**. For production you may replace with **your own photography** or licensed stock under `public/` and reference via `/your-file.jpg`.
- Add a **credits** section if required by license.

---

## 6. Security and privacy (trader / personal data)

- Avoid publishing material non-public financial details unless intentional.
- Add a short **disclaimer** on trader-facing copy (educational / not financial advice) if you show methodology or performance language.
- Any future **contact form** should use HTTPS, rate limiting, and minimal PII retention.

---

## 7. Environment variables (future)

When added, list here and in Vercel:

| Variable | Purpose | Required in |
|----------|---------|-------------|
| *TBD* | e.g. `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview |
| *TBD* | e.g. secret server key (never `NEXT_PUBLIC_`) | Production only |

---

## 8. Glossary

| Term | Meaning |
|------|---------|
| Persona | One of engineer / trader / photographer “modes” |
| Easter egg | Hidden interaction (logo hold, Konami) |
| App Router | Next.js `app/` file-based routing |

---

## 9. Gaps and documentation debt

- [x] **`portfolio-site/README.md`** — points to `../docs/README.md` and local run instructions
- [ ] Document **sound design** once persona audio is implemented (formats, licensing, mute UX).
- [ ] **ADR folder** (`docs/adr/`) if architectural decisions multiply (optional).

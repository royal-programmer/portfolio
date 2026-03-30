# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog**, and this project follows **Semantic Versioning**.

## [Unreleased]

## [0.2.1] - 2026-03-28

### Added
- Persona **transition** flow: directional staggered motion slots, wash overlay, stinger/chain timing, and hooks (`usePersonaTransitionPrefs`, `usePersonaTransitionRunner`) with reduced-motion handling and a dock preference toggle.
- **Persona home body** layouts (trader calendar + graph strip, photographer gallery strip) extracted from the main page.

### Changed
- Header logo image crossfade interval set to **2s**; Konami persona cycle works while the persona dock is open.
- Slightly widened the post-stinger window for **persona chain** clicks.
- Trader backdrop image URL; trader theme **`--page-bg`** set to **transparent** so the fixed persona backdrop layer stays visible.

### Fixed
- **Overflow** clipping on `html`/`body` during persona transitions.
- **Enter animation** prepared off-screen to avoid a visible flash or double layout on persona switch.

## [0.2.0] - 2026-03-29

### Added
- Componentized home UI under `portfolio-site/app/components/` (hero, identity panel, projects grid, persona backdrop, typewriter, shared `site-content` / chat types).
- Bottom **bubble dock** with launcher; **preferences** popover (sound switch, compact theme control).
- **Agent chat panel** UI (messages, lead flow, quick actions, composer) with stub **`POST /api/chat`** and **`POST /api/lead`** routes.
- Circular **header logo**: 3D-style ring, **`R.jpg`** monogram and **cartoon avatar** crossfade loop (**2s** per image; respects `prefers-reduced-motion` with static avatar).
- Public assets: `R.jpg`, `profile-cartoon-avatar.png`.

### Changed
- Header trimmed to **avatar-only** control; theme, sound, and persona label pills removed from the top bar (available in dock prefs).
- Tighter **header and hero** vertical spacing; agent panel layout fixed after refactor (wrapper sizing vs inner absolute positioning).
- Prefs UI: switch-style sound, theme icons on one row with the “Theme” label.

### Fixed
- **Mobile** long-press on the header images no longer triggers the browser “save / open image” sheet (touch targeting on the button, `-webkit-touch-callout`, `draggable={false}`, context menu guard).

## [0.1.0] - 2026-03-26

### Added
- Multi-persona portfolio shell (Engineer, Trader, Photographer).
- Persona background images + readability overlay and glass “surface” panels.
- Easter egg persona triggers:
  - Logo press-and-hold sequence (1× Engineer, 2× Trader, 3× Photographer; capped).
  - Keyboard Konami code to cycle personas.
- Theme system: `system` / `light` / `dark` with modern glass control UI.
- Typewriter “I am a …” animation with persona-aware word lists.
- Documentation hub under `docs/` including objectives, tech stack, checklist, deployment, and release/versioning guide.

### Changed
- Replaced nested repository setup with a single repo rooted at `Portfolio/` (tracks `docs/` + `portfolio-site/`).


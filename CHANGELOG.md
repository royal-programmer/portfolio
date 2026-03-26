# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog**, and this project follows **Semantic Versioning**.

## [Unreleased]

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


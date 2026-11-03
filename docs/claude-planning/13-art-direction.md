# 13 — Art direction: the light journey

The bar every hub and world surface is held to (D36). It exists so the site
reads as *designed*, not generated. When in doubt, cut.

## Idea

You travel **as the light**. A beam falls from the sky, strikes a prism, and
splits. Each colour is a part of Ratul, with its own world on the horizon. At
the end everything folds back into one white light. Every visual is a piece of
that one idea. Nothing is decorative for its own sake.

## Type

- **Display:** Instrument Serif. Roman for statements, italic for the answer
  ("One mind. *Many perspectives.*"). Large, tight leading (0.9–0.95), slight
  negative tracking.
- **Text:** Geist Sans, at 1rem–1.125rem, in `--ink-dim`.
- **Labels and meta:** Geist Mono, 10–11px, uppercase, tracking 0.14–0.24em,
  in `--ink-faint`.
- Never more than three sizes on one screen, and no bold display type.

## Colour

- **Base:** void `#050507`–`#07070a` with warm-white ink `#f3f1ec`. No blue-black,
  no pure white text.
- **Colour comes only from the light.** Each persona's colour is its position
  on the one spectrum (`lib/site/spectrum.ts`).
- **Gradients exist only where light physically spreads:** the river and the beam
  haze. UI never gets gradients.

## Motion

- **Ease:** expo-out to settle (`--ease-out`). Moves that matter take
  1.1–1.5 s, hover 160 ms.
- **Text** rises out of a line mask, word by word. It never pops, bounces or
  spins. It goes back down when you scroll back.
- **Alive at rest.** Something is always moving slowly: photons, dust, the
  breath of the crystal and the camera. Nothing loops fast.
- **Cursor:** a near-instant dot and a short-trail ring. Lag reads as broken
  (Ratul's reference: noddal.xyz good, ysuriadesign.co laggy).
- **Scroll:** Lenis at lerp 0.14. Smooth, never floaty.

## Banned (AI-slop tells)

- Purple-to-blue hero gradients, gradient headline text, and glassmorphism
  card grids.
- Rows of pill "tag chips". Use mono lists with a coloured mark instead.
- Emoji, and the words "Unleash", "Elevate", "Seamless" or "Journey" in copy.
- Every section using the same layout, centred everything, and generic stock
  icons.
- Glow everywhere: glow belongs to light sources only.

## Performance is part of the look

- **Speed:** 60 fps on the visitor's chosen quality. Below that the governor
  steps the quality down, then *offers* Normal view. It never switches
  silently.
- **Normal view** tells the same story with motion, without WebGL. It is not
  a static fallback.

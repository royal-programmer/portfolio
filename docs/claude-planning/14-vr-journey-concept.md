# 14 — The VR journey (hub concept, D38)

Agreed with Ratul on 2026-11-03 over several rounds of discussion. This
**replaces** the round-1 "prism + river of colour" hub scene (D36's scene; the
gate, quality slider, governor, cursor, sound and Lenis/GSAP stack stay). Read
`13-art-direction.md` for the visual rules. Build plan at the bottom.

> Ratul's bar: "lifetime best website". This is his real portfolio, **not a
> demo**: no "coming soon", no teaser placeholders, no filler. Show only what
> is real, even if short.

## The flow (one continuous flight)

1. **Wear the headset (gate).** The site opens on a floating 3D VR headset in
   the dark (our own stylised design — no real product's look). Device
   analysis + quality slider (Performance · Balanced · Best) + Immersive /
   Normal choice live here (D36). Small "Best with sound" toggle (sound stays
   off by default). **Click the headset** → it rises to your face, the lenses
   fill the view, black, then open onto the sky.
2. **Night sky.** Full clear night sky all around. Far away, at the centre of
   the screen, a point of light. Hint: **"Press Space"** (phone: **"Tap"**).
3. **The light comes at you.** Slow at first, then accelerating; its diameter
   grows until it fills the screen. Mid-approach the hint **"Click and hold to
   slow down"** appears (hold = slow time). It hits **head-on, at 90° to the
   camera** — *you are the prism*. White flash.
4. **The J-split.** The light refracts into many colours; the camera moves
   *with* the light in a J-shaped path until it is looking almost straight up
   (~75–80°, not fully vertical). The colours spread out above in a gradient
   **cone**. Scroll is locked until this lands.
5. **The spiral climb (scroll starts here).** Scrolling flies the camera up and
   around inside the cone like climbing a spring. As it climbs, the camera
   **gradually tilts back to level**, so by the time objects arrive you are
   looking at them face-on.
6. **One continuous field, no hard sections.** Objects (screens, devices,
   icons, numbers, photos) **already exist in space**; only the camera moves.
   They fade in/out of darkness via fog, depth blur and vignette (reference:
   noddal.xyz — glass slabs with real content, slight colour fringe, depth of
   field). Personas **diffuse into each other** in series, each transition
   sharing a motif with the next (table below). The sky tint slides along the
   spectrum continuously, never jumping.
7. **Each persona peaks in an assembly.** Loose objects gather into one setup,
   which **powers on**; while lit it is a **doorway**: click (tap) it and the
   camera flies into its screen / viewfinder and that persona's world opens
   (this is D37's portal). Scrolling on, it powers off and the parts scatter
   into the next persona's objects.
8. **Ending.** The colours fade away; the camera tilts up again into an empty,
   clear night sky with one small line: **"Take off your headset"**. Clicking
   plays a **quick reverse rewind** back to the initial headset screen.

**No HUD text.** No noddal-style "QUEUE: …" status lists, no persona index on
screen, no stat labels. Navigation is the objects themselves (lit = enterable).
Keep an `sr-only` list of persona links for screen readers / keyboard users.

## Persona order and the assemblies

Six personas (`lib/content/fixtures.ts`): engineer, gamer, trader,
photographer, artist, ride. Order chosen so each blend shares a motif:

| # | Persona | Drifting objects | Assembles into | Lit moment (click = enter) | Bridge to next |
|---|---------|------------------|----------------|----------------------------|----------------|
| 1 | Engineer | Code screens, laptop, tech icons | Laptop flies in and **unfolds** toward you | VS Code lights the screen | screens |
| 2 | Gamer | Game screens, controllers, score boards | CPU tower, monitors, keyboard, mouse **land on a desk** | RGB lights, monitor boots into the game | numbers |
| 3 | Trader | Charts, tickers, P&L | Laptop / trading desk | Charts and tickers come alive | frames |
| 4 | Photographer | Viewfinders, photo frames | Camera body, lens screws on | Viewfinder shows ISO / shutter / aperture; shutter flash on click | images |
| 5 | Artist | Paintings, brush strokes | Easel and canvas | Strokes paint themselves in | lines |
| 6 | Ride | Roads, speedometer, route lines | Bike assembles (frame, wheels, bars) | Headlight on, glowing route with pins | — (ending) |

Each assembly ~1.5 screens of scroll, so the whole climb is ~12 screens.
"Skip intro" is visible from the first second; returning visitors (same
session) land on the spiral with a replay option.

## Content and rights

- **Real tools on screen are fine** (personal, non-commercial "tools I use"):
  VS Code, TradingView, Valorant, CS2, camera settings, etc. Use **Ratul's own
  screenshots**, not official trailers / key art; logos unaltered.
  Ratul is collecting them in `Desktop/portfolio-shots` (needed from round B):
  engineer 2–3 VS Code, gamer 2–3 Valorant/CS2, trader 2–3 TradingView
  (balances hidden), photographer 4–6 photos, artist 3–4 artworks, ride 3–4
  photos + 2–3 place names. Strip emails, account numbers, balances, chat names.
- **Trading numbers on the hub are illustrative**: show percentages and chart
  shapes, never currency amounts (fake money reads as a real claim).
- **Ride map**: no map tiles (OpenStreetMap would need on-screen credit).
  Routes are drawn as glowing lines with light pins.
- **3D models**: free public **CC0 only** (Kenney, Quaternius, Poly Pizza CC0
  filter). Real shapes, **our look**: re-skinned in our material (dark glass,
  glowing edges, colour from the light). Compressed (aim ≤1–2 MB each),
  loaded on approach; simpler versions on Performance.
- **Credits go in the browser console, never on screen.** CC0 makes that
  legitimate (no attribution required). Console prints model sources and
  "Product names and logos belong to their owners. No affiliation." Every
  model's source + licence is also recorded in a credits list in this folder.

## Performance

60 fps target on the chosen quality, including Ratul's Intel UHD laptop at
Performance. Instanced/merged geometry, screen textures generated in code or
compressed (WebP/KTX2) and lazy-loaded per persona. Performance quality shows
fewer objects but the same flight. Governor behaviour unchanged (D36).

## Normal mode

"The headset stays off": the same story (light, split, climb, the six
assemblies, ending) as a flat, scroll-driven motion piece — full animation,
no WebGL. Not a static fallback.

## Build plan

| Round | Scope |
|-------|-------|
| A | Headset gate + wear transition, night sky, Space/Tap to start, accelerating light with hold-to-slow hint, head-on impact, J-split to looking up, cone of colour |
| B | Spiral climb (tilt back to level), continuous object field, **engineer** laptop sequence end-to-end incl. click-into-screen portal (proves the pattern) |
| C | The other five assemblies + their drifting objects and blends |
| D | Ending (fade, empty sky, "Take off your headset", reverse rewind), Normal mode, phone tuning, sound design, console credits |

Possible later: "T" key travel map (camera pulls out to show the whole spiral;
click a stop to fly there) — from Ratul's tesseract reference, not yet agreed.

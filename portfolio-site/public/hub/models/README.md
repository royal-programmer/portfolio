# 3D models for the hub

Binary glTF (`.glb`), ideally under 2 MB, Y up, any scale (the scene measures and
fits it). CC0 or CC-BY; every model is recorded in
`docs/claude-planning/15-credits.md` and credited in the browser console
(`lib/site/credits.ts`) — nothing on screen.

- `bike.glb` — the rider's bike: "Motorcycle" by Poly by Google, CC BY 3.0,
  https://poly.pizza/m/dse64pqMKAR (6.4 k triangles, palette texture). The scene
  re-colours it by reading the colour under each triangle: paint → shell, light →
  glass, grey → metal, dark → matte. Replaces the built-in stylised bike when present.

Then run `npm run hub:media` (also runs on `npm run dev` / build).

# 19. Room style references (owner-supplied, 2026-11-15)

Ratul sent 17 reference photos. They are not committed (not ours to publish); this file records what they show so every 3D round builds toward the same look. Everything below becomes `room3d` settings data (colours, materials, object params); nothing is hard-coded.

## The room (photos 1-5: one white, neon-lit bedroom-studio)
- **Palette:** white walls, white textured (popcorn) ceiling, **glossy white ceramic floor tiles about 45 cm with light grout**, a **white long-pile shag rug** covering most of the floor between bed and shelves. Everything cool-white; the only colour is the LED light and screen content.
- **Lighting:** cool-white / lavender **LED neon strips** used as line art: a rectangle outlining the window, a straight run along the ceiling-wall edge, and a **free-form wavy neon tube** above the TV shelf. **Triangle light panels** (Nanoleaf-style, 7 triangles in a column) beside the window. Two vertical **LED tube lamps** flanking the window. **Ceiling fan with 4 lamp shades** (brushed steel, dark blades). Wall **split AC unit** and a ceiling vent. Blinds on the window (white horizontal). Light under the bed base (glow on the tiles). Result: soft, blue-white, bounced light with glossy reflections on the tiles. In the model: emissive strips with bloom, a cool HDRI, tile roughness low, rug roughness high.
- **Desk area:** long **light oak desk top on white legs** (sit-stand frame), white 5-drawer unit (Alex-style) under the right end, **three monitors in a row with manga / anime wallpaper** (black and white with purple tint), small white task lamp, white keyboard, a white tower PC with glass side on the desk, bottles, a notebook, headphones. **Chair:** black ergonomic mesh with headrest and footrest (photo 1), but the owner's separate reference (photo 15) is a **blue and black racing-style gaming chair**; use the gaming chair, colours from data.
- **Bed:** **grey fabric platform base**, white duvet, white pillows, a grey throw and a printed blanket folded at the foot; a cream cushion on the floor beside it.
- **TV wall:** very large wall-mounted TV (anime artwork, clock widget), on the wall above a long run of **white cube shelving** (2 and 3 rows) packed with books, figures, mugs, boxes, a digital clock; a **white pegboard with mechanical keyboards hanging** on it; two framed black posters; a cherry-blossom branch in a vase; a console and speakers on the left shelf.
- **Closets wall:** two **white bi-fold door closets** side by side: left one has a top shelf of **plushies**, a wire shelf with boxes, and a **MIDI keyboard on a black drawer unit**; right one is **clothes on black hangers in two rows** (hoodies and jackets above, tees below). A tall mirror and a door frame; a backpack hanging; dumbbells on the floor. This replaces the single wardrobe: `wardrobe` becomes a bi-fold closet pair with params `doors: 2 | 4`, `rows`, `topShelf: "plushies" | "boxes"`, `floorItem: "midi" | "drawers"`.
- **Entry door:** plain white 6-panel door, brass knob.

## Alternate mood (photo 6: dark studio)
Dark grey wall, warm walnut desk, wood floor, warm lamps, one red-orange neon line, three portrait prints, speakers, a vertical PC with red glow, a plant. This is the **dark variant of the same room**: map it to the Trader world (dim, strong accent light); Code stays the white room. Only `lighting` and material colours change per world, as already planned.

## Objects (photos 7-17), colours as data, logos only via owner upload
| Object | Reference | Shape and colour to build | Note |
|---|---|---|---|
| Riding suit | one-piece leather race suit | black base, **neon red-orange** panels on chest, shoulders, knees; grey chest stripe; white accents; knee sliders | brand marks are trademarks: generic panels, logo texture only if the owner uploads one |
| Riding boots | adventure boots | black, three buckles, textured shin plate | |
| Helmet | full-face MTB style | **red shell, white chin bar and visor**, large vents | |
| Bike key | KTM-style | black angular plastic head, steel blade | plain head; "KTM" text only via upload |
| Car key | BMW-style with roundel fob | black key, round blue/white quartered fob on a ring | plain quartered disc, no letters |
| Console | PS5 slim style | **white vertical slab with black centre strip**, white controller beside | already "generic console"; keep the two-tone |
| Gaming PC | white glass-sided case | **white case, glass front and side, 6-9 white RGB fans**, white GPU, cool-white light | two case styles shown; pick the first (tall, front glass) |
| Gaming chair | racing style | **blue and black** leather, headrest and lumbar pillows, black 5-star base | |
| Guitar | black acoustic cutaway | **black body, cutaway, white binding, black headstock**, strap hanging | matches the guitar-app round |
| Cap | Bulls-style | **black cap with red brim edge**; the bull logo is a trademark, blank front or owner upload | |
| Monitors wallpaper | manga collage | black/white panels with lavender tint | owner uploads real images; placeholder is a procedural monochrome collage |

## Open questions for the owner
1. Are photos 1-5 **your real room**, or a reference you like? (The AC/vent style looks North American.) It changes nothing in the build but decides whether "feels original" means "like my room" or "like this room".
2. Rug: keep the big white shag rug (it hides most of the tile and is cheap to render) or show more tile?
3. The two closets replace the single wardrobe: confirm.
4. Which objects carry real logos later (via your uploads): cap, keys, suit, PC? Nothing with a logo ships in the repo.

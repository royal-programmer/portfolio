/**
 * Credits for third-party work in the hub — printed once to the browser console (D38: nothing
 * on screen). The record of record is docs/claude-planning/15-credits.md; keep both in step.
 */
let printed = false;

export function printCredits() {
  if (printed || typeof console === "undefined") return;
  printed = true;
  const h = "font: 600 12px/1.6 ui-monospace, monospace; color: #e8e2d6; background: #0b0b10; padding: 2px 8px; border-radius: 4px";
  const p = "font: 12px/1.6 ui-monospace, monospace; color: #9a948a";
  console.groupCollapsed("%c credits %c third-party work in this hub", h, p);
  console.info("%c3D model", h);
  console.info("%cRider's bike · \"Motorcycle\" by Poly by Google · CC BY 3.0 · https://poly.pizza/m/dse64pqMKAR · also traced as the line drawing in Normal mode · re-coloured and lit for this site", p);
  console.info("%cLogos", h);
  console.info("%cTool and language marks via simple-icons (CC0 1.0, https://simpleicons.org) and devicon (MIT, https://devicon.dev). Shown as tools I use; trademarks belong to their owners, no affiliation.", p);
  console.info("%cFonts", h);
  console.info("%cFraunces · Geist · Geist Mono — SIL Open Font License", p);
  console.info("%cEverything else — the headset, sky, light, laptop, desks, camera, easel, kit, sound — is built in code for this site.", p);
  console.groupEnd();
}

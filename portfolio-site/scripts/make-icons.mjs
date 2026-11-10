/**
 * Generates the PWA icons into public/ (checked in; re-run after changing the mark):
 *
 *   node scripts/make-icons.mjs
 *
 * The mark is a capital R in Fraunces (the display face, default instance), its outline
 * lifted from the font once and embedded below so the script needs no font at run time.
 * Fraunces is SIL OFL 1.1. Colours: the void (#05060a) and the engineer blue from the brand.
 * Uses sharp, already a dependency.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(join(out, "icons"), { recursive: true });

const VOID = "#05060a";
const ACCENT = "#3b82f6";
/** Glyph "R" in font units (y up): x 6..1553, y -30..1400. */
const R_PATH = "M491 583L600 683Q644 655 694 644Q744 633 804 633Q890 633 955 677Q1020 721 1062 801Q1104 881 1119 989Q1133 1089 1114.5 1150.5Q1096 1212 1056 1241Q1016 1270 964 1270Q904 1270 876.5 1240Q849 1210 832 1159Q824 1135 808.5 1079Q793 1023 773 947Q753 871 730 784Q707 697 684.5 610Q662 523 642 445.5Q622 368 607.5 310Q593 252 587 225Q578 188 586.5 177.5Q595 167 612 158L649 143Q671 130 684 114.5Q697 99 697 75Q697 41 674.5 20.5Q652 0 606 0L85 0Q39 0 22.5 18.5Q6 37 6 65Q6 94 23.5 113Q41 132 63 141L108 155Q129 163 139 178Q149 193 158 221Q164 240 179 295Q194 350 214.5 428Q235 506 258.5 595.5Q282 685 305.5 775Q329 865 349.5 943.5Q370 1022 384 1078Q398 1134 403 1155Q414 1199 414.5 1218Q415 1237 386 1250L346 1263Q325 1273 313 1287.5Q301 1302 301 1324Q301 1358 325.5 1379Q350 1400 393 1400L1011 1400Q1204 1400 1333.5 1343Q1463 1286 1518 1181Q1573 1076 1541 932Q1515 804 1420.5 710Q1326 616 1176 564.5Q1026 513 834 510Q714 508 635 528.5Q556 549 491 583ZM777 530L1179 600L1249 348Q1256 322 1267 302.5Q1278 283 1293 272.5Q1308 262 1327 262Q1349 262 1369 275Q1389 288 1411 310Q1421 318 1436.5 322Q1452 326 1465 321Q1489 313 1495.5 289.5Q1502 266 1488 232Q1437 109 1328 39.5Q1219 -30 1088 -30Q1028 -30 985.5 -13Q943 4 916 40.5Q889 77 874 135Z";
const GLYPH = { x0: 6, x1: 1553, y0: -30, y1: 1400 };

/** The R centred in a size x size square, filling `fill` of it, plus a soft accent glow behind. */
function svg(size, fill) {
  const w = GLYPH.x1 - GLYPH.x0;
  const h = GLYPH.y1 - GLYPH.y0;
  const s = (size * fill) / Math.max(w, h);
  const tx = (size - w * s) / 2 - GLYPH.x0 * s;
  const ty = (size + h * s) / 2 + GLYPH.y0 * s; // flip y
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><radialGradient id="g" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="${ACCENT}" stop-opacity="0.28"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></radialGradient></defs>
<rect width="${size}" height="${size}" fill="${VOID}"/>
<rect width="${size}" height="${size}" fill="url(#g)"/>
<path d="${R_PATH}" fill="${ACCENT}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)} ${(-s).toFixed(5)})"/>
</svg>`;
}

const jobs = [
  ["icons/icon-192.png", 192, 0.6],
  ["icons/icon-512.png", 512, 0.6],
  // Maskable: the glyph stays inside the central safe zone (20% padding each side, so 60% of the width).
  ["icons/icon-maskable-512.png", 512, 0.5],
  ["apple-touch-icon.png", 180, 0.6],
];

for (const [file, size, fill] of jobs) {
  const buf = await sharp(Buffer.from(svg(size, fill))).png({ compressionLevel: 9, palette: true }).toBuffer();
  await sharp(buf).toFile(join(out, file));
  console.log(file, `${(buf.length / 1024).toFixed(1)} KB`);
}

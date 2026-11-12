// One-off (round 25, E2): copy the API Test Center product assets into public/projects/api-test-center/.
// The main poster and the screenshots become 1280-wide WebP (quality 80); the clips and their posters are copied as they are.
// The source folder is read only. `demo.webm` and `report-light.png` are not copied.
// Run from portfolio-site/: node scripts/netflix-media.mjs [source-assets-folder]
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SRC = process.argv[2] ?? "C:/Users/ratul.roy/Desktop/Process APIs/ApiTestCenter/website/assets";
const OUT = join(process.cwd(), "public/projects/api-test-center");
mkdirSync(join(OUT, "screens"), { recursive: true });
mkdirSync(join(OUT, "clips"), { recursive: true });

const webp = async (from, to) => {
  await sharp(from).resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toFile(to);
  console.log(to.replace(OUT, ""), Math.round(statSync(to).size / 1024), "KB");
};

await webp(join(SRC, "demo-poster.jpg"), join(OUT, "poster.webp"));
for (const n of ["builder", "chain", "charts", "help", "report", "send"]) await webp(join(SRC, "screens", `${n}.png`), join(OUT, "screens", `${n}.webp`));
for (const n of ["collection", "history", "load-test", "send", "sign-in", "upload", "websocket"]) {
  for (const ext of ["webm", "jpg"]) copyFileSync(join(SRC, "clips", `${n}.${ext}`), join(OUT, "clips", `${n}.${ext}`));
}
console.log("done");

/**
 * Shrinks a glTF/GLB for the room (round 37d):  npm run assets:optimise -- <in.glb> <out.glb> [maxTexture=512]
 * Steps (gltf-transform, a dev dependency): dedup, prune, weld, join (fewer draw calls), resize textures to the cap,
 * convert them to WebP (via sharp, already installed; three's GLTFLoader reads EXT_texture_webp), then prune again.
 * Draco/meshopt are NOT used: the loader has no local decoder set up, and the decoders must never come from a CDN.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [, , input, output, cap = "512"] = process.argv;
if (!input || !output) {
  console.error("usage: npm run assets:optimise -- <in.glb> <out.glb> [maxTexture]");
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules/@gltf-transform/cli/bin/cli.js");
const run = (args) => execFileSync(process.execPath, [cli, ...args], { stdio: "inherit" });
const tmp = output + ".tmp.glb";
run(["dedup", input, tmp]);
run(["prune", tmp, tmp]);
run(["weld", tmp, tmp]);
run(["join", tmp, tmp]);
run(["resize", tmp, tmp, "--width", cap, "--height", cap]);
run(["webp", tmp, tmp, "--slots", "*"]);
run(["prune", tmp, output]);
fs.rmSync(tmp, { force: true });
console.log(`${output}: ${fs.statSync(output).size} bytes`);

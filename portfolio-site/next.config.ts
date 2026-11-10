import { execSync } from "node:child_process";
import path from "node:path";
import type { NextConfig } from "next";

/** The commit this build is: Vercel's env on deploys, git locally. Shown in the hub's terminal. */
function commitLine(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const msg = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0];
  if (sha && msg) return `${sha} ${msg}`;
  try {
    return execSync("git log -1 --format=%h %s", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. Without it, a stray lockfile higher up
  // (e.g. ~/package-lock.json) makes Turbopack treat the whole home dir as root.
  turbopack: { root: path.resolve(__dirname) },
  // Keep sharp's native binary external to the server bundle (used by the media
  // pipeline in lib/media/pipeline.ts).
  serverExternalPackages: ["sharp"],
  // Persona subdomains in dev (code.ratulroy.localhost:3000 etc. — see proxy.ts / D31).
  allowedDevOrigins: ["ratulroy.localhost", "*.ratulroy.localhost"],
  env: { NEXT_PUBLIC_COMMIT: commitLine() },
  // Persona hosts are same-site, cross-origin: the hub may prerender them (Speculation Rules) only
  // if they opt in to a credentialed prerender.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Supports-Loading-Mode", value: "credentialed-prerender" }] }];
  },
};

export default nextConfig;

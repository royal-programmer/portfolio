import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. Without it, a stray lockfile higher up
  // (e.g. ~/package-lock.json) makes Turbopack treat the whole home dir as root.
  turbopack: { root: path.resolve(__dirname) },
  // Keep sharp's native binary external to the server bundle (used by the media
  // pipeline in lib/media/pipeline.ts).
  serverExternalPackages: ["sharp"],
  // Persona subdomains in dev (code.ratulroy.localhost:3000 etc. — see proxy.ts / D31).
  allowedDevOrigins: ["ratulroy.localhost", "*.ratulroy.localhost"],
};

export default nextConfig;

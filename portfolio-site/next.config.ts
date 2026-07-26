import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sharp's native binary external to the server bundle (used by the media
  // pipeline in lib/media/pipeline.ts).
  serverExternalPackages: ["sharp"],
};

export default nextConfig;

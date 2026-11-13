import type { MetadataRoute } from "next";

/** Production is open; a preview deployment (the `development` branch) is closed to crawlers. */
export default function robots(): MetadataRoute.Robots {
  const preview = process.env.VERCEL_ENV === "preview";
  return { rules: preview ? { userAgent: "*", disallow: "/" } : { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] } };
}

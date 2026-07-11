import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

// Real production deployments should set NEXT_PUBLIC_SITE_URL to the actual
// public domain; falling back to localhost here is honest for local/dev
// use rather than hardcoding a fake production URL that doesn't exist yet.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const PUBLIC_PATHS = [
  "",
  "/features",
  "/pricing",
  "/contact",
  "/terms",
  "/privacy",
  "/security",
  "/about",
  "/roadmap",
  "/status",
  "/accessibility",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routing.locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.7,
    })),
  );
}

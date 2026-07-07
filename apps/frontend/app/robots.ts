import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The authenticated dashboard has no useful content for a crawler to
      // index (it's all client-fetched, per-user data behind a login) and
      // shouldn't show up in search results. Routes are locale-prefixed
      // (`/en/dashboard`, `/he/dashboard`, ...), hence the `/*/` wildcard
      // rather than a bare `/dashboard`.
      disallow: [
        "/*/dashboard",
        "/*/domains",
        "/*/reports",
        "/*/alerts",
        "/*/settings",
        "/*/billing",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";

// Real production deployments should set NEXT_PUBLIC_SITE_URL to the actual
// public domain; falling back to localhost here is honest for local/dev
// use rather than hardcoding a fake production URL that doesn't exist yet.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Shared per-page metadata builder for every public marketing page. Fixes a
 * real bug the root layout's own `generateMetadata` had on its own: without
 * a page-specific `alternates`, every page's hreflang tags pointed at the
 * *locale root* (`/he`) instead of the equivalent page (`/he/pricing`) —
 * search engines would have followed `/en/pricing`'s Hebrew alternate to
 * the Hebrew homepage instead of the Hebrew pricing page. `path` must
 * include the leading slash (e.g. `/pricing`), or be empty for the
 * homepage.
 */
export function buildMetadata(params: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const { locale, path, title, description } = params;
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}${path}`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
      ),
    },
    openGraph: {
      title,
      description,
      siteName: "DomeCortex AI",
      locale,
      type: "website",
      url: `${SITE_URL}/${locale}${path}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

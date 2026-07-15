import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

// `contact/page.tsx` is a client component ("use client", for the form
// state) so it can't export `generateMetadata` itself — a segment layout
// is the standard way to attach real per-page metadata to a client page.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return buildMetadata({
    locale,
    path: "/contact",
    title: `${t("title")} — DomeCortex AI`,
    description: t("subtitle"),
  });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AmbientBackground } from "@/components/AmbientBackground";
import { StatusIndicator } from "@/components/StatusIndicator";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "status" });
  return buildMetadata({
    locale,
    path: "/status",
    title: `${t("title")} — DomeCortex AI`,
    description: t("subtitle"),
  });
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("status");

  return (
    <>
      <MarketingNav />
      <main id="main-content" className="flex-1">
        <div className="relative overflow-hidden">
          <AmbientBackground />
          <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-4">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{t("title")}</h1>
            <p className="mt-2 text-sm text-gray-400">{t("subtitle")}</p>
          </div>
        </div>
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="mt-6">
            <StatusIndicator />
          </div>
          <p className="mt-6 text-xs text-gray-400">{t("footnote")}</p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

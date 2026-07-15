import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AmbientBackground } from "@/components/AmbientBackground";
import { PricingGrid } from "@/components/PricingGrid";
import { getPlans } from "@/lib/plans";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return buildMetadata({
    locale,
    path: "/pricing",
    title: `${t("title")} — DomeCortex AI`,
    description: t("subtitle"),
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pricing");
  const tPlans = await getTranslations("plans");
  // See the comment on the equivalent call in the billing page — a safe
  // narrowing cast, not a real type mismatch.
  const plans = getPlans(tPlans as (key: string) => string);

  return (
    <>
      <MarketingNav />
      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden">
          <AmbientBackground />
          <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{t("title")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">{t("subtitle")}</p>
          </div>
        </section>

        {/* Pricing cards get hover-only 3D tilt (TiltCard), not the
            continuous idle float used elsewhere — this page's job is
            scannable, stable side-by-side comparison, and a card
            constantly bobbing on its own would work against that while
            someone is trying to compare five plans at rest. Tilting only
            in direct response to the cursor doesn't have that problem: it
            's flat and stable until someone actively interacts with it. */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <PricingGrid
            plans={plans}
            labels={{
              getStarted: t("getStarted"),
              contactSales: t("contactSales"),
              monthly: t("monthly"),
              yearly: t("yearly"),
              yearlySavings: t("yearlySavings"),
            }}
          />
          <p className="mt-8 text-center text-xs text-gray-400">{t("footnote")}</p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

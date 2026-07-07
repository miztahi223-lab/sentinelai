import { getTranslations, setRequestLocale } from "next-intl/server";
import { Globe2, ShieldCheck, Bell, FileText, Bot, Radar } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Link } from "@/i18n/navigation";
import { getPlans } from "@/lib/plans";
import type { Locale } from "@/i18n/routing";

const FEATURE_ICONS = [Radar, ShieldCheck, Bell, Bot, FileText, Globe2];

export default async function Home({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  // Required per-page (not just once in the root layout) for this page to
  // be statically prerendered per-locale rather than falling back to
  // fully dynamic rendering — every static server-component page under
  // `[locale]` that reads translations needs this same line.
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const tPlans = await getTranslations("plans");
  // See the comment on the equivalent call in the billing page — a safe
  // narrowing cast, not a real type mismatch.
  const plans = getPlans(tPlans as (key: string) => string);

  const features = FEATURE_ICONS.map((icon, i) => ({
    icon,
    title: t(`feature${i + 1}Title` as "feature1Title"),
    description: t(`feature${i + 1}Desc` as "feature1Desc"),
  }));

  return (
    <>
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            {t("heroTitleLine1")}
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              {t("heroTitleLine2")}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
            {t("heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-md bg-indigo-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-950 transition hover:-translate-y-0.5 hover:bg-indigo-400 hover:shadow-indigo-900"
            >
              {t("ctaStart")}
            </Link>
            <Link
              href="/features"
              className="rounded-md border border-gray-700 px-6 py-3 text-sm font-medium text-gray-200 transition hover:-translate-y-0.5 hover:border-gray-600 hover:bg-gray-900"
            >
              {t("ctaSee")}
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-800/80 bg-gray-900/20 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
              {t("featuresTitle")}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:-translate-y-1 hover:border-indigo-900 hover:bg-gray-900"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-500/10 transition group-hover:bg-indigo-500/20">
                    <Icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h3 className="mt-4 text-sm font-medium text-white">{title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
              {t("pricingTitle")}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700"
                >
                  <h3 className="text-sm font-medium text-gray-300">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-semibold text-white">{plan.price}</p>
                  <p className="mt-2 text-xs text-gray-500">{plan.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/pricing"
                className="text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
              >
                {t("seeFullPlans")} →
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-gray-800/80 bg-gray-900/20 py-20 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            {t("finalCtaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            {t("finalCtaSubtitle")}
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-md bg-indigo-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-950 transition hover:-translate-y-0.5 hover:bg-indigo-400"
          >
            {t("ctaStart")}
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}

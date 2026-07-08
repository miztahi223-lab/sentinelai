import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import {
  Globe2,
  ShieldCheck,
  Bell,
  FileText,
  Bot,
  Radar,
  ScanSearch,
  ListChecks,
  Eye,
  Sparkles,
  Unlock,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { FaqAccordion } from "@/components/FaqAccordion";
import { BrowserFrame } from "@/components/BrowserFrame";
import { Link } from "@/i18n/navigation";
import { getPlans } from "@/lib/plans";
import type { Locale } from "@/i18n/routing";

const FEATURE_ICONS = [Radar, ShieldCheck, Bell, Bot, FileText, Globe2];
const HOW_IT_WORKS_ICONS = [Globe2, ScanSearch, ListChecks];
const TRUST_ICONS = [Eye, Sparkles, Unlock, ShieldAlert];
const FAQ_COUNT = 5;

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

  const steps = HOW_IT_WORKS_ICONS.map((icon, i) => ({
    icon,
    title: t(`step${i + 1}Title` as "step1Title"),
    description: t(`step${i + 1}Desc` as "step1Desc"),
  }));

  const trustPoints = TRUST_ICONS.map((icon, i) => ({
    icon,
    title: t(`trustPoint${i + 1}Title` as "trustPoint1Title"),
    description: t(`trustPoint${i + 1}Desc` as "trustPoint1Desc"),
  }));

  const faqItems = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    question: t(`faq${i + 1}Q` as "faq1Q"),
    answer: t(`faq${i + 1}A` as "faq1A"),
  }));

  const heroStats = [1, 2, 3].map((i) => ({
    value: t(`heroStat${i}Value` as "heroStat1Value"),
    label: t(`heroStat${i}Label` as "heroStat1Label"),
  }));

  return (
    <>
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="bg-hero-grid pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute start-1/2 top-[-10rem] h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl rtl:translate-x-1/2"
          />
          <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16 text-center sm:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-800/60 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("heroEyebrow")}
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
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
            <p className="mt-4 text-xs text-gray-500">
              {t("heroNoCreditCard")}
            </p>
            <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4 border-t border-gray-800/80 pt-8">
              {heroStats.map(({ value, label }) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-semibold text-white sm:text-3xl">
                    {value}
                  </dd>
                  <p className="mt-1 text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </dl>
          </div>

          {/* Real product preview */}
          <div className="relative mx-auto max-w-5xl px-6 pb-24">
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {t("previewBadge")}
              </span>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">
                {t("previewTitle")}
              </h2>
              <p className="max-w-xl text-sm text-gray-500">
                {t("previewSubtitle")}
              </p>
            </div>
            <BrowserFrame
              src="/marketing/dashboard-preview.png"
              alt={t("previewAlt")}
            />
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-gray-800/80 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                {t("howItWorksTitle")}
              </h2>
              <p className="mt-3 text-sm text-gray-500">{t("howItWorksSubtitle")}</p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, description }, i) => (
                <div key={title} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-indigo-900 bg-indigo-500/10">
                    <Icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-indigo-400">
                    {i + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-medium text-white">{title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">{description}</p>
                </div>
              ))}
            </div>
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

        {/* Feature spotlight — two real screenshots, alternating layout */}
        <section className="border-t border-gray-800/80 py-20">
          <div className="mx-auto max-w-6xl space-y-20 px-6">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                  <FileText className="h-3.5 w-3.5" />
                  {t("spotlightReportsBadge")}
                </span>
                <h3 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
                  {t("spotlightReportsTitle")}
                </h3>
                <p className="mt-3 text-sm text-gray-500">
                  {t("spotlightReportsDesc")}
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-800 bg-white shadow-2xl shadow-indigo-950/30">
                <Image
                  src="/marketing/report-preview.png"
                  alt={t("spotlightReportsAlt")}
                  width={1700}
                  height={1350}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-2xl shadow-indigo-950/30">
                <Image
                  src="/marketing/alerts-preview.png"
                  alt={t("spotlightAlertsAlt")}
                  width={3200}
                  height={1050}
                  className="w-full"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                  <Bell className="h-3.5 w-3.5" />
                  {t("spotlightAlertsBadge")}
                </span>
                <h3 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
                  {t("spotlightAlertsTitle")}
                </h3>
                <p className="mt-3 text-sm text-gray-500">
                  {t("spotlightAlertsDesc")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why now — a real, sourced industry statistic, not an invented
            claim about SentinelAI's own (small) user base. */}
        <section className="border-t border-gray-800/80 py-20">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                <TrendingUp className="h-3.5 w-3.5" />
                {t("whyNowEyebrow")}
              </span>
              <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
                {t("whyNowTitle")}
              </h2>
              <p className="mt-3 text-sm text-gray-500">{t("whyNowBody")}</p>
            </div>
            <div className="rounded-xl border border-amber-900/40 bg-amber-500/5 p-8 text-center">
              <p className="text-5xl font-bold text-amber-300 sm:text-6xl">
                {t("whyNowStatValue")}
              </p>
              <p className="mx-auto mt-3 max-w-sm text-sm text-gray-400">
                {t("whyNowStatLabel")}
              </p>
              <p className="mt-4 text-xs text-gray-600">
                {t("whyNowStatSource")}
              </p>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="border-t border-gray-800/80 bg-gray-900/20 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
              {t("trustTitle")}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {trustPoints.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex gap-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{description}</p>
                  </div>
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

        {/* FAQ */}
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
              {t("faqTitle")}
            </h2>
            <div className="mt-10">
              <FaqAccordion items={faqItems} />
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

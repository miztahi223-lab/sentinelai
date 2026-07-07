import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Link } from "@/i18n/navigation";
import { getPlans } from "@/lib/plans";
import type { Locale } from "@/i18n/routing";

// The plan most new customers should land on — highlighted visually so the
// pricing grid guides a decision instead of presenting four flat, equally
// weighted boxes (a standard, well-tested SaaS pricing-page pattern).
const HIGHLIGHTED_PLAN_KEY = "PROFESSIONAL";

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
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">{t("subtitle")}</p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {plans.map((plan) => {
              const highlighted = plan.key === HIGHLIGHTED_PLAN_KEY;
              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-xl border p-6 transition ${
                    highlighted
                      ? "border-indigo-500 bg-indigo-500/[0.06] shadow-lg shadow-indigo-950"
                      : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {plan.name}
                    </span>
                  )}
                  <h3 className="text-sm font-medium text-gray-300">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-semibold text-white">{plan.price}</p>
                  <p className="mt-2 text-xs text-gray-500">{plan.description}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-xs text-gray-400">
                        <Check className="h-3 w-3 shrink-0 text-indigo-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`mt-6 block rounded-md px-3 py-2 text-center text-xs font-medium transition ${
                      highlighted
                        ? "bg-indigo-500 text-white hover:bg-indigo-400"
                        : "border border-gray-700 text-gray-200 hover:border-gray-600 hover:bg-gray-900"
                    }`}
                  >
                    {t("getStarted")}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-xs text-gray-600">{t("footnote")}</p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

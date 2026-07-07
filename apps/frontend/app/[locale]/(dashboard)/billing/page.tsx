"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { isAxiosError } from "axios";
import { useOrganizations, useCreateCheckoutSession } from "@/lib/hooks";
import { getPlans } from "@/lib/plans";

export default function BillingPage() {
  const t = useTranslations("billing");
  const tPlans = useTranslations("plans");
  // `getPlans` takes a plain `(key: string) => string` so it stays testable
  // with a hand-written translator over the raw JSON (see plans.test.ts)
  // without depending on next-intl's namespace-scoped generic type; next-
  // intl's own translator type is narrower (only accepts real "plans.*"
  // keys) which is a *safe* narrowing here, not a real type mismatch — cast
  // needed only because TS can't see that on its own.
  const plans = getPlans(tPlans as (key: string) => string);
  const { data: organizations } = useOrganizations();
  const org = organizations?.[0];
  const currentPlan = org?.subscription?.plan ?? "FREE";
  const checkoutSession = useCreateCheckoutSession();
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  async function handleUpgrade(plan: "STARTER" | "PROFESSIONAL" | "BUSINESS") {
    if (!org) return;
    setError(null);
    setPendingPlan(plan);
    try {
      const { url } = await checkoutSession.mutateAsync({
        organizationId: org.id,
        plan,
      });
      window.location.assign(url);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("errorDefault"));
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t.rich("currentPlan", {
            plan: currentPlan,
            b: (chunks) => <span className="font-medium text-gray-200">{chunks}</span>,
          })}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {plans.map((plan) => {
          // Compared against the stable, locale-independent `key` — never
          // the translated `name` (e.g. "Free" vs "חינם"), which would
          // silently break this comparison the moment the UI language
          // isn't English.
          const active = plan.key === currentPlan;
          return (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 transition ${
                active
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
              }`}
            >
              <h3 className="text-sm font-medium text-gray-300">{plan.name}</h3>
              <p className="mt-2 text-2xl font-semibold text-white">{plan.price}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-gray-400">
                    <Check className="h-3 w-3 shrink-0 text-indigo-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.plan ? (
                <button
                  onClick={() => handleUpgrade(plan.plan!)}
                  disabled={active || pendingPlan === plan.plan}
                  className="mt-6 w-full rounded-md bg-indigo-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {active
                    ? t("currentPlanLabel")
                    : pendingPlan === plan.plan
                      ? t("startingCheckout")
                      : t("upgrade")}
                </button>
              ) : (
                <button
                  disabled
                  className="mt-6 w-full cursor-not-allowed rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-500"
                >
                  {active ? t("currentPlanLabel") : t("defaultPlan")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600">{t("footnote")}</p>
    </div>
  );
}

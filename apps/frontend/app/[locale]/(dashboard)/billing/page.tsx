"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Bitcoin } from "lucide-react";
import { isAxiosError } from "axios";
import {
  useCreateCheckoutSession,
  useCreateCryptoCheckoutSession,
} from "@/lib/hooks";
import { useOrganization } from "@/lib/organization-context";
import { getPlans } from "@/lib/plans";
import { TiltCard } from "@/components/TiltCard";

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
  const { currentOrg: org } = useOrganization();
  const currentPlan = org?.subscription?.plan ?? "FREE";
  const checkoutSession = useCreateCheckoutSession();
  const cryptoCheckoutSession = useCreateCryptoCheckoutSession();
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [pendingCryptoPlan, setPendingCryptoPlan] = useState<string | null>(
    null,
  );
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  async function handleUpgrade(plan: "STARTER" | "PROFESSIONAL" | "BUSINESS") {
    if (!org) return;
    setError(null);
    setPendingPlan(plan);
    try {
      const { url } = await checkoutSession.mutateAsync({
        organizationId: org.id,
        plan,
        interval,
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

  // Crypto checkout for the same, already-authenticated organization — not
  // a separate anonymous flow. See `cryptoFootnote` copy shown below the
  // pricing grid, and `CryptoBillingService` on the backend, for why this
  // product deliberately does not offer an anonymous/guest payment option.
  async function handleCryptoUpgrade(plan: "STARTER" | "PROFESSIONAL") {
    if (!org) return;
    setError(null);
    setPendingCryptoPlan(plan);
    try {
      const { url } = await cryptoCheckoutSession.mutateAsync({
        organizationId: org.id,
        plan,
      });
      window.location.assign(url);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("cryptoErrorDefault"));
    } finally {
      setPendingCryptoPlan(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-400">
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

      <div className="inline-flex rounded-full border border-gray-800 bg-gray-900/60 p-1">
        <button
          onClick={() => setInterval("monthly")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            interval === "monthly"
              ? "bg-indigo-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {t("monthly")}
        </button>
        <button
          onClick={() => setInterval("yearly")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            interval === "yearly"
              ? "bg-indigo-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {t("yearly")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Custom-quote tiers (Enterprise) have no self-serve checkout —
            shown on the public pricing page with a "Contact sales" link,
            not here, where every card assumes a real Stripe upgrade path. */}
        {plans.filter((plan) => !plan.isCustomQuote).map((plan) => {
          // Compared against the stable, locale-independent `key` — never
          // the translated `name` (e.g. "Free" vs "חינם"), which would
          // silently break this comparison the moment the UI language
          // isn't English.
          const active = plan.key === currentPlan;
          return (
            <TiltCard key={plan.name}>
            <div
              className={`rounded-xl border p-6 transition ${
                active
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
              }`}
            >
              <h3 className="text-sm font-medium text-gray-300">{plan.name}</h3>
              <p className="mt-2 text-2xl font-semibold text-white">
                {interval === "yearly" ? plan.priceYearly : plan.priceMonthly}
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-gray-400">
                    <Check className="h-3 w-3 shrink-0 text-indigo-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.plan ? (
                <>
                  <button
                    onClick={() => handleUpgrade(plan.plan!)}
                    disabled={active || pendingPlan === plan.plan}
                    className="mt-6 w-full rounded-md bg-indigo-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-400"
                  >
                    {active
                      ? t("currentPlanLabel")
                      : pendingPlan === plan.plan
                        ? t("startingCheckout")
                        : t("upgrade")}
                  </button>
                  {!active && plan.plan !== "BUSINESS" && (
                    <button
                      onClick={() =>
                        handleCryptoUpgrade(
                          plan.plan as "STARTER" | "PROFESSIONAL",
                        )
                      }
                      disabled={pendingCryptoPlan === plan.plan}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-gray-600 hover:bg-gray-900 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      <Bitcoin className="h-3.5 w-3.5" />
                      {pendingCryptoPlan === plan.plan
                        ? t("startingCryptoCheckout")
                        : t("payWithCrypto")}
                    </button>
                  )}
                </>
              ) : (
                <button
                  disabled
                  className="mt-6 w-full cursor-not-allowed rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-400"
                >
                  {active ? t("currentPlanLabel") : t("defaultPlan")}
                </button>
              )}
            </div>
            </TiltCard>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">{t("footnote")}</p>
      <p className="text-xs text-gray-400">{t("cryptoFootnote")}</p>
    </div>
  );
}

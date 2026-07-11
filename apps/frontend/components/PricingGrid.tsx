"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TiltCard } from "@/components/TiltCard";
import type { BillingInterval, PlanInfo } from "@/lib/plans";

// The plan most new customers should land on — highlighted visually so the
// pricing grid guides a decision instead of presenting flat, equally
// weighted boxes (a standard, well-tested SaaS pricing-page pattern).
const HIGHLIGHTED_PLAN_KEY = "PROFESSIONAL";

interface PricingGridProps {
  plans: PlanInfo[];
  labels: {
    getStarted: string;
    contactSales: string;
    monthly: string;
    yearly: string;
    yearlySavings: string;
  };
}

/**
 * Client component for the one genuinely interactive part of the public
 * pricing page — a real monthly/yearly toggle (not just static copy) that
 * swaps every self-serve plan's displayed price, plus a real "Contact
 * sales" link (not a disabled button) for the one tier with no fixed,
 * self-serve price.
 */
export function PricingGrid({ plans, labels }: PricingGridProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <>
      <div className="mb-10 flex items-center justify-center gap-3">
        <div className="inline-flex rounded-full border border-gray-800 bg-gray-900/60 p-1">
          <button
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              interval === "monthly"
                ? "bg-indigo-500 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {labels.monthly}
          </button>
          <button
            onClick={() => setInterval("yearly")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              interval === "yearly"
                ? "bg-indigo-500 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {labels.yearly}
          </button>
        </div>
        {interval === "yearly" && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            {labels.yearlySavings}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {plans.map((plan) => {
          const highlighted = plan.key === HIGHLIGHTED_PLAN_KEY;
          const price = interval === "monthly" ? plan.priceMonthly : plan.priceYearly;
          return (
            <TiltCard key={plan.name}>
              <div
                className={`relative flex h-full flex-col rounded-xl border p-6 transition ${
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
                <p className="mt-2 text-2xl font-semibold text-white">{price}</p>
                <p className="mt-2 text-xs text-gray-400">{plan.description}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-gray-400">
                      <Check className="h-3 w-3 shrink-0 text-indigo-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.isCustomQuote ? "/contact" : "/register"}
                  className={`mt-6 block rounded-md px-3 py-2 text-center text-xs font-medium transition ${
                    highlighted
                      ? "bg-indigo-500 text-white hover:bg-indigo-400"
                      : "border border-gray-700 text-gray-200 hover:border-gray-600 hover:bg-gray-900"
                  }`}
                >
                  {plan.isCustomQuote ? labels.contactSales : labels.getStarted}
                </Link>
              </div>
            </TiltCard>
          );
        })}
      </div>
    </>
  );
}

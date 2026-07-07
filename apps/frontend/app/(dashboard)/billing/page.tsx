"use client";

import { Check } from "lucide-react";
import { useOrganizations } from "@/lib/hooks";

const PLANS = [
  { name: "Free", price: "$0", features: ["1 domain", "Weekly scans", "Community support"] },
  { name: "Starter", price: "$49/mo", features: ["5 domains", "Daily scans", "Email alerts"] },
  {
    name: "Professional",
    price: "$199/mo",
    features: ["25 domains", "Daily scans", "AI remediation", "PDF reports"],
  },
  {
    name: "Business",
    price: "Custom",
    features: ["Unlimited domains", "Real-time monitoring", "SSO", "Priority support"],
  },
];

export default function BillingPage() {
  const { data: organizations } = useOrganizations();
  const currentPlan = organizations?.[0]?.subscription?.plan ?? "FREE";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Current plan: <span className="font-medium text-gray-200">{currentPlan}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {PLANS.map((plan) => {
          const active = plan.name.toUpperCase() === currentPlan;
          return (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 ${
                active
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-gray-800 bg-gray-900/60"
              }`}
            >
              <h3 className="text-sm font-medium text-gray-300">{plan.name}</h3>
              <p className="mt-2 text-2xl font-semibold text-white">{plan.price}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-gray-400">
                    <Check className="h-3 w-3 text-indigo-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                disabled
                title="Stripe billing integration not built yet (Step 13)"
                className="mt-6 w-full cursor-not-allowed rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-500"
              >
                {active ? "Current plan" : "Upgrade (not yet available)"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600">
        Stripe checkout/subscription management is Step 13 of the build and isn&apos;t wired
        up yet — every organization is on the Free plan by default until then.
      </p>
    </div>
  );
}

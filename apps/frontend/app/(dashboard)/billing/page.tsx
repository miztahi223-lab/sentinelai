"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { isAxiosError } from "axios";
import { useOrganizations, useCreateCheckoutSession } from "@/lib/hooks";
import { PLANS } from "@/lib/plans";

export default function BillingPage() {
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
      setError(
        message ??
          "Could not start checkout — billing may not be configured on this deployment yet.",
      );
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Current plan: <span className="font-medium text-gray-200">{currentPlan}</span>
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

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
              {plan.plan ? (
                <button
                  onClick={() => handleUpgrade(plan.plan!)}
                  disabled={active || pendingPlan === plan.plan}
                  className="mt-6 w-full rounded-md bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {active
                    ? "Current plan"
                    : pendingPlan === plan.plan
                      ? "Starting checkout..."
                      : "Upgrade"}
                </button>
              ) : (
                <button
                  disabled
                  className="mt-6 w-full cursor-not-allowed rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-500"
                >
                  {active ? "Current plan" : "Default plan"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600">
        Checkout goes through real Stripe Checkout Sessions (Step 13). On a deployment without
        real Stripe API keys configured — like this local build — clicking &quot;Upgrade&quot;
        will show a clear error rather than a fake checkout page.
      </p>
    </div>
  );
}

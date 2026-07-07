import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { PLANS } from "@/lib/plans";

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            Start free. Upgrade when you need more domains, faster scans, or AI-assisted
            remediation.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/60 p-6"
              >
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
                  className="mt-6 block rounded-md bg-indigo-500 px-3 py-2 text-center text-xs font-medium text-white hover:bg-indigo-400"
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-gray-600">
            All plans start on Free — upgrade or change plans anytime from your billing
            settings.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

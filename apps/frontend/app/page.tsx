import Link from "next/link";
import { Globe2, ShieldCheck, Bell, FileText, Bot, Radar } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { PLANS } from "@/lib/plans";

const FEATURES = [
  {
    icon: Radar,
    title: "Continuous asset discovery",
    description:
      "Automatically maps your subdomains, IPs, TLS certificates, and exposed services — no manual inventory required.",
  },
  {
    icon: ShieldCheck,
    title: "Auditable security scoring",
    description:
      "A transparent 0-100 score across SSL, headers, exposure, configuration, and asset-change categories — every point traces to a real finding.",
  },
  {
    icon: Bell,
    title: "Real-time alerts",
    description:
      "Get notified the moment a new asset appears, a certificate nears expiry, or something disappears unexpectedly.",
  },
  {
    icon: Bot,
    title: "AI-generated remediation",
    description:
      "Plain-language explanations, business impact, and specific fixes for every finding — not just a raw technical scan output.",
  },
  {
    icon: FileText,
    title: "Exportable PDF reports",
    description:
      "Share a polished, board-ready report with your team or auditors — download or email it directly.",
  },
  {
    icon: Globe2,
    title: "Scheduled monitoring",
    description:
      "Daily automated re-scans catch drift between manual reviews, so nothing slips through unnoticed.",
  },
];

export default function Home() {
  return (
    <>
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Know what attackers can see
            <br />
            before they do.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
            SentinelAI continuously discovers your attack surface, scores your security
            posture, and tells you exactly what to fix — with AI-generated remediation
            guidance, not just a raw scan dump.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-md bg-indigo-500 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-400"
            >
              Start free trial
            </Link>
            <Link
              href="/features"
              className="rounded-md border border-gray-700 px-6 py-3 text-sm font-medium text-gray-200 hover:bg-gray-900"
            >
              See how it works
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-800 bg-gray-900/30 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold text-white">
              Everything you need to manage your attack surface
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-500/10">
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
            <h2 className="text-center text-2xl font-semibold text-white">
              Simple, transparent pricing
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="rounded-xl border border-gray-800 bg-gray-900/60 p-6"
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
                className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
              >
                See full plan comparison →
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-gray-800 bg-gray-900/30 py-20 text-center">
          <h2 className="text-2xl font-semibold text-white">
            Start monitoring your attack surface today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            Free to start — no credit card required.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-md bg-indigo-500 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Start free trial
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}

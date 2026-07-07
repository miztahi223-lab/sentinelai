import Link from "next/link";
import { Globe2, ShieldCheck, Bell, FileText, Bot, Radar } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";

const FEATURES = [
  {
    icon: Radar,
    title: "Continuous asset discovery",
    description:
      "Every scan resolves DNS (A/AAAA/CNAME/MX/TXT/NS), inspects the live TLS certificate on port 443, probes HTTP/HTTPS for headers and redirects, and fingerprints server/framework technology from real response signatures — then stores the result as a versioned asset, so you can see exactly what changed and when.",
  },
  {
    icon: ShieldCheck,
    title: "Auditable security scoring",
    description:
      "A 0-100 score built from real, traceable deductions across five categories — SSL, Headers, Exposure, Configuration, and Asset Changes. No black-box model: every point lost links back to a specific finding you can inspect.",
  },
  {
    icon: Bell,
    title: "Real-time alerts",
    description:
      "The monitoring engine re-scans every tracked domain daily and raises an alert the moment a new asset appears, an existing one disappears, or a TLS certificate drops within 30 days of expiry — emailed directly to your organization's owners/admins for anything high-severity.",
  },
  {
    icon: Bot,
    title: "AI-generated remediation",
    description:
      "For any finding, generate a plain-language explanation, concrete business impact, and a specific remediation step — written for the person who has to fix it, not just the person who found it.",
  },
  {
    icon: FileText,
    title: "Exportable PDF reports",
    description:
      "Generate a report for any domain covering your score, discovered assets, and findings with recommendations, download it directly, or have it emailed to you as a real attachment.",
  },
  {
    icon: Globe2,
    title: "Scheduled monitoring",
    description:
      "Background workers process scans asynchronously so requesting one never blocks your dashboard — and a daily sweep keeps every tracked domain current without you having to remember to check.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Built for teams who need to know, not just scan
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            SentinelAI goes from raw discovery to a prioritized, explained, exportable action
            list — automatically.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-500/10">
                  <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <h2 className="mt-4 text-base font-medium text-white">{title}</h2>
                <p className="mt-2 text-sm text-gray-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-800 bg-gray-900/30 py-16 text-center">
          <Link
            href="/register"
            className="inline-block rounded-md bg-indigo-500 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Start free trial
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

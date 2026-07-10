import { getTranslations, setRequestLocale } from "next-intl/server";
import { Globe2, ShieldCheck, Bell, FileText, Bot, Radar } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const FEATURE_ICONS = [Radar, ShieldCheck, Bell, Bot, FileText, Globe2];

export default async function FeaturesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("features");

  const features = FEATURE_ICONS.map((icon, i) => ({
    icon,
    title: t(`feature${i + 1}Title` as "feature1Title"),
    description: t(`feature${i + 1}Desc` as "feature1Desc"),
  }));

  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <AmbientBackground />
          <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{t("title")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">{t("subtitle")}</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {features.map(({ icon: Icon, title, description }, i) => (
              <div
                key={title}
                style={{ animationDelay: `${i * 0.4}s` }}
                className="animate-gentle-float rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700 motion-reduce:animate-none"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-500/10">
                  <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <h2 className="mt-4 text-base font-medium text-white">{title}</h2>
                <p className="mt-2 text-sm text-gray-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-800/80 bg-gray-900/20 py-16 text-center">
          <Link
            href="/register"
            className="inline-block rounded-md bg-indigo-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-950 transition hover:-translate-y-0.5 hover:bg-indigo-400"
          >
            {t("cta")}
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

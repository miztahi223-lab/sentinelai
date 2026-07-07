import { getTranslations, setRequestLocale } from "next-intl/server";
import { Bell } from "lucide-react";
import type { Locale } from "@/i18n/routing";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("alerts");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
        <Bell className="mx-auto h-8 w-8 text-gray-600" />
        <h2 className="mt-3 text-sm font-medium text-white">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{t("emptyDesc")}</p>
      </div>
    </div>
  );
}

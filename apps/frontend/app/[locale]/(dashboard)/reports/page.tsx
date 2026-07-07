import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText } from "lucide-react";
import type { Locale } from "@/i18n/routing";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("reports");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-gray-600" />
        <h2 className="mt-3 text-sm font-medium text-white">{t("notBuiltTitle")}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{t("notBuiltDesc")}</p>
      </div>
    </div>
  );
}

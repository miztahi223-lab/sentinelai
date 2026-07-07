import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-800 bg-gray-900/60">
        <SearchX className="h-7 w-7 text-gray-500" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-white">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{t("description")}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}

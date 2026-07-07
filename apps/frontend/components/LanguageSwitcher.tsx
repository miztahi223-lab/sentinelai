"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * A small, deliberately simple dropdown-free toggle rather than a full
 * `<select>` or menu — there are only two locales today, so a single
 * button that flips to "the other one" is less UI than a dropdown would
 * be for the same result, and still reads clearly since it always shows
 * the language you'd switch *to* (matching the common pattern used by
 * e.g. Wikipedia's language links).
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("language");

  const otherLocale = routing.locales.find((l) => l !== locale)!;

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: otherLocale })}
      aria-label={t("label")}
      className={`inline-flex items-center gap-1.5 rounded-md border border-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition hover:border-gray-700 hover:bg-gray-900 hover:text-white ${className}`}
    >
      <Languages className="h-3.5 w-3.5" />
      {t(otherLocale as "en" | "he")}
    </button>
  );
}

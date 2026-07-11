"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function MarketingNav() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-20 border-b border-gray-800/80 bg-gray-950/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-white transition hover:opacity-90"
        >
          Sentinel<span className="text-indigo-400">AI</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-gray-400 sm:flex">
          <Link href="/features" className="transition hover:text-gray-100">
            {t("features")}
          </Link>
          <Link href="/pricing" className="transition hover:text-gray-100">
            {t("pricing")}
          </Link>
          <Link href="/contact" className="transition hover:text-gray-100">
            {t("contact")}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-300 transition hover:text-white"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-indigo-950 transition hover:bg-indigo-400 hover:shadow-indigo-900"
          >
            {t("startTrial")}
          </Link>
        </div>
      </nav>
    </header>
  );
}

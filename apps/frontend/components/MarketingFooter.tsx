import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function MarketingFooter() {
  const t = useTranslations("nav");
  const tFooter = useTranslations("footer");

  return (
    <footer className="border-t border-gray-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-gray-500 sm:flex-row">
        <p>
          &copy; {new Date().getFullYear()} SentinelAI. {tFooter("rights")}
        </p>
        <div className="flex gap-6">
          <Link href="/features" className="transition hover:text-gray-300">
            {t("features")}
          </Link>
          <Link href="/pricing" className="transition hover:text-gray-300">
            {t("pricing")}
          </Link>
          <Link href="/contact" className="transition hover:text-gray-300">
            {t("contact")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

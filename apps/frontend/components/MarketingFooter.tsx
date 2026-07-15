import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function MarketingFooter() {
  const t = useTranslations("nav");
  const tFooter = useTranslations("footer");

  return (
    <footer className="border-t border-gray-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-gray-400 sm:flex-row">
        <p>
          &copy; {new Date().getFullYear()} DomeCortex AI. {tFooter("rights")}
        </p>
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/features" className="transition hover:text-gray-300">
            {t("features")}
          </Link>
          <Link href="/pricing" className="transition hover:text-gray-300">
            {t("pricing")}
          </Link>
          <Link href="/about" className="transition hover:text-gray-300">
            {tFooter("about")}
          </Link>
          <Link href="/security" className="transition hover:text-gray-300">
            {tFooter("security")}
          </Link>
          <Link href="/roadmap" className="transition hover:text-gray-300">
            {tFooter("roadmap")}
          </Link>
          <Link href="/status" className="transition hover:text-gray-300">
            {tFooter("status")}
          </Link>
          <Link href="/contact" className="transition hover:text-gray-300">
            {t("contact")}
          </Link>
          <Link href="/terms" className="transition hover:text-gray-300">
            {tFooter("terms")}
          </Link>
          <Link href="/privacy" className="transition hover:text-gray-300">
            {tFooter("privacy")}
          </Link>
          <Link href="/accessibility" className="transition hover:text-gray-300">
            {tFooter("accessibility")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

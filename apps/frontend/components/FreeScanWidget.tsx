"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { isAxiosError } from "axios";
import { ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePublicScan } from "@/lib/hooks";
import { scoreColor, scoreToGrade, scoreLabelKey } from "@/components/SecurityScoreCard";
import { toPlainLanguage } from "@/lib/plainLanguageFindings";

/**
 * The landing page's real lead-gen tool: a visitor types their own domain
 * and gets an actual, live security check back — the same SSRF-guarded
 * DNS/TLS/HTTP probes and scoring formula the authenticated product uses
 * (see `PublicScanService` on the backend), just without subdomain
 * enumeration and with nothing persisted. Deliberately shows only one real
 * finding plus a locked count of the rest — the full breakdown is the
 * reason to sign up, not something withheld arbitrarily.
 */
export function FreeScanWidget() {
  const t = useTranslations("landing");
  const tScore = useTranslations("securityScoreCard");
  const locale = useLocale();
  const publicScan = usePublicScan();
  const [domain, setDomain] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    publicScan.reset();
    publicScan.mutate(domain.trim());
  }

  function errorMessage(): string {
    const err = publicScan.error;
    if (isAxiosError(err)) {
      if (err.response?.status === 429) return t("freeScanErrorRateLimited");
      if (err.response?.status === 400) return t("freeScanErrorInvalid");
    }
    return t("freeScanErrorDefault");
  }

  const result = publicScan.data;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">{t("freeScanTitle")}</h2>
      </div>
      <p className="mb-4 text-xs text-gray-400">{t("freeScanSubtitle")}</p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="free-scan-domain" className="sr-only">
          {t("freeScanInputLabel")}
        </label>
        <input
          id="free-scan-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={t("freeScanPlaceholder")}
          required
          className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={publicScan.isPending}
          className="flex items-center gap-1.5 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {publicScan.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {publicScan.isPending ? t("freeScanButtonLoading") : t("freeScanButton")}
        </button>
      </form>

      {publicScan.isError && (
        <p className="mt-3 text-xs text-red-400">{errorMessage()}</p>
      )}

      {result && !result.reachable && (
        <p className="mt-4 text-xs text-yellow-400">
          {t("freeScanUnreachable", { domain: result.domain })}
        </p>
      )}

      {result && result.reachable && (
        <div className="mt-5 rounded-lg border border-gray-800 bg-black/30 p-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${scoreColor(result.score)}`}
              style={{ borderColor: "currentColor" }}
            >
              {scoreToGrade(result.score)}
            </div>
            <div>
              <p className={`text-2xl font-semibold ${scoreColor(result.score)}`}>
                {result.score}
                <span className="text-sm font-normal text-gray-400">/100</span>
              </p>
              <p className={`text-xs font-medium ${scoreColor(result.score)}`}>
                {tScore(scoreLabelKey(result.score))}
              </p>
            </div>
          </div>

          {result.topFinding ? (
            (() => {
              const plain = toPlainLanguage(
                result.topFinding.title,
                result.topFinding.description,
                locale === "he" ? "he" : "en",
              );
              return (
                <div className="mt-4 rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2">
                  <p className="text-sm font-medium text-gray-200">{plain.headline}</p>
                  <p className="mt-1 text-xs text-gray-400">{plain.explanation}</p>
                </div>
              );
            })()
          ) : (
            <p className="mt-4 text-xs text-emerald-400">{t("freeScanNoIssues")}</p>
          )}

          {result.additionalFindingsCount > 0 && (
            <p className="mt-2 text-xs text-gray-400">
              {t("freeScanMoreIssues", { count: result.additionalFindingsCount })}
            </p>
          )}

          <div className="mt-4 rounded-md bg-indigo-500/10 p-3">
            <p className="text-xs font-medium text-indigo-300">{t("freeScanCtaTitle")}</p>
            <p className="mt-1 text-xs text-gray-400">
              {t("freeScanCtaDesc", { domain: result.domain })}
            </p>
            <Link
              href="/register"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              {t("freeScanCtaButton")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-gray-400">{t("freeScanDisclaimer")}</p>
    </div>
  );
}

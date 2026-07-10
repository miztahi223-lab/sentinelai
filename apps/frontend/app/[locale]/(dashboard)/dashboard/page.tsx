"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useDomains, useDomainRisk, useDomainRiskHistory, useTriggerScan } from "@/lib/hooks";
import { useOrganization } from "@/lib/organization-context";
import { Timeline } from "@/components/Timeline";
import { DomainAssetCard } from "@/components/DomainAssetCard";
import { SecurityScoreCard } from "@/components/SecurityScoreCard";
import { AlertCard } from "@/components/AlertCard";
import { RiskChart } from "@/components/RiskChart";
import { TiltCard } from "@/components/TiltCard";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { currentOrg: org, isLoading: orgsLoading } = useOrganization();
  const { data: domains, isLoading: domainsLoading } = useDomains(org?.id);
  // Which domain's score/findings/trend are shown in detail — defaults to
  // the first tracked domain, but (unlike before) is a real, switchable
  // selection once there's more than one, rather than always silently
  // being "whichever domain happens to be first". Not a true combined
  // multi-domain aggregate (that would need a genuinely different scoring
  // model — how do you average five domains' scores into one meaningful
  // number?), but it closes the actual practical gap: every domain's real
  // detail is now reachable from this page, not just the first one ever
  // added.
  const [selectedDomainId, setSelectedDomainId] = useState<string | undefined>(
    undefined,
  );
  const primaryDomain =
    domains?.find((d) => d.id === selectedDomainId) ?? domains?.[0];
  const { data: risk, isLoading: riskLoading } = useDomainRisk(primaryDomain?.id);
  const { data: riskHistory } = useDomainRiskHistory(primaryDomain?.id);
  const triggerScan = useTriggerScan(primaryDomain?.id);

  if (orgsLoading) {
    return <p className="text-sm text-gray-500">{t("loading")}</p>;
  }

  const hasDomains = (domains?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("overview")}</h1>
          <p className="mt-1 text-sm text-gray-500">{org?.name}</p>
        </div>
        {hasDomains && primaryDomain && (
          <div className="flex items-center gap-3">
            {domains && domains.length > 1 && (
              <select
                value={primaryDomain.id}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                aria-label={t("selectDomain")}
                className="rounded-md border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-200 outline-none transition hover:border-gray-600 focus:border-indigo-500"
              >
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => triggerScan.mutate()}
              disabled={triggerScan.isPending}
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-950 transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {triggerScan.isPending ? t("startingScan") : t("scanNow")}
            </button>
          </div>
        )}
      </div>

      {!domainsLoading && !hasDomains && (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
          <h2 className="text-lg font-medium text-white">{t("addFirstDomainTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            {t("addFirstDomainDesc")}
          </p>
          <Link
            href="/domains"
            className="mt-4 inline-block rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
          >
            {t("addDomain")}
          </Link>
        </div>
      )}

      {hasDomains && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {riskLoading || !risk ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-400">{t("securityScore")}</h3>
                <p className="mt-4 text-sm text-gray-500">{t("loading")}</p>
              </div>
            ) : !risk.hasScan ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-400">{t("securityScore")}</h3>
                <p className="mt-4 text-sm text-gray-500">
                  {t("noScanYet", { domain: primaryDomain?.name ?? "" })}
                </p>
              </div>
            ) : (
              <SecurityScoreCard score={risk.score ?? 0} />
            )}

            <div className="lg:col-span-2 space-y-2">
              <h3 className="text-sm font-medium text-gray-400">
                {t("findingsFor", { domain: primaryDomain?.name ?? "" })}
              </h3>
              {risk?.hasScan && risk.findings.length === 0 && (
                <p className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm text-emerald-400">
                  {t("noFindings")}
                </p>
              )}
              {risk?.findings.map((f) => (
                <AlertCard
                  key={f.id}
                  severity={f.severity}
                  message={`${f.title} — ${f.description}`}
                  createdAt={f.createdAt}
                />
              ))}
            </div>
          </div>

          <TiltCard>
            <RiskChart
              data={
                riskHistory?.map((point) => ({
                  date: new Date(point.date).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  }),
                  score: point.score,
                })) ?? []
              }
            />
          </TiltCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-400">
                {t("trackedDomains")}
              </h2>
              <div className="space-y-2">
                {domains?.map((domain) => (
                  <DomainAssetCard key={domain.id} domain={domain} />
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-400">
                {t("recentActivity")}
              </h2>
              <Timeline
                events={
                  domains?.map((d) => ({
                    id: d.id,
                    title: t("domainAdded", { name: d.name }),
                    timestamp: d.createdAt,
                    kind: "info" as const,
                  })) ?? []
                }
              />
            </div>
          </div>

          <p className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-500">
            {t("footnote", { domain: primaryDomain?.name ?? "" })}
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Globe2, Server, Bell, CheckCircle2, Clock } from "lucide-react";
import {
  useDomains,
  useDomainRisk,
  useDomainRiskHistory,
  useTriggerScan,
  useDashboardSummary,
} from "@/lib/hooks";
import { useOrganization } from "@/lib/organization-context";
import { Timeline } from "@/components/Timeline";
import { DomainAssetCard } from "@/components/DomainAssetCard";
import { SecurityScoreCard } from "@/components/SecurityScoreCard";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { AlertCard } from "@/components/AlertCard";
import { RiskChart } from "@/components/RiskChart";
import { TiltCard } from "@/components/TiltCard";
import { StatTile } from "@/components/StatTile";
import { CertificateExpirations } from "@/components/CertificateExpirations";
import { QuickActions } from "@/components/QuickActions";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { ScanProgressBar } from "@/components/ScanProgressBar";
import { toPlainLanguage } from "@/lib/plainLanguageFindings";

const CHANGE_KIND: Record<string, "info" | "warning" | "critical"> = {
  CRITICAL: "critical",
  HIGH: "critical",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "info",
};

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
  const { data: summary } = useDashboardSummary(org?.id);

  if (orgsLoading) {
    return <p className="text-sm text-gray-400">{t("loading")}</p>;
  }

  const onboardingComplete = risk?.hasScan === true;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("overview")}</h1>
          <p className="mt-1 text-sm text-gray-400">{org?.name}</p>
        </div>
        {onboardingComplete && primaryDomain && (
          <div className="flex items-center gap-3">
            {domains && domains.length > 1 && (
              <select
                value={primaryDomain.id}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                aria-label={t("selectDomain")}
                className="rounded-md border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-200 outline-none transition hover:border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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

      <ScanProgressBar scanId={triggerScan.data?.id} />

      {!domainsLoading && !onboardingComplete && (
        <OnboardingSteps
          organizationId={org?.id}
          domains={domains}
          primaryDomain={primaryDomain}
          hasScan={onboardingComplete}
          onScanNow={() => triggerScan.mutate()}
          scanPending={triggerScan.isPending}
        />
      )}

      {onboardingComplete && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Globe2} label={t("statDomains")} value={summary?.totalDomains ?? domains?.length ?? 0} />
            <StatTile icon={Server} label={t("statAssets")} value={summary?.totalAssets ?? 0} />
            <StatTile
              icon={Bell}
              label={t("statActiveAlerts")}
              value={summary?.activeAlertsCount ?? 0}
              tone={summary && summary.activeAlertsCount > 0 ? "warning" : "default"}
            />
            <StatTile
              icon={CheckCircle2}
              label={t("statResolvedAlerts")}
              value={summary?.resolvedAlertsCount ?? 0}
              tone="good"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm text-gray-400">
            <Clock className="h-4 w-4 shrink-0 text-gray-400" />
            {summary?.latestScan
              ? t("latestScanText", {
                  domain: summary.latestScan.domainName,
                  date: new Date(summary.latestScan.finishedAt).toLocaleString(locale),
                })
              : t("latestScanNone")}
          </div>

          <QuickActions
            onScanNow={() => triggerScan.mutate()}
            scanDisabled={!primaryDomain}
            scanPending={triggerScan.isPending}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {riskLoading || !risk ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
                <h2 className="text-sm font-medium text-gray-400">{t("securityScore")}</h2>
                <p className="mt-4 text-sm text-gray-400">{t("loading")}</p>
              </div>
            ) : !risk.hasScan ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
                <h2 className="text-sm font-medium text-gray-400">{t("securityScore")}</h2>
                <p className="mt-4 text-sm text-gray-400">
                  {t("noScanYet", { domain: primaryDomain?.name ?? "" })}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <SecurityScoreCard score={risk.score ?? 0} />
                {risk.categories && (
                  <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 shadow-sm">
                    <ScoreBreakdown categories={risk.categories} />
                  </div>
                )}
              </div>
            )}

            <div className="lg:col-span-2 space-y-2">
              <h2 className="text-sm font-medium text-gray-400">
                {t("findingsFor", { domain: primaryDomain?.name ?? "" })}
              </h2>
              {risk?.hasScan && risk.findings.length === 0 && (
                <p className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm text-emerald-400">
                  {t("noFindings")}
                </p>
              )}
              {risk?.findings.map((f) => {
                const plain = toPlainLanguage(
                  f.title,
                  f.description,
                  locale === "he" ? "he" : "en",
                );
                return (
                  <AlertCard
                    key={f.id}
                    severity={f.severity}
                    message={`${plain.headline} — ${plain.explanation}`}
                    technicalDetail={`${f.title} — ${f.description}`}
                    createdAt={f.createdAt}
                    findingId={f.id}
                    aiExplanation={f.aiExplanation}
                    aiBusinessImpact={f.aiBusinessImpact}
                    aiRemediation={f.aiRemediation}
                    aiDifficulty={f.aiDifficulty}
                    aiPriority={f.aiPriority}
                  />
                );
              })}
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
              <h2 className="mb-3 text-sm font-medium text-gray-400">{t("topRisksTitle")}</h2>
              {summary && summary.topRisks.length === 0 ? (
                <p className="text-sm text-gray-400">{t("topRisksEmpty")}</p>
              ) : (
                <div className="space-y-2">
                  {summary?.topRisks.map((topRisk) => {
                    const plain = toPlainLanguage(
                      topRisk.title,
                      topRisk.description,
                      locale === "he" ? "he" : "en",
                    );
                    return (
                      <AlertCard
                        key={topRisk.id}
                        severity={topRisk.severity}
                        message={`${topRisk.domainName} — ${plain.headline}`}
                        technicalDetail={`${topRisk.title} — ${topRisk.description}`}
                        createdAt={topRisk.createdAt}
                        findingId={topRisk.id}
                        aiExplanation={topRisk.aiExplanation}
                        aiBusinessImpact={topRisk.aiBusinessImpact}
                        aiRemediation={topRisk.aiRemediation}
                        aiDifficulty={topRisk.aiDifficulty}
                        aiPriority={topRisk.aiPriority}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-400">{t("certExpiryTitle")}</h2>
              <CertificateExpirations items={summary?.upcomingCertExpirations ?? []} />
            </div>
          </div>

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
                  summary?.recentChanges.map((change) => ({
                    id: change.id,
                    title: change.message,
                    timestamp: change.createdAt,
                    kind: CHANGE_KIND[change.severity] ?? "info",
                  })) ?? []
                }
              />
            </div>
          </div>

          <p className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-400">
            {t("footnote", { domain: primaryDomain?.name ?? "" })}
          </p>
        </>
      )}
    </div>
  );
}

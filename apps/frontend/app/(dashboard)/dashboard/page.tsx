"use client";

import Link from "next/link";
import { useOrganizations, useDomains, useDomainRisk, useTriggerScan } from "@/lib/hooks";
import { Timeline } from "@/components/Timeline";
import { AssetCard } from "@/components/AssetCard";
import { SecurityScoreCard } from "@/components/SecurityScoreCard";
import { AlertCard } from "@/components/AlertCard";

export default function DashboardPage() {
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();
  const org = organizations?.[0];
  const { data: domains, isLoading: domainsLoading } = useDomains(org?.id);
  const primaryDomain = domains?.[0];
  const { data: risk, isLoading: riskLoading } = useDomainRisk(primaryDomain?.id);
  const triggerScan = useTriggerScan(primaryDomain?.id);

  if (orgsLoading) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  const hasDomains = (domains?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Overview</h1>
          <p className="mt-1 text-sm text-gray-500">{org?.name}</p>
        </div>
        {hasDomains && primaryDomain && (
          <button
            onClick={() => triggerScan.mutate()}
            disabled={triggerScan.isPending}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {triggerScan.isPending ? "Starting scan..." : "Scan now"}
          </button>
        )}
      </div>

      {!domainsLoading && !hasDomains && (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
          <h2 className="text-lg font-medium text-white">
            Add your first domain to get started
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            SentinelAI continuously discovers your attack surface — subdomains, IPs,
            certificates, and exposed services — and scores your security posture.
          </p>
          <Link
            href="/domains"
            className="mt-4 inline-block rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Add a domain
          </Link>
        </div>
      )}

      {hasDomains && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {riskLoading || !risk ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-400">Security Score</h3>
                <p className="mt-4 text-sm text-gray-500">Loading...</p>
              </div>
            ) : !risk.hasScan ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-400">Security Score</h3>
                <p className="mt-4 text-sm text-gray-500">
                  No completed scan yet for {primaryDomain?.name} — click &quot;Scan
                  now&quot; to run one (usually finishes in a few seconds).
                </p>
              </div>
            ) : (
              <SecurityScoreCard score={risk.score ?? 0} />
            )}

            <div className="lg:col-span-2 space-y-2">
              <h3 className="text-sm font-medium text-gray-400">
                Findings — {primaryDomain?.name}
              </h3>
              {risk?.hasScan && risk.findings.length === 0 && (
                <p className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm text-emerald-400">
                  No findings from the latest scan — nothing to flag right now.
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-400">
                Tracked domains
              </h2>
              <div className="space-y-2">
                {domains?.map((domain) => (
                  <AssetCard
                    key={domain.id}
                    type="SUBDOMAIN"
                    value={domain.name}
                    active={domain.verified}
                    lastSeenAt={domain.createdAt}
                    findingsCount={0}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-400">
                Recent activity
              </h2>
              <Timeline
                events={
                  domains?.map((d) => ({
                    id: d.id,
                    title: `Domain added: ${d.name}`,
                    timestamp: d.createdAt,
                    kind: "info" as const,
                  })) ?? []
                }
              />
            </div>
          </div>

          <p className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-500">
            Score and findings shown are for the first tracked domain only
            ({primaryDomain?.name}) — a multi-domain aggregate view isn&apos;t built yet.
            AI-generated explanations/remediation (Step 11) aren&apos;t wired up yet either;
            findings show the raw detection only.
          </p>
        </>
      )}
    </div>
  );
}

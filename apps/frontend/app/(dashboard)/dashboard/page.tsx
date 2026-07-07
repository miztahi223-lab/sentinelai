"use client";

import Link from "next/link";
import { useOrganizations, useDomains } from "@/lib/hooks";
import { Timeline } from "@/components/Timeline";
import { AssetCard } from "@/components/AssetCard";

export default function DashboardPage() {
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();
  const org = organizations?.[0];
  const { data: domains, isLoading: domainsLoading } = useDomains(org?.id);

  if (orgsLoading) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  const hasDomains = (domains?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="mt-1 text-sm text-gray-500">{org?.name}</p>
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
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-400">Security Score</h3>
              <p className="mt-4 text-sm text-gray-500">
                No scans have run yet — a score will appear here once the scanning
                engine (Step 7–10) runs its first scan against your domains.
              </p>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-400">
                Security Score — last 30 days
              </h3>
              <p className="mt-4 text-sm text-gray-500">
                No scan history yet.
              </p>
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
            Scanning, risk scoring, and findings are not wired up yet (Steps 7–10 of the
            build) — this view will populate with real data once the discovery and risk
            engine modules are implemented. Nothing shown here is fabricated data.
          </p>
        </>
      )}
    </div>
  );
}

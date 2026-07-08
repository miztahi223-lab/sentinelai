"use client";

import { useDomainRisk, type Domain } from "@/lib/hooks";
import { AssetCard } from "@/components/AssetCard";

/**
 * A thin wrapper around `AssetCard` for the specific case of listing
 * tracked *domains* (as opposed to the generic discovered-asset use of
 * `AssetCard` elsewhere) — fetches that domain's own real latest-scan
 * finding count via `useDomainRisk` rather than the literal `0` this list
 * used to hardcode everywhere it appeared. A hardcoded `0` is exactly the
 * kind of fake/placeholder-looking-like-real-data this whole build has
 * otherwise been careful to avoid (an honest "not built yet" message is
 * fine; a fabricated-looking real number is not), so this was a real bug,
 * not a stylistic nitpick — found while auditing for exactly this pattern.
 */
export function DomainAssetCard({ domain }: { domain: Domain }) {
  const { data: risk } = useDomainRisk(domain.id);

  return (
    <AssetCard
      type="SUBDOMAIN"
      value={domain.name}
      active={domain.verified}
      lastSeenAt={domain.createdAt}
      findingsCount={risk?.hasScan ? risk.findings.length : 0}
    />
  );
}

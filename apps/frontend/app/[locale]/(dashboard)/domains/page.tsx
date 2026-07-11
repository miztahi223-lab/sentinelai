"use client";

import { useTranslations } from "next-intl";
import { useDomains } from "@/lib/hooks";
import { useOrganization } from "@/lib/organization-context";
import { DomainAssetCard } from "@/components/DomainAssetCard";
import { AddDomainForm } from "@/components/AddDomainForm";
import { DomainVerification } from "@/components/DomainVerification";

export default function DomainsPage() {
  const t = useTranslations("domains");
  const { currentOrg: org } = useOrganization();
  const { data: domains, isLoading } = useDomains(org?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-400">{t("subtitle")}</p>
      </div>

      <AddDomainForm organizationId={org?.id} />

      <div className="space-y-4">
        {isLoading && <p className="text-sm text-gray-400">{t("loading")}</p>}
        {!isLoading && domains?.length === 0 && (
          <p className="text-sm text-gray-400">{t("empty")}</p>
        )}
        {domains?.map((domain) => (
          <div key={domain.id} className="space-y-2">
            <DomainAssetCard domain={domain} />
            <DomainVerification domain={domain} />
          </div>
        ))}
      </div>
    </div>
  );
}

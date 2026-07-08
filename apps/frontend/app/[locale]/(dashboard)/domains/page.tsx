"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { useDomains, useCreateDomain } from "@/lib/hooks";
import { useOrganization } from "@/lib/organization-context";
import { DomainAssetCard } from "@/components/DomainAssetCard";

export default function DomainsPage() {
  const t = useTranslations("domains");
  const { currentOrg: org } = useOrganization();
  const { data: domains, isLoading } = useDomains(org?.id);
  const createDomain = useCreateDomain(org?.id);

  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createDomain.mutateAsync(newDomain.trim());
      setNewDomain("");
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("errorDefault"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleAdd} className="flex max-w-md gap-2">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder={t("placeholder")}
          required
          className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={createDomain.isPending || !org}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {createDomain.isPending ? t("adding") : t("add")}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-gray-500">{t("loading")}</p>}
        {!isLoading && domains?.length === 0 && (
          <p className="text-sm text-gray-500">{t("empty")}</p>
        )}
        {domains?.map((domain) => (
          <DomainAssetCard key={domain.id} domain={domain} />
        ))}
      </div>
    </div>
  );
}

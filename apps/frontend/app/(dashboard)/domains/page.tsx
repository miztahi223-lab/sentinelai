"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { useOrganizations, useDomains, useCreateDomain } from "@/lib/hooks";
import { AssetCard } from "@/components/AssetCard";

export default function DomainsPage() {
  const { data: organizations } = useOrganizations();
  const org = organizations?.[0];
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
      setError(message ?? "Could not add domain.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Domains</h1>
        <p className="mt-1 text-sm text-gray-500">
          Domains SentinelAI monitors for this organization.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex max-w-md gap-2">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          required
          className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={createDomain.isPending || !org}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {createDomain.isPending ? "Adding..." : "Add domain"}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
        {!isLoading && domains?.length === 0 && (
          <p className="text-sm text-gray-500">No domains added yet.</p>
        )}
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
  );
}

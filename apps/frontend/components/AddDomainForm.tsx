"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { useCreateDomain, type Domain } from "@/lib/hooks";

interface AddDomainFormProps {
  organizationId: string | undefined;
  onAdded?: (domain: Domain) => void;
}

export function AddDomainForm({ organizationId, onAdded }: AddDomainFormProps) {
  const t = useTranslations("domains");
  const createDomain = useCreateDomain(organizationId);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const domain = await createDomain.mutateAsync(newDomain.trim());
      setNewDomain("");
      onAdded?.(domain);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("errorDefault"));
    }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="flex max-w-md gap-2">
        <label htmlFor="add-domain-name" className="sr-only">
          {t("add")}
        </label>
        <input
          id="add-domain-name"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder={t("placeholder")}
          required
          className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={createDomain.isPending || !organizationId}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {createDomain.isPending ? t("adding") : t("add")}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { CheckCircle2, ShieldQuestion } from "lucide-react";
import { useVerifyDomain, type Domain } from "@/lib/hooks";

interface DomainVerificationProps {
  domain: Domain;
}

// Same real TXT record format the backend actually checks
// (`domains.service.ts`'s `verificationTxtValue`) — kept in one place on
// each side rather than guessed independently, so instructions never drift
// from what a real DNS lookup will actually accept.
function verificationTxtValue(token: string): string {
  return `sentinelai-verify=${token}`;
}

export function DomainVerification({ domain }: DomainVerificationProps) {
  const t = useTranslations("domainVerification");
  const verify = useVerifyDomain(domain.organizationId);

  if (domain.verified) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t("verified")}
      </p>
    );
  }

  const errorMessage =
    verify.isError && isAxiosError(verify.error)
      ? ((verify.error.response?.data as { message?: string })?.message ??
        t("errorDefault"))
      : verify.isError
        ? t("errorDefault")
        : null;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-200">
        <ShieldQuestion className="h-4 w-4 text-amber-400" />
        {t("title")}
      </p>
      <p className="mt-1 text-xs text-gray-400">{t("instructions", { domain: domain.name })}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-black/30 p-3 text-xs">
        <div>
          <dt className="text-gray-400">{t("recordType")}</dt>
          <dd className="mt-0.5 font-mono text-gray-200">TXT</dd>
        </div>
        <div>
          <dt className="text-gray-400">{t("recordHost")}</dt>
          <dd className="mt-0.5 font-mono text-gray-200">@</dd>
        </div>
        <div className="col-span-3 sm:col-span-1">
          <dt className="text-gray-400">{t("recordValue")}</dt>
          <dd className="mt-0.5 break-all font-mono text-gray-200">
            {verificationTxtValue(domain.verificationToken ?? "")}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => verify.mutate(domain.id)}
          disabled={verify.isPending}
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {verify.isPending ? t("verifying") : t("verifyNow")}
        </button>
        <span className="text-xs text-gray-400">{t("propagationNote")}</span>
      </div>
      {errorMessage && <p className="mt-2 text-xs text-red-400">{errorMessage}</p>}
    </div>
  );
}

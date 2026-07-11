"use client";

import { useTranslations } from "next-intl";
import { Check, ScanSearch, LayoutDashboard, Bell } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Domain } from "@/lib/hooks";
import { AddDomainForm } from "@/components/AddDomainForm";
import { DomainVerification } from "@/components/DomainVerification";

interface OnboardingStepsProps {
  organizationId: string | undefined;
  domains: Domain[] | undefined;
  primaryDomain: Domain | undefined;
  hasScan: boolean;
  onScanNow: () => void;
  scanPending: boolean;
}

function StepShell({
  index,
  title,
  done,
  isLast,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
            done
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
              : "border-gray-700 bg-gray-900 text-gray-400"
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : index}
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-gray-800" />}
      </div>
      <div className="flex-1 pb-6">
        <h3 className={`text-sm font-medium ${done ? "text-gray-400" : "text-white"}`}>
          {title}
        </h3>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

/**
 * Shown in place of the full dashboard until a brand-new organization has
 * actually completed a first real scan — real state drives every step
 * (organization existence, domain verification, scan completion), nothing
 * here is a static illustration. Disappears for good once `hasScan` is
 * true; the full widget dashboard (see `dashboard/page.tsx`) takes over
 * from there.
 */
export function OnboardingSteps({
  organizationId,
  domains,
  primaryDomain,
  hasScan,
  onScanNow,
  scanPending,
}: OnboardingStepsProps) {
  const t = useTranslations("onboarding");
  const hasDomains = (domains?.length ?? 0) > 0;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6">
      <h2 className="mb-6 text-lg font-semibold text-white">{t("title")}</h2>

      <StepShell index={1} title={t("step1Title")} done={true}>
        <p className="text-xs text-gray-400">{t("step1Desc")}</p>
      </StepShell>

      <StepShell index={2} title={t("step2Title")} done={hasDomains}>
        {!hasDomains ? (
          <>
            <p className="mb-2 text-xs text-gray-400">{t("step2Desc")}</p>
            <AddDomainForm organizationId={organizationId} />
          </>
        ) : (
          primaryDomain && <DomainVerification domain={primaryDomain} />
        )}
      </StepShell>

      <StepShell index={3} title={t("step3Title")} done={hasScan}>
        {hasDomains && !hasScan && (
          <>
            <p className="mb-2 text-xs text-gray-400">{t("step3Desc")}</p>
            <button
              onClick={onScanNow}
              disabled={scanPending}
              className="flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              <ScanSearch className="h-4 w-4" />
              {scanPending ? t("scanning") : t("scanNow")}
            </button>
          </>
        )}
      </StepShell>

      <StepShell index={4} title={t("step4Title")} done={hasScan}>
        {hasScan && (
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t("step4Desc")}
          </p>
        )}
      </StepShell>

      <StepShell index={5} title={t("step5Title")} done={hasScan} isLast>
        {hasScan && (
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <Bell className="h-3.5 w-3.5" />
            {t("step5Desc")}{" "}
            <Link href="/alerts" className="text-indigo-400 hover:text-indigo-300">
              {t("viewAlerts")}
            </Link>
          </p>
        )}
      </StepShell>
    </div>
  );
}

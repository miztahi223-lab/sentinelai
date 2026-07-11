"use client";

import { useTranslations } from "next-intl";
import { Plus, ScanSearch, FileText, Bell } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface QuickActionsProps {
  onScanNow?: () => void;
  scanDisabled?: boolean;
  scanPending?: boolean;
}

export function QuickActions({ onScanNow, scanDisabled, scanPending }: QuickActionsProps) {
  const t = useTranslations("dashboard");

  const linkClass =
    "flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 text-sm font-medium text-gray-200 transition hover:border-gray-700 hover:bg-gray-900";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        type="button"
        onClick={onScanNow}
        disabled={scanDisabled || scanPending}
        className={`${linkClass} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <ScanSearch className="h-4 w-4 text-indigo-400" />
        {scanPending ? t("startingScan") : t("qaScanNow")}
      </button>
      <Link href="/domains" className={linkClass}>
        <Plus className="h-4 w-4 text-indigo-400" />
        {t("qaAddDomain")}
      </Link>
      <Link href="/reports" className={linkClass}>
        <FileText className="h-4 w-4 text-indigo-400" />
        {t("qaViewReports")}
      </Link>
      <Link href="/alerts" className={linkClass}>
        <Bell className="h-4 w-4 text-indigo-400" />
        {t("qaViewAlerts")}
      </Link>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { DashboardSummary } from "@/lib/hooks";

interface CertificateExpirationsProps {
  items: DashboardSummary["upcomingCertExpirations"];
}

// Same severity bands the risk engine already uses for TLS-expiry findings
// (risk-engine.service.ts's `evaluateSsl`), so this widget's colors agree
// with the finding a click-through would show, not an independently
// invented threshold.
function urgency(daysUntilExpiry: number | null): "critical" | "warning" | "ok" {
  if (daysUntilExpiry === null) return "ok";
  if (daysUntilExpiry <= 14) return "critical";
  if (daysUntilExpiry <= 30) return "warning";
  return "ok";
}

const URGENCY_STYLES = {
  critical: { color: "text-red-400", bg: "bg-red-950" },
  warning: { color: "text-orange-400", bg: "bg-orange-950" },
  ok: { color: "text-emerald-400", bg: "bg-emerald-950" },
};

export function CertificateExpirations({ items }: CertificateExpirationsProps) {
  const t = useTranslations("dashboard");

  if (items.length === 0) {
    return <p className="text-sm text-gray-400">{t("certExpiryEmpty")}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const level = urgency(item.daysUntilExpiry);
        const { color, bg } = URGENCY_STYLES[level];
        const Icon = level === "ok" ? ShieldCheck : ShieldAlert;
        return (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{item.domainName}</p>
                <p className="truncate text-xs text-gray-400">{item.value}</p>
              </div>
            </div>
            <span className={`shrink-0 text-xs font-medium ${color}`}>
              {item.daysUntilExpiry !== null && item.daysUntilExpiry <= 0
                ? t("certExpired")
                : item.daysUntilExpiry === 1
                  ? t("certExpiresInOneDay")
                  : t("certExpiresInDays", { days: item.daysUntilExpiry ?? 0 })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

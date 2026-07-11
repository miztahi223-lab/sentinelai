"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe, Server, Link as LinkIcon, ShieldCheck } from "lucide-react";

export type AssetType = "SUBDOMAIN" | "IP" | "URL" | "SERVICE" | "CERTIFICATE";

interface AssetCardProps {
  type: AssetType;
  value: string;
  active: boolean;
  lastSeenAt: string;
  findingsCount?: number;
}

const ICONS: Record<AssetType, React.ComponentType<{ className?: string }>> = {
  SUBDOMAIN: Globe,
  IP: Server,
  URL: LinkIcon,
  SERVICE: Server,
  CERTIFICATE: ShieldCheck,
};

export function AssetCard({ type, value, active, lastSeenAt, findingsCount = 0 }: AssetCardProps) {
  const t = useTranslations("assetCard");
  const locale = useLocale();
  const Icon = ICONS[type] ?? Globe;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 transition hover:border-gray-700">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-800">
          <Icon className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{value}</p>
          <p className="text-xs text-gray-400">
            {type} · {t("lastSeen", { date: new Date(lastSeenAt).toLocaleDateString(locale) })}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {findingsCount > 0 && (
          <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs font-medium text-red-300">
            {findingsCount} {findingsCount === 1 ? t("finding") : t("findings")}
          </span>
        )}
        <span
          className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-gray-600"}`}
          title={active ? t("active") : t("inactive")}
        />
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from "@/lib/hooks";
import { AlertCard } from "@/components/AlertCard";

export default function AlertsPage() {
  const t = useTranslations("alerts");
  const { currentOrg: org } = useOrganization();
  const { data: alerts, isLoading } = useAlerts(org?.id);
  const markRead = useMarkAlertRead(org?.id);
  const markAllRead = useMarkAllAlertsRead(org?.id);

  const hasUnread = alerts?.some((a) => !a.read) ?? false;
  const hasAlerts = (alerts?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        {hasUnread && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:bg-gray-900 disabled:opacity-50"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      {!isLoading && !hasAlerts && (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-gray-600" />
          <h2 className="mt-3 text-sm font-medium text-white">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{t("emptyDesc")}</p>
        </div>
      )}

      <div className="space-y-2">
        {alerts?.map((alert) => (
          <AlertCard
            key={alert.id}
            severity={alert.severity}
            message={alert.message}
            createdAt={alert.createdAt}
            read={alert.read}
            onMarkRead={() => markRead.mutate(alert.id)}
          />
        ))}
      </div>
    </div>
  );
}

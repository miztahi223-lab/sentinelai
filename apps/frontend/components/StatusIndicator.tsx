"use client";

import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useHealth } from "@/lib/hooks";

/**
 * A real, live check against the actual backend (`GET /health`), polled —
 * not a static "All systems operational" graphic. There's no historical
 * uptime data behind this (no real monitoring pipeline exists yet in this
 * build), so this deliberately only ever claims to know the *current*
 * state, which is the one thing it can honestly check.
 */
export function StatusIndicator() {
  const t = useTranslations("status");
  const locale = useLocale();
  const { data, isLoading, isError } = useHealth();

  const rows = [
    {
      name: t("apiName"),
      ok: !isLoading && !isError && data?.status === "ok",
    },
    {
      name: t("databaseName"),
      ok: !isLoading && !isError && data?.database === "ok",
    },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-300">{row.name}</span>
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("checking")}
              </span>
            ) : row.ok ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {t("operational")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-400">
                <XCircle className="h-4 w-4" />
                {t("issue")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-gray-400">
        {data?.checkedAt
          ? t("lastChecked", { time: new Date(data.checkedAt).toLocaleString(locale) })
          : t("noCheckYet")}
      </p>
    </div>
  );
}

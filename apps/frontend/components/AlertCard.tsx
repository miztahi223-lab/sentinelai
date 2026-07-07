"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Info, ShieldAlert, XCircle } from "lucide-react";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface AlertCardProps {
  severity: Severity;
  message: string;
  createdAt: string;
  read?: boolean;
  onMarkRead?: () => void;
}

const SEVERITY_STYLES: Record<Severity, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  CRITICAL: { icon: XCircle, color: "text-red-400", bg: "bg-red-950" },
  HIGH: { icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-950" },
  MEDIUM: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-950" },
  LOW: { icon: Info, color: "text-blue-400", bg: "bg-blue-950" },
  INFO: { icon: Info, color: "text-gray-400", bg: "bg-gray-800" },
};

export function AlertCard({ severity, message, createdAt, read, onMarkRead }: AlertCardProps) {
  const t = useTranslations("alertCard");
  const locale = useLocale();
  const { icon: Icon, color, bg } = SEVERITY_STYLES[severity];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition ${
        read ? "border-gray-800 bg-gray-900/40 opacity-70" : "border-gray-800 bg-gray-900/60"
      }`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-100">{message}</p>
        <p className="mt-1 text-xs text-gray-500">
          {new Date(createdAt).toLocaleString(locale)}
        </p>
      </div>
      {!read && onMarkRead && (
        <button
          onClick={onMarkRead}
          className="shrink-0 text-xs text-indigo-400 transition hover:text-indigo-300"
        >
          {t("markRead")}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  ChevronDown,
  Info,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useAnalyzeFinding, type AiDifficulty, type AiPriority } from "@/lib/hooks";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface AlertCardProps {
  severity: Severity;
  message: string;
  createdAt: string;
  read?: boolean;
  onMarkRead?: () => void;
  // Optional — when provided, `message` is treated as the plain-language
  // headline and this becomes an expandable "technical detail" section
  // underneath it, so the real, precise technical wording (the actual
  // scan finding, unedited) is always still reachable, just not the
  // default leading view anymore. Omitted entirely for alert types that
  // are already plain (e.g. "New subdomain discovered: ..."), which is
  // why this is optional rather than always shown.
  technicalDetail?: string;
  // Optional — when provided, this card can request (or already show) a
  // real AI analysis of this exact finding. Omitted for alert types that
  // aren't backed by a real `Finding` row (e.g. "New subdomain
  // discovered").
  findingId?: string;
  aiExplanation?: string | null;
  aiBusinessImpact?: string | null;
  aiRemediation?: string | null;
  aiDifficulty?: AiDifficulty | null;
  aiPriority?: AiPriority | null;
}

const PRIORITY_STYLES: Record<AiPriority, string> = {
  LOW: "bg-gray-800 text-gray-300",
  MEDIUM: "bg-blue-950 text-blue-300",
  HIGH: "bg-orange-950 text-orange-300",
  URGENT: "bg-red-950 text-red-300",
};

const DIFFICULTY_STYLES: Record<AiDifficulty, string> = {
  EASY: "bg-emerald-950 text-emerald-300",
  MODERATE: "bg-yellow-950 text-yellow-300",
  HARD: "bg-orange-950 text-orange-300",
};

const SEVERITY_STYLES: Record<Severity, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  CRITICAL: { icon: XCircle, color: "text-red-400", bg: "bg-red-950" },
  HIGH: { icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-950" },
  MEDIUM: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-950" },
  LOW: { icon: Info, color: "text-blue-400", bg: "bg-blue-950" },
  INFO: { icon: Info, color: "text-gray-400", bg: "bg-gray-800" },
};

// Severities scary enough to earn a pulsing badge in plain language — a
// visual cue on top of the wording itself, matched to the real severity
// the scan actually assigned, not invented independently of it.
const URGENT_SEVERITIES: Severity[] = ["CRITICAL", "HIGH"];

export function AlertCard({
  severity,
  message,
  createdAt,
  read,
  onMarkRead,
  technicalDetail,
  findingId,
  aiExplanation,
  aiBusinessImpact,
  aiRemediation,
  aiDifficulty,
  aiPriority,
}: AlertCardProps) {
  const t = useTranslations("alertCard");
  const locale = useLocale();
  const [showTechnical, setShowTechnical] = useState(false);
  const { icon: Icon, color, bg } = SEVERITY_STYLES[severity];
  const isUrgent = URGENT_SEVERITIES.includes(severity);
  const analyzeFinding = useAnalyzeFinding();
  const hasAiAnalysis = !!aiRemediation;
  const analysisError =
    analyzeFinding.isError && isAxiosError(analyzeFinding.error)
      ? ((analyzeFinding.error.response?.data as { message?: string })?.message ??
        t("aiErrorDefault"))
      : analyzeFinding.isError
        ? t("aiErrorDefault")
        : null;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition ${
        read ? "border-gray-800 bg-gray-900/40 opacity-70" : "border-gray-800 bg-gray-900/60"
      } ${isUrgent && !read ? "border-red-900/60" : ""}`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg}`}>
        <Icon className={`h-4 w-4 ${color} ${isUrgent && !read ? "animate-pulse" : ""}`} />
      </div>
      <div className="min-w-0 flex-1">
        {isUrgent && !read && (
          <p className="mb-0.5 text-[10px] font-bold tracking-wide text-red-400 uppercase">
            {t("actionNeeded")}
          </p>
        )}
        <p className="text-sm text-gray-100">{message}</p>
        {technicalDetail && (
          <div className="mt-1.5">
            <button
              onClick={() => setShowTechnical((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 transition hover:text-gray-300"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showTechnical ? "rotate-180" : ""}`}
              />
              {t("showTechnicalDetail")}
            </button>
            {showTechnical && (
              <p className="mt-1 rounded bg-black/30 px-2 py-1.5 text-xs text-gray-400">
                {technicalDetail}
              </p>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {new Date(createdAt).toLocaleString(locale)}
        </p>

        {findingId && (
          <div className="mt-2">
            {hasAiAnalysis ? (
              <div className="rounded-md border border-indigo-900/40 bg-indigo-500/5 p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-medium text-indigo-300">
                    {t("aiAdvisorTitle")}
                  </span>
                  {aiPriority && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[aiPriority]}`}
                    >
                      {t(`priority_${aiPriority}` as "priority_LOW")}
                    </span>
                  )}
                  {aiDifficulty && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DIFFICULTY_STYLES[aiDifficulty]}`}
                    >
                      {t(`difficulty_${aiDifficulty}` as "difficulty_EASY")}
                    </span>
                  )}
                </div>
                {aiExplanation && (
                  <p className="text-xs text-gray-300">{aiExplanation}</p>
                )}
                {aiBusinessImpact && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    <span className="font-medium text-gray-300">{t("businessImpactLabel")}: </span>
                    {aiBusinessImpact}
                  </p>
                )}
                {aiRemediation && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    <span className="font-medium text-gray-300">{t("remediationLabel")}: </span>
                    {aiRemediation}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => analyzeFinding.mutate(findingId)}
                  disabled={analyzeFinding.isPending}
                  className="flex items-center gap-1.5 rounded-md border border-indigo-900/60 bg-indigo-500/5 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/10 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {analyzeFinding.isPending ? t("aiAnalyzing") : t("aiAnalyze")}
                </button>
                {analysisError && (
                  <p className="mt-1.5 text-xs text-red-400">{analysisError}</p>
                )}
              </div>
            )}
          </div>
        )}
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

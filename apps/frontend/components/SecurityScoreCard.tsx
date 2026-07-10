"use client";

import { useTranslations } from "next-intl";
import { TiltCard } from "@/components/TiltCard";

interface SecurityScoreCardProps {
  score: number; // 0-100
  previousScore?: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreLabelKey(score: number): "strong" | "fair" | "weak" | "critical" {
  if (score >= 80) return "strong";
  if (score >= 60) return "fair";
  if (score >= 40) return "weak";
  return "critical";
}

// A letter-grade view of the same underlying 0-100 score — not a second,
// independent rating system (that would be exactly the kind of opaque
// "black box number" this whole risk engine was built to avoid — see
// risk-engine.service.ts's own comments). Purely a more immediately
// legible presentation of the identical number for a non-technical
// stakeholder glancing at the dashboard, the same way a school letter
// grade is just a coarser view of a percentage — inspired by how
// SecurityScorecard presents its own vendor ratings (A-F) alongside the
// numeric detail, which real-world usage shows lands better with
// executives/auditors than a bare number does.
function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 60) return "D";
  return "F";
}

export function SecurityScoreCard({ score, previousScore }: SecurityScoreCardProps) {
  const t = useTranslations("securityScoreCard");
  const delta = previousScore !== undefined ? score - previousScore : undefined;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm transition hover:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-400">{t("title")}</h3>
          <p className={`mt-1 text-3xl font-semibold ${scoreColor(score)}`}>
            {score}
            <span className="text-base font-normal text-gray-500">/100</span>
          </p>
          <p className={`mt-1 text-xs font-medium ${scoreColor(score)}`}>
            {t(scoreLabelKey(score))}
          </p>
          {delta !== undefined && (
            <p
              className={`mt-2 text-xs ${
                delta >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} {t("vsLastScan")}
            </p>
          )}
        </div>

        <TiltCard>
          <div className="relative h-[120px] w-[120px] shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-gray-800"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={`transition-all duration-500 ${scoreColor(score)}`}
              />
            </svg>
            <span
              className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${scoreColor(score)}`}
            >
              {scoreToGrade(score)}
            </span>
          </div>
        </TiltCard>
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import type { FindingCategory } from "@/lib/hooks";

interface ScoreBreakdownProps {
  categories: Record<FindingCategory, { deduction: number; findings: number }>;
}

const CATEGORY_ORDER: FindingCategory[] = [
  "SSL",
  "HEADERS",
  "EXPOSURE",
  "CONFIGURATION",
  "DNS",
  "ASSET_CHANGE",
  "TECHNOLOGY",
];

/**
 * The real "why" behind the score — the exact same persisted findings the
 * number itself is summed from (`RiskEngineController.categoryBreakdown`),
 * grouped by category, so this can never say something different from the
 * score displayed next to it.
 */
export function ScoreBreakdown({ categories }: ScoreBreakdownProps) {
  const t = useTranslations("scoreBreakdown");

  const rows = CATEGORY_ORDER.map((category) => ({
    category,
    ...categories[category],
  })).filter((row) => row.findings > 0);

  if (rows.length === 0) {
    return <p className="text-xs text-gray-400">{t("empty")}</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-400">{t("title")}</h4>
      <ul className="space-y-1.5">
        {rows
          .sort((a, b) => b.deduction - a.deduction)
          .map((row) => (
            <li
              key={row.category}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-gray-400">
                {t(`category_${row.category}` as "category_SSL")}
                <span className="ms-1.5 text-gray-400">
                  ({row.findings} {row.findings === 1 ? t("finding") : t("findings")})
                </span>
              </span>
              <span
                className={row.deduction > 0 ? "font-medium text-orange-400" : "text-emerald-400"}
              >
                {row.deduction > 0 ? `-${row.deduction}` : t("noImpact")}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

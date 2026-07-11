"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface RiskDataPoint {
  date: string;
  score: number;
}

export function RiskChart({ data }: { data: RiskDataPoint[] }) {
  const t = useTranslations("riskChart");

  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm transition hover:border-gray-700">
        <h3 className="mb-4 text-sm font-medium text-gray-400">{t("title")}</h3>
        <p className="text-sm text-gray-400">{t("needsMoreScans")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm transition hover:border-gray-700">
      <h3 className="mb-4 text-sm font-medium text-gray-400">{t("title")}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="#4b5563"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#4b5563"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #1f2937",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#818cf8"
              strokeWidth={2}
              fill="url(#riskGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

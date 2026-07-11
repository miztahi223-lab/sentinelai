"use client";

import { useLocale, useTranslations } from "next-intl";

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  kind?: "info" | "warning" | "critical";
}

const DOT_COLOR: Record<NonNullable<TimelineEvent["kind"]>, string> = {
  info: "bg-blue-400",
  warning: "bg-yellow-400",
  critical: "bg-red-400",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const t = useTranslations("timeline");
  const locale = useLocale();

  if (events.length === 0) {
    return <p className="text-sm text-gray-400">{t("empty")}</p>;
  }

  return (
    <ol className="relative border-s border-gray-800 ps-6">
      {events.map((event) => (
        <li key={event.id} className="mb-6 last:mb-0">
          <span
            className={`absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${
              DOT_COLOR[event.kind ?? "info"]
            }`}
          />
          <p className="text-sm font-medium text-gray-100">{event.title}</p>
          {event.description && (
            <p className="mt-0.5 text-sm text-gray-400">{event.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {new Date(event.timestamp).toLocaleString(locale)}
          </p>
        </li>
      ))}
    </ol>
  );
}

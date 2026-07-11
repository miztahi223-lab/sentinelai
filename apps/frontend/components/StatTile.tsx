interface StatTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "default" | "warning" | "good";
}

const TONE_COLOR: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "text-white",
  warning: "text-orange-400",
  good: "text-emerald-400",
};

export function StatTile({ icon: Icon, label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 shadow-sm transition hover:border-gray-700">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${TONE_COLOR[tone]}`}>{value}</p>
    </div>
  );
}

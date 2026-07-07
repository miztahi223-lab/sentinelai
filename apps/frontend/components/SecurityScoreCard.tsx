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

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Weak";
  return "Critical";
}

export function SecurityScoreCard({ score, previousScore }: SecurityScoreCardProps) {
  const delta = previousScore !== undefined ? score - previousScore : undefined;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Security Score</h3>
          <p className={`mt-1 text-3xl font-semibold ${scoreColor(score)}`}>
            {score}
            <span className="text-base font-normal text-gray-500">/100</span>
          </p>
          <p className={`mt-1 text-xs font-medium ${scoreColor(score)}`}>
            {scoreLabel(score)}
          </p>
          {delta !== undefined && (
            <p
              className={`mt-2 text-xs ${
                delta >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts vs last scan
            </p>
          )}
        </div>

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
            className={scoreColor(score)}
          />
        </svg>
      </div>
    </div>
  );
}

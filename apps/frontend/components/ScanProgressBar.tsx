import { useTranslations } from "next-intl";
import { useScanStatus } from "@/lib/hooks";

/**
 * Shown while a triggered scan is actually PENDING/RUNNING — a real
 * percentage from the scan's own row (`ScanProcessor.reportProgress` on
 * the backend), not a fake/animated bar. Renders nothing once the scan
 * reaches a terminal state (`useScanStatus` itself stops polling then
 * too), so it disappears on its own rather than needing to be dismissed.
 */
export function ScanProgressBar({ scanId }: { scanId: string | undefined }) {
  const t = useTranslations("dashboard");
  const { data: scan } = useScanStatus(scanId);

  if (!scan || scan.status === "COMPLETED" || scan.status === "FAILED") {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-300">{t("scanInProgress")}</span>
        <span className="font-medium text-indigo-400">{scan.progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(scan.progress, 4)}%` }}
        />
      </div>
    </div>
  );
}

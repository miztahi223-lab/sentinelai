import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Downloadable security posture reports for your organization.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-gray-600" />
        <h2 className="mt-3 text-sm font-medium text-white">
          Report generation isn&apos;t built yet
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
          This is Step 12 of the build (PDF generation service). It will appear here once
          a scan has run and the reporting module is implemented.
        </p>
      </div>
    </div>
  );
}

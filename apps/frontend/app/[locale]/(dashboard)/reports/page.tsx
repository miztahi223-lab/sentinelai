"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { isAxiosError } from "axios";
import { FileText, Download, Mail, Loader2 } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { useReports, useCreateReport, useEmailReport, downloadReport } from "@/lib/hooks";

export default function ReportsPage() {
  const t = useTranslations("reports");
  const locale = useLocale();
  const { currentOrg: org } = useOrganization();
  const { data: reports, isLoading } = useReports(org?.id);
  const createReport = useCreateReport(org?.id);
  const emailReport = useEmailReport();

  const [error, setError] = useState<string | null>(null);
  const [emailedId, setEmailedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    try {
      await createReport.mutateAsync({});
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("errorDefault"));
    }
  }

  async function handleDownload(reportId: string, title: string) {
    setDownloadingId(reportId);
    try {
      await downloadReport(reportId, title);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleEmail(reportId: string) {
    setEmailedId(null);
    const result = await emailReport.mutateAsync(reportId);
    setEmailedId(result.sentTo);
  }

  const hasReports = (reports?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={createReport.isPending || !org}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-950 transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {createReport.isPending ? t("generating") : t("generate")}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {emailedId && (
        <p className="text-sm text-emerald-400">{t("emailSent", { email: emailedId })}</p>
      )}

      {!isLoading && !hasReports && (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-600" />
          <h2 className="mt-3 text-sm font-medium text-white">{t("notBuiltTitle")}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{t("notBuiltDesc")}</p>
        </div>
      )}

      <div className="space-y-2">
        {reports?.map((report) => {
          const ready = !!report.fileUrl;
          return (
            <div
              key={report.id}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 transition hover:border-gray-700"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-800">
                  <FileText className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{report.title}</p>
                  <p className="text-xs text-gray-500">
                    {t("generatedAt", {
                      date: new Date(report.generatedAt).toLocaleString(locale),
                    })}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!ready ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("statusPending")}
                  </span>
                ) : (
                  <>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                      {t("statusReady")}
                    </span>
                    <button
                      onClick={() => handleDownload(report.id, report.title)}
                      disabled={downloadingId === report.id}
                      className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-gray-600 hover:bg-gray-900 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("download")}
                    </button>
                    <button
                      onClick={() => handleEmail(report.id)}
                      disabled={emailReport.isPending}
                      className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-gray-600 hover:bg-gray-900 disabled:opacity-50"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {emailReport.isPending ? t("emailing") : t("email")}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

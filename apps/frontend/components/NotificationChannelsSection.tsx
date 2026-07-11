"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from "@/lib/hooks";

/**
 * Where an organization's real webhook/Slack URLs and digest toggles live —
 * the same `NotificationSettings` row `NotificationProcessor`/`DigestService`
 * actually read on the backend, so what's saved here is exactly what
 * controls real alert delivery, not a cosmetic form.
 */
export function NotificationChannelsSection({
  organizationId,
}: {
  organizationId: string | undefined;
}) {
  const t = useTranslations("settings");
  const { data: settings } = useNotificationSettings(organizationId);
  const update = useUpdateNotificationSettings(organizationId);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Real persisted values only ever arrive after the initial fetch resolves
  // — synced into local editable state once, derived during render rather
  // than via an effect (same pattern already established in
  // `Sidebar.tsx`/`auth-context.tsx`), so a user's in-progress edits are
  // never silently overwritten by a background refetch.
  const [initialized, setInitialized] = useState(false);
  if (settings && !initialized) {
    setInitialized(true);
    setWebhookUrl(settings.webhookUrl ?? "");
    setSlackWebhookUrl(settings.slackWebhookUrl ?? "");
    setDailyDigestEnabled(settings.dailyDigestEnabled);
    setWeeklyDigestEnabled(settings.weeklyDigestEnabled);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await update.mutateAsync({
        webhookUrl: webhookUrl.trim() || null,
        slackWebhookUrl: slackWebhookUrl.trim() || null,
        dailyDigestEnabled,
        weeklyDigestEnabled,
      });
      setMessage({ type: "success", text: t("notificationsSaved") });
    } catch (err) {
      const apiMessage = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setMessage({ type: "error", text: apiMessage ?? t("notificationsSaveError") });
    }
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
      <h2 className="mb-1 text-sm font-medium text-gray-400">
        {t("notificationChannels")}
      </h2>
      <p className="mb-4 text-xs text-gray-400">{t("notificationChannelsDesc")}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="notif-webhook-url" className="mb-1 block text-xs font-medium text-gray-400">
            {t("webhookUrl")}
          </label>
          <input
            id="notif-webhook-url"
            type="url"
            placeholder="https://example.com/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="notif-slack-webhook-url" className="mb-1 block text-xs font-medium text-gray-400">
            {t("slackWebhookUrl")}
          </label>
          <input
            id="notif-slack-webhook-url"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={dailyDigestEnabled}
              onChange={(e) => setDailyDigestEnabled(e.target.checked)}
              className="rounded border-gray-700 bg-gray-950 text-indigo-500 focus:ring-indigo-500"
            />
            {t("dailyDigest")}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={weeklyDigestEnabled}
              onChange={(e) => setWeeklyDigestEnabled(e.target.checked)}
              className="rounded border-gray-700 bg-gray-950 text-indigo-500 focus:ring-indigo-500"
            />
            {t("weeklyDigest")}
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {update.isPending ? t("saving") : t("save")}
          </button>
          {message && (
            <p
              className={`text-xs ${
                message.type === "success" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

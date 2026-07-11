"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/organization-context";
import { useUpdateProfile } from "@/lib/hooks";
import { TeamSection } from "@/components/TeamSection";
import { ActivityLog } from "@/components/ActivityLog";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { MfaSection } from "@/components/MfaSection";
import { NotificationChannelsSection } from "@/components/NotificationChannelsSection";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { user, refetchUser } = useAuth();
  const { currentOrg: org } = useOrganization();
  const updateProfile = useUpdateProfile();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");
  const [nameMessage, setNameMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function startEditingName() {
    setNameDraft(user?.name ?? "");
    setNameMessage(null);
    setEditingName(true);
  }

  async function saveName() {
    setNameMessage(null);
    try {
      await updateProfile.mutateAsync({ name: nameDraft });
      await refetchUser();
      setEditingName(false);
      setNameMessage({ type: "success", text: t("nameUpdated") });
    } catch (err) {
      const apiMessage = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setNameMessage({ type: "error", text: apiMessage ?? t("nameUpdateError") });
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-400">{t("subtitle")}</p>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
        <h2 className="mb-4 text-sm font-medium text-gray-400">{t("account")}</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-400">{t("name")}</dt>
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  aria-label={t("name")}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={100}
                  className="w-40 rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={saveName}
                  disabled={updateProfile.isPending || !nameDraft.trim()}
                  aria-label={t("saveName")}
                  className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  aria-label="Cancel"
                  className="rounded p-1 text-gray-400 hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <dd className="flex items-center gap-2 text-gray-100">
                {user?.name}
                <button
                  onClick={startEditingName}
                  aria-label={t("saveName")}
                  className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </dd>
            )}
          </div>
          {nameMessage && (
            <p
              className={`text-right text-xs ${
                nameMessage.type === "success"
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {nameMessage.text}
            </p>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-400">{t("email")}</dt>
            <dd className="text-gray-100">{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">{t("emailVerified")}</dt>
            <dd className={user?.emailVerified ? "text-emerald-400" : "text-yellow-400"}>
              {user?.emailVerified ? t("verified") : t("pendingVerification")}
            </dd>
          </div>
        </dl>
      </section>

      <ChangePasswordForm />

      <MfaSection />

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
        <h2 className="mb-4 text-sm font-medium text-gray-400">{t("organization")}</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-400">{t("name")}</dt>
            <dd className="text-gray-100">{org?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">{t("slug")}</dt>
            <dd className="text-gray-100">{org?.slug}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">{t("plan")}</dt>
            <dd className="text-gray-100">{org?.subscription?.plan ?? "FREE"}</dd>
          </div>
        </dl>
      </section>

      <NotificationChannelsSection organizationId={org?.id} />

      <TeamSection organizationId={org?.id} />

      <ActivityLog organizationId={org?.id} />

      <p className="text-xs text-gray-400">{t("footnote")}</p>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/organization-context";
import { TeamSection } from "@/components/TeamSection";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const { currentOrg: org } = useOrganization();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
        <h2 className="mb-4 text-sm font-medium text-gray-400">{t("account")}</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">{t("name")}</dt>
            <dd className="text-gray-100">{user?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t("email")}</dt>
            <dd className="text-gray-100">{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t("emailVerified")}</dt>
            <dd className={user?.emailVerified ? "text-emerald-400" : "text-yellow-400"}>
              {user?.emailVerified ? t("verified") : t("pendingVerification")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
        <h2 className="mb-4 text-sm font-medium text-gray-400">{t("organization")}</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">{t("name")}</dt>
            <dd className="text-gray-100">{org?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t("slug")}</dt>
            <dd className="text-gray-100">{org?.slug}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t("plan")}</dt>
            <dd className="text-gray-100">{org?.subscription?.plan ?? "FREE"}</dd>
          </div>
        </dl>
      </section>

      <TeamSection organizationId={org?.id} />

      <p className="text-xs text-gray-600">{t("footnote")}</p>
    </div>
  );
}

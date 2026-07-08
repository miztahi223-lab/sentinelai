"use client";

import { useTranslations, useLocale } from "next-intl";
import { History } from "lucide-react";
import { useAuditLogs, type AuditLogEntry } from "@/lib/hooks";

/**
 * Turns a raw audit action key (e.g. "domain.added") plus its stored
 * metadata into a real, human-readable sentence — rather than showing the
 * literal action string to a non-technical org owner, which is what an
 * "audit log" nobody actually reads looks like in practice.
 */
function describeAction(
  entry: AuditLogEntry,
  t: ReturnType<typeof useTranslations<"activityLog">>,
): string {
  const meta = entry.metadata ?? {};
  switch (entry.action) {
    case "user.registered":
      return t("actionUserRegistered");
    case "user.login":
      return t("actionUserLogin");
    case "domain.added":
      return t("actionDomainAdded", { name: String(meta.name ?? "") });
    case "invitation.created":
      return t("actionInvitationCreated", {
        email: String(meta.email ?? ""),
        role: String(meta.role ?? ""),
      });
    case "invitation.accepted":
      return t("actionInvitationAccepted", { role: String(meta.role ?? "") });
    case "billing.checkout_started":
      return t("actionBillingCheckoutStarted", { plan: String(meta.plan ?? "") });
    default:
      return entry.action;
  }
}

export function ActivityLog({ organizationId }: { organizationId: string | undefined }) {
  const t = useTranslations("activityLog");
  const locale = useLocale();
  // Deliberately doesn't try to independently guess whether the current
  // user is allowed to see this (e.g. by re-deriving their membership
  // role) — the real API is the single source of truth for that
  // authorization decision (see AuditLogsService.findForOrganization), and
  // this component just reflects whatever it genuinely says: real data on
  // success, the real "not allowed" state on a real 403.
  const { data: logs, isError } = useAuditLogs(organizationId);

  if (isError) {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
        <h2 className="mb-2 text-sm font-medium text-gray-400">{t("title")}</h2>
        <p className="text-xs text-gray-600">{t("ownersAdminsOnly")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
      <h2 className="mb-4 text-sm font-medium text-gray-400">{t("title")}</h2>
      {logs?.length === 0 && <p className="text-sm text-gray-500">{t("empty")}</p>}
      <ul className="space-y-3">
        {logs?.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 text-sm">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
            <div className="min-w-0">
              <p className="text-gray-200">{describeAction(entry, t)}</p>
              <p className="text-xs text-gray-500">
                {entry.user ? `${entry.user.name} · ` : `${t("systemUser")} · `}
                {new Date(entry.createdAt).toLocaleString(locale)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

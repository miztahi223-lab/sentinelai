"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { isAxiosError } from "axios";
import { UserPlus, X } from "lucide-react";
import {
  useMembers,
  useInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  type MembershipRole,
} from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABEL_KEY: Record<MembershipRole, "roleOwner" | "roleAdmin" | "roleMember"> = {
  OWNER: "roleOwner",
  ADMIN: "roleAdmin",
  MEMBER: "roleMember",
};

export function TeamSection({ organizationId }: { organizationId: string | undefined }) {
  const t = useTranslations("team");
  const locale = useLocale();
  const { user } = useAuth();
  const { data: members } = useMembers(organizationId);
  const { data: invitations } = useInvitations(organizationId);
  const createInvitation = useCreateInvitation(organizationId);
  const revokeInvitation = useRevokeInvitation(organizationId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const myMembership = members?.find((m) => m.user.id === user?.id);
  const canManage = myMembership?.role === "OWNER" || myMembership?.role === "ADMIN";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await createInvitation.mutateAsync({ email, role });
      setMessage({ type: "success", text: t("invitedMessage", { email }) });
      setEmail("");
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setMessage({ type: "error", text: msg ?? t("errorDefault") });
    }
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
      <h2 className="mb-4 text-sm font-medium text-gray-400">{t("title")}</h2>

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        {t("membersTitle")}
      </h3>
      <ul className="space-y-2">
        {members?.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/60 px-4 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-100">
                {member.user.name}
                {member.user.id === user?.id && (
                  <span className="ms-2 text-xs text-gray-400">({t("you")})</span>
                )}
              </p>
              <p className="truncate text-xs text-gray-400">{member.user.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300">
              {t(ROLE_LABEL_KEY[member.role])}
            </span>
          </li>
        ))}
      </ul>

      {canManage && (
        <>
          <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-gray-400">
            {t("pendingTitle")}
          </h3>
          {invitations?.length === 0 ? (
            <p className="text-sm text-gray-400">{t("noPending")}</p>
          ) : (
            <ul className="space-y-2">
              {invitations?.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex items-center justify-between rounded-lg border border-dashed border-gray-800 bg-gray-950/40 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-200">{invitation.email}</p>
                    <p className="text-xs text-gray-400">
                      {t(ROLE_LABEL_KEY[invitation.role])} ·{" "}
                      {t("expires", {
                        date: new Date(invitation.expiresAt).toLocaleDateString(locale),
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeInvitation.mutate(invitation.id)}
                    disabled={revokeInvitation.isPending}
                    className="shrink-0 rounded-md p-1.5 text-gray-400 transition hover:bg-red-950/60 hover:text-red-300 disabled:opacity-50"
                    aria-label={t("revoke")}
                    title={t("revoke")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-gray-400">
            {t("inviteTitle")}
          </h3>
          <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="invite-email" className="sr-only">
              {t("inviteEmailPlaceholder")}
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("inviteEmailPlaceholder")}
              className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
              aria-label={t("role")}
              className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="MEMBER">{t("roleMember")}</option>
              <option value="ADMIN">{t("roleAdmin")}</option>
            </select>
            <button
              type="submit"
              disabled={createInvitation.isPending}
              className="flex items-center justify-center gap-1.5 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {createInvitation.isPending ? t("inviting") : t("invite")}
            </button>
          </form>
          {message && (
            <p
              className={`mt-2 text-sm ${
                message.type === "success" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {message.text}
            </p>
          )}
        </>
      )}

      {!canManage && (
        <p className="mt-4 text-xs text-gray-400">{t("onlyOwnersAdmins")}</p>
      )}
    </section>
  );
}

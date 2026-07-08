"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useInvitationPreview, useAcceptInvitation, type MembershipRole } from "@/lib/hooks";
import { useState } from "react";

const ROLE_LABEL_KEY: Record<MembershipRole, "roleOwner" | "roleAdmin" | "roleMember"> = {
  OWNER: "roleOwner",
  ADMIN: "roleAdmin",
  MEMBER: "roleMember",
};

export default function InvitationAcceptPage() {
  const t = useTranslations("invitationAccept");
  const tTeam = useTranslations("team");
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user, loading: authLoading } = useAuth();
  const { data: invitation, isLoading, isError } = useInvitationPreview(token);
  const acceptInvitation = useAcceptInvitation();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    setAcceptError(null);
    try {
      await acceptInvitation.mutateAsync(token);
      setAccepted(true);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setAcceptError(message ?? t("errorDefault"));
    }
  }

  const loading = isLoading || authLoading;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
          Sentinel<span className="text-indigo-400">AI</span>
        </Link>

        <div className="mt-8 space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl">
          {loading && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-gray-400">{t("loading")}</p>
            </>
          )}

          {!loading && isError && (
            <>
              <XCircle className="mx-auto h-8 w-8 text-red-400" />
              <h2 className="text-sm font-medium text-white">{t("invalidTitle")}</h2>
              <p className="text-sm text-gray-400">{t("invalidDesc")}</p>
            </>
          )}

          {!loading && !isError && invitation && accepted && (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <h2 className="text-sm font-medium text-white">{t("successTitle")}</h2>
              <p className="text-sm text-gray-400">
                {t("successDesc", { organization: invitation.organization.name })}
              </p>
              <Link
                href="/dashboard"
                className="inline-block rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
              >
                {t("goToDashboard")}
              </Link>
            </>
          )}

          {!loading && !isError && invitation && !accepted && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-indigo-900 bg-indigo-500/10">
                <Mail className="h-5 w-5 text-indigo-400" />
              </div>
              <h2 className="text-sm font-medium text-white">
                {t("inviteTitle", { organization: invitation.organization.name })}
              </h2>
              <p className="text-sm text-gray-400">
                {t("inviteRoleLine", { role: tTeam(ROLE_LABEL_KEY[invitation.role]) })}
              </p>

              {!user ? (
                <>
                  <p className="text-sm text-gray-400">
                    {t("signInPrompt", { email: invitation.email })}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/invitations/${token}`)}`}
                      className="flex-1 rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:bg-gray-900"
                    >
                      {t("signIn")}
                    </Link>
                    <Link
                      href={`/register?redirect=${encodeURIComponent(`/invitations/${token}`)}&email=${encodeURIComponent(invitation.email)}`}
                      className="flex-1 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                    >
                      {t("createAccount")}
                    </Link>
                  </div>
                </>
              ) : user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
                <>
                  <h3 className="text-sm font-medium text-yellow-400">
                    {t("wrongAccountTitle")}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {t("wrongAccountDesc", { email: invitation.email })}
                  </p>
                </>
              ) : (
                <>
                  {acceptError && (
                    <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                      {acceptError}
                    </div>
                  )}
                  <button
                    onClick={handleAccept}
                    disabled={acceptInvitation.isPending}
                    className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
                  >
                    {acceptInvitation.isPending ? t("accepting") : t("accept")}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

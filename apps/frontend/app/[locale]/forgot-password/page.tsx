"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AmbientBackground } from "@/components/AmbientBackground";
import { api } from "@/lib/api";
import { isAxiosError } from "axios";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");
    try {
      await api.post("/auth/forgot-password", { email });
      // Always shows the same success state regardless of whether the email
      // is actually registered — the backend deliberately returns an
      // identical response either way (no user-enumeration signal), and
      // the frontend must not undo that by branching on a real/fake
      // distinction it doesn't have.
      setStatus("sent");
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("errorDefault"));
      setStatus("idle");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <AmbientBackground />
      <LanguageSwitcher className="absolute top-6 end-6" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
            Sentinel<span className="text-indigo-400">AI</span>
          </Link>
          <p className="mt-2 text-sm text-gray-400">{t("forgotPasswordTitle")}</p>
        </div>

        {status === "sent" ? (
          <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-center shadow-xl">
            <h2 className="text-sm font-medium text-white">{t("resetLinkSentTitle")}</h2>
            <p className="text-sm text-gray-400">{t("resetLinkSentDesc")}</p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              {t("backToLogin")}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl"
          >
            <p className="text-sm text-gray-400">{t("forgotPasswordSubtitle")}</p>

            {error && (
              <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                {t("email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder={t("emailPlaceholder")}
              />
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {status === "submitting" ? t("sendingResetLink") : t("sendResetLink")}
            </button>

            <p className="text-center text-sm text-gray-400">
              <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
                {t("backToLogin")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

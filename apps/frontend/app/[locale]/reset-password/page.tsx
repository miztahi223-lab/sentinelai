"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AmbientBackground } from "@/components/AmbientBackground";
import {
  PasswordStrengthHint,
  passwordMeetsRequirements,
} from "@/components/PasswordStrengthHint";
import { api } from "@/lib/api";
import { isAxiosError } from "axios";

// `useSearchParams()` opts the page out of static prerendering unless its
// consumer is wrapped in `Suspense` — without this, `next build` fails
// outright trying to prerender this route (confirmed: caught this exact
// build error before shipping, not a hypothetical).
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const t = useTranslations("auth");
  // Reading the token via `useSearchParams` (not a locale-aware wrapper —
  // next-intl's navigation helpers don't wrap this one, only Link/router/
  // pathname) is fine here since it's read-only and doesn't itself trigger
  // any navigation that could drop the locale prefix.
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setStatus("submitting");
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setStatus("success");
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
            DomeCortex <span className="text-indigo-400">AI</span>
          </Link>
        </div>

        {!token ? (
          <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-center shadow-xl">
            <h2 className="text-sm font-medium text-white">{t("invalidTokenTitle")}</h2>
            <p className="text-sm text-gray-400">{t("invalidTokenDesc")}</p>
            <Link
              href="/forgot-password"
              className="inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              {t("forgotPasswordTitle")}
            </Link>
          </div>
        ) : status === "success" ? (
          <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-center shadow-xl">
            <h2 className="text-sm font-medium text-white">{t("resetSuccessTitle")}</h2>
            <p className="text-sm text-gray-400">{t("resetSuccessDesc")}</p>
            <Link
              href="/login"
              className="inline-block rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              {t("signIn")}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl"
          >
            <p className="text-sm text-gray-400">{t("resetPasswordSubtitle")}</p>

            {error && (
              <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="reset-password-new" className="mb-1 block text-sm font-medium text-gray-300">
                {t("newPassword")}
              </label>
              <input
                id="reset-password-new"
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder={t("passwordPlaceholder")}
              />
              <PasswordStrengthHint password={password} />
            </div>

            <button
              type="submit"
              disabled={status === "submitting" || !passwordMeetsRequirements(password)}
              className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {status === "submitting" ? t("resettingPassword") : t("resetPasswordButton")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

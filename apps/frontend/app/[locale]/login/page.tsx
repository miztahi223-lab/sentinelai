"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AmbientBackground } from "@/components/AmbientBackground";
import { isAxiosError } from "axios";

// `useSearchParams()` (to preserve a `?redirect=` target, e.g. from an
// invitation-accept link) needs a Suspense boundary or `next build` fails
// prerendering this route — same fix as reset-password/verify-email.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations("auth");
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, redirectTo);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("errorDefault"));
    } finally {
      setSubmitting(false);
    }
  }

  const registerHref = redirectTo
    ? `/register?redirect=${encodeURIComponent(redirectTo)}`
    : "/register";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <AmbientBackground />
      <LanguageSwitcher className="absolute top-6 end-6" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
            Sentinel<span className="text-indigo-400">AI</span>
          </Link>
          <p className="mt-2 text-sm text-gray-400">{t("signInTitle")}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl"
        >
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

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-300">
                {t("password")}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                {t("forgotPassword")}
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {submitting ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {t("noAccount")}{" "}
          <Link href={registerHref} className="font-medium text-indigo-400 hover:text-indigo-300">
            {t("startTrial")}
          </Link>
        </p>
      </div>
    </div>
  );
}

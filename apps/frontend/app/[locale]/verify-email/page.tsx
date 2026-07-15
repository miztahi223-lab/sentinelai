"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AmbientBackground } from "@/components/AmbientBackground";
import { api } from "@/lib/api";

// Same reasoning as reset-password/page.tsx: `useSearchParams()` needs a
// Suspense boundary or `next build` fails prerendering this route.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    token ? "verifying" : "error",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .post("/auth/verify-email", { token })
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <AmbientBackground />
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
          DomeCortex <span className="text-indigo-400">AI</span>
        </Link>

        <div className="mt-8 space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl">
          {status === "verifying" && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-gray-400">{t("verifyingEmail")}</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <h2 className="text-sm font-medium text-white">{t("verifyEmailSuccessTitle")}</h2>
              <p className="text-sm text-gray-400">{t("verifyEmailSuccessDesc")}</p>
              <Link
                href="/dashboard"
                className="inline-block rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
              >
                {t("goToDashboard")}
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="mx-auto h-8 w-8 text-red-400" />
              <h2 className="text-sm font-medium text-white">{t("verifyEmailErrorTitle")}</h2>
              <p className="text-sm text-gray-400">{t("verifyEmailErrorDesc")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

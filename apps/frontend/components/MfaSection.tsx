"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMfaSetup, useMfaEnable, useMfaDisable } from "@/lib/hooks";

type Step = "idle" | "setup" | "backupCodes";

/**
 * Two-factor authentication (TOTP) setup/disable — a real two-step
 * commitment on enable (see `MfaService` on the backend for why): starting
 * setup doesn't turn anything on by itself, only submitting a real code
 * generated from the secret does. Backup codes are shown exactly once,
 * right after enabling, since the server only ever stores their hashes.
 */
export function MfaSection() {
  const t = useTranslations("settings");
  const { user, refetchUser } = useAuth();
  const mfaSetup = useMfaSetup();
  const mfaEnable = useMfaEnable();
  const mfaDisable = useMfaDisable();

  const [step, setStep] = useState<Step>("idle");
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeDataUrl: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setError(null);
    try {
      const data = await mfaSetup.mutateAsync();
      setSetupData(data);
      setStep("setup");
    } catch (err) {
      setError(errorMessage(err, t("mfaSetupError")));
    }
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await mfaEnable.mutateAsync(code.trim());
      setBackupCodes(result.backupCodes);
      setStep("backupCodes");
      setCode("");
      await refetchUser();
    } catch (err) {
      setError(errorMessage(err, t("mfaEnableError")));
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mfaDisable.mutateAsync(disablePassword);
      setDisablePassword("");
      setShowDisableForm(false);
      await refetchUser();
    } catch (err) {
      setError(errorMessage(err, t("mfaDisableError")));
    }
  }

  function finishBackupCodes() {
    setStep("idle");
    setSetupData(null);
    setBackupCodes([]);
  }

  function errorMessage(err: unknown, fallback: string): string {
    return isAxiosError(err)
      ? ((err.response?.data as { message?: string })?.message ?? fallback)
      : fallback;
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">{t("mfaTitle")}</h2>
        {user?.mfaEnabled && step === "idle" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("mfaEnabled")}
          </span>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {step === "idle" && !user?.mfaEnabled && (
        <div>
          <p className="mb-3 text-xs text-gray-400">{t("mfaDescription")}</p>
          <button
            onClick={startSetup}
            disabled={mfaSetup.isPending}
            className="rounded-md bg-indigo-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {mfaSetup.isPending ? t("mfaStartingSetup") : t("mfaEnableButton")}
          </button>
        </div>
      )}

      {step === "idle" && user?.mfaEnabled && (
        <div>
          <p className="mb-3 text-xs text-gray-400">{t("mfaEnabledDescription")}</p>
          {!showDisableForm ? (
            <button
              onClick={() => setShowDisableForm(true)}
              className="flex items-center gap-1.5 rounded-md border border-red-900 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-950/40"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              {t("mfaDisableButton")}
            </button>
          ) : (
            <form onSubmit={handleDisable} className="space-y-3">
              <label htmlFor="mfa-disable-password" className="sr-only">
                {t("mfaDisablePasswordPlaceholder")}
              </label>
              <input
                id="mfa-disable-password"
                type="password"
                autoComplete="current-password"
                placeholder={t("mfaDisablePasswordPlaceholder")}
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                className="w-full max-w-xs rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={mfaDisable.isPending}
                  className="rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {mfaDisable.isPending ? t("mfaDisabling") : t("mfaConfirmDisable")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableForm(false);
                    setDisablePassword("");
                    setError(null);
                  }}
                  className="rounded-md border border-gray-700 px-4 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-900"
                >
                  {t("mfaCancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {step === "setup" && setupData && (
        <form onSubmit={handleEnable} className="space-y-4">
          <p className="text-xs text-gray-400">{t("mfaSetupInstructions")}</p>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Image
              src={setupData.qrCodeDataUrl}
              alt={t("mfaQrCodeAlt")}
              width={160}
              height={160}
              unoptimized
              className="rounded-md border border-gray-800"
            />
            <div>
              <p className="text-xs text-gray-400">{t("mfaManualEntryLabel")}</p>
              <code className="mt-1 block rounded-md bg-gray-950 px-2 py-1 text-xs text-gray-300">
                {setupData.secret}
              </code>
            </div>
          </div>
          <div>
            <label htmlFor="mfa-setup-code" className="mb-1 block text-xs font-medium text-gray-300">
              {t("mfaCodeLabel")}
            </label>
            <input
              id="mfa-setup-code"
              autoFocus
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="w-full max-w-[160px] rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-center text-lg tracking-[0.3em] text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={mfaEnable.isPending}
              className="rounded-md bg-indigo-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {mfaEnable.isPending ? t("mfaEnabling") : t("mfaConfirmEnable")}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setSetupData(null);
                setCode("");
                setError(null);
              }}
              className="rounded-md border border-gray-700 px-4 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-900"
            >
              {t("mfaCancel")}
            </button>
          </div>
        </form>
      )}

      {step === "backupCodes" && (
        <div className="space-y-4">
          <p className="text-xs text-yellow-400">{t("mfaBackupCodesWarning")}</p>
          <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-950 p-4 font-mono text-sm text-gray-200 sm:grid-cols-5">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            onClick={finishBackupCodes}
            className="rounded-md bg-indigo-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-400"
          >
            {t("mfaBackupCodesSaved")}
          </button>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { useChangePassword } from "@/lib/hooks";

/**
 * Changing your password from an authenticated session — distinct from the
 * unauthenticated forgot-password/reset-password email flow. Requires the
 * current password (verified for real by the backend against the actual
 * argon2 hash), and on success every other session is revoked server-side
 * (see `UsersController.changePassword`), so the success message says so
 * rather than silently logging the user out of other tabs/devices with no
 * explanation.
 */
export function ChangePasswordForm() {
  const t = useTranslations("settings");
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: t("passwordMismatch") });
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setMessage({ type: "success", text: t("passwordUpdated") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const apiMessage = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setMessage({ type: "error", text: apiMessage ?? t("passwordUpdateError") });
    }
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-gray-700">
      <h2 className="mb-4 text-sm font-medium text-gray-400">
        {t("changePassword")}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="change-password-current" className="sr-only">
          {t("currentPassword")}
        </label>
        <input
          id="change-password-current"
          type="password"
          autoComplete="current-password"
          placeholder={t("currentPassword")}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <label htmlFor="change-password-new" className="sr-only">
          {t("newPassword")}
        </label>
        <input
          id="change-password-new"
          type="password"
          autoComplete="new-password"
          placeholder={t("newPassword")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={12}
          required
          className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <label htmlFor="change-password-confirm" className="sr-only">
          {t("confirmNewPassword")}
        </label>
        <input
          id="change-password-confirm"
          type="password"
          autoComplete="new-password"
          placeholder={t("confirmNewPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={12}
          required
          className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {message && (
          <p
            className={`text-xs ${
              message.type === "success" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={changePassword.isPending}
          className="rounded-md bg-indigo-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-400"
        >
          {t("changePasswordSubmit")}
        </button>
      </form>
    </section>
  );
}

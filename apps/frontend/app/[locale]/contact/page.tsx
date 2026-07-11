"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AmbientBackground } from "@/components/AmbientBackground";
import { api } from "@/lib/api";

export default function ContactPage() {
  const t = useTranslations("contact");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await api.post("/contact", form);
      setStatus("sent");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? t("errorDefault"));
      setStatus("error");
    }
  }

  return (
    <>
      <MarketingNav />
      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden">
          <AmbientBackground />
          <div className="relative mx-auto max-w-lg px-6 py-20">
          <h1 className="text-center text-3xl font-semibold text-white">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-md text-center text-gray-400">{t("subtitle")}</p>

          {status === "sent" ? (
            <div className="mt-8 rounded-md border border-emerald-900 bg-emerald-950/60 px-4 py-3 text-center text-sm text-emerald-300">
              {t("sentMessage")}
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl"
            >
              {error && (
                <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-gray-300">
                  {t("name")}
                </label>
                <input
                  id="contact-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-gray-300">
                  {t("email")}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="contact-subject" className="mb-1 block text-sm font-medium text-gray-300">
                  {t("subject")}
                </label>
                <input
                  id="contact-subject"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-gray-300">
                  {t("message")}
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {status === "submitting" ? t("sending") : t("send")}
              </button>
            </form>
          )}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

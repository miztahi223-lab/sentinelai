"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { api } from "@/lib/api";

export default function ContactPage() {
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
      setError(message ?? "Could not send your message. Please try again.");
      setStatus("error");
    }
  }

  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto max-w-lg px-6 py-20">
          <h1 className="text-center text-3xl font-semibold text-white">Contact us</h1>
          <p className="mx-auto mt-4 max-w-md text-center text-gray-400">
            Questions about SentinelAI? Send us a message and we&apos;ll get back to you.
          </p>

          {status === "sent" ? (
            <div className="mt-8 rounded-md border border-emerald-900 bg-emerald-950/60 px-4 py-3 text-center text-sm text-emerald-300">
              Thanks — your message has been sent. We&apos;ll be in touch.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Subject</label>
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {status === "submitting" ? "Sending..." : "Send message"}
              </button>
            </form>
          )}
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

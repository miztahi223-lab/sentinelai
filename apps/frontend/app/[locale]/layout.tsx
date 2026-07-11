import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { AuthProvider } from "@/lib/auth-context";
import { SkipLink } from "@/components/SkipLink";
import { routing, directionForLocale, type Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    ...buildMetadata({
      locale,
      path: "",
      title: t("title"),
      description: t("description"),
    }),
    // Explicit, absolute icon path — without this, browsers on a locale-
    // prefixed page (e.g. `/he/domains`) sometimes request the favicon
    // relative to the current path (`/he/favicon.ico`), which 404s since
    // the file only exists at the true root. Verified this is a real,
    // reproducible issue (not hypothetical) via a live browser session
    // before adding this.
    icons: { icon: "/favicon.ico" },
    metadataBase: new URL(SITE_URL),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale's subtree — without this,
  // every page under `[locale]` would be forced into fully dynamic
  // rendering just because the locale is read from a route param.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={directionForLocale(locale)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-gray-950 text-gray-100">
        {/* Subtle decorative glow behind the whole app — fixed, non-interactive,
            and rendered once at the root so every page gets the same premium-SaaS
            depth (Stripe/Linear/Vercel all use some version of this) without each
            page having to recreate it. `pointer-events-none` + negative z-index
            keep it purely visual. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute left-1/2 top-[-10%] h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-[120px]" />
        </div>

        <NextIntlClientProvider locale={locale as Locale}>
          <SkipLink />
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
